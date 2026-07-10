import { NextRequest, NextResponse } from "next/server";
import { xeroxPool } from "@/lib/xerox-pool";
import { bmsPool } from "@/lib/bms-pool";
import { withClient, notFound, badRequest, serverError } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { requireUser, AuthError, getSessionUser, type SessionUser } from "@/lib/auth";

const FEEDBACK_FIELDS = [
  "condition", "condition_notes", "replace_flag", "age",
  "install_date", "contract_end", "technician_notes", "last_visit",
];

// Subset a store_staff user may set (feedback edits only).
const STAFF_FEEDBACK_FIELDS = new Set(["condition", "condition_notes", "replace_flag", "notes"]);

function validSerial(sn: string): boolean {
  return sn.length >= 3 && sn.length <= 64 && /^[A-Z0-9\-_. ]+$/.test(sn);
}

/**
 * Phase 11 — write printer feedback changes to equipment.printer_change_log
 * (bms DB). Best-effort: never let a logging failure fail the PATCH. Lazily
 * ensures the table exists so the schema self-heals.
 */
async function logPrinterChanges(
  sn: string,
  store: string | null,
  changes: Array<{ field: string; oldVal: unknown; newVal: unknown }>,
  userName: string,
): Promise<void> {
  if (changes.length === 0) return;
  try {
    await withClient(bmsPool, async (client) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS equipment.printer_change_log (
          id         SERIAL PRIMARY KEY,
          serial     TEXT NOT NULL,
          store      TEXT,
          field      TEXT NOT NULL,
          old_value  TEXT,
          new_value  TEXT,
          user_name  TEXT DEFAULT 'user',
          changed_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      for (const c of changes) {
        await client.query(
          `INSERT INTO equipment.printer_change_log (serial, store, field, old_value, new_value, user_name)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            sn,
            store,
            c.field,
            c.oldVal === null || c.oldVal === undefined ? null : String(c.oldVal),
            c.newVal === null || c.newVal === undefined ? null : String(c.newVal),
            userName,
          ],
        );
      }
    });
  } catch (err) {
    // Logging must never fail the PATCH — record and move on.
    console.error("[printer_change_log] insert failed", err);
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ serial: string }> }) {
  let user: SessionUser;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { serial } = await params;
  const sn = decodeURIComponent(serial).toUpperCase().trim();
  if (!validSerial(sn)) return notFound();
  const timer = routeTimer(`GET /api/equipment/printers/${sn}`);

  return withClient(xeroxPool, async (client) => {
    const [dim, map, feedback, history] = await Promise.all([
      client.query(
        `SELECT pd.serial_number, pd.model, pd.manufacturer, pd.last_seen::text,
                pd.color_capable, pd.duplex_capable
         FROM xerox.printer_dimensions pd
         WHERE UPPER(TRIM(pd.serial_number)) = $1`,
        [sn]
      ),
      client.query(
        `SELECT psm.store, psm.printer_type, psm.model_name, psm.reporting_enabled
         FROM xerox.printer_store_map psm
         WHERE UPPER(TRIM(psm.serial_number)) = $1`,
        [sn]
      ),
      client.query(
        `SELECT * FROM xerox.machine_feedback WHERE UPPER(TRIM(serial_number)) = $1`, [sn]
      ),
      client.query(
        `SELECT report_date::text, total, black, colour, a3, large
         FROM xerox.meter_readings_normalised
         WHERE UPPER(TRIM(serial_number)) = $1
           AND report_date >= CURRENT_DATE - INTERVAL '6 months'
         ORDER BY report_date DESC LIMIT 30`,
        [sn]
      ),
    ]);

    if (dim.rows.length === 0 && map.rows.length === 0) return notFound();

    // Store staff may only view printers in their OWN store. Fail closed: if the
    // printer's store cannot be resolved to the caller's store, deny.
    if (user.role !== "admin") {
      const store = map.rows[0]?.store ?? null;
      if (!store || store !== user.store) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    timer.done({ sn });
    return NextResponse.json({
      serial: sn,
      dimensions: dim.rows[0] ?? null,
      mapping: map.rows[0] ?? null,
      feedback: feedback.rows[0] ?? null,
      history: history.rows,
    });
  }).catch((err) => { timer.error(err); return serverError(err, `GET /api/equipment/printers/${sn}`); });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ serial: string }> }) {
  let user: SessionUser;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { serial } = await params;
  const sn = decodeURIComponent(serial).toUpperCase().trim();
  if (!validSerial(sn)) return notFound();
  const timer = routeTimer(`PATCH /api/equipment/printers/${sn}`);
  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");

  // Store staff may only touch feedback fields — reject anything else.
  if (user.role !== "admin") {
    for (const k of Object.keys(body)) {
      if (!STAFF_FEEDBACK_FIELDS.has(k)) {
        return NextResponse.json({ error: "Forbidden: field not permitted for your role" }, { status: 403 });
      }
    }
  }

  return withClient(xeroxPool, async (client) => {
    // Enforce store ownership for store_staff. Fail closed: deny if the printer's
    // store cannot be resolved to the caller's own store.
    let resolvedStore: string | null = null;
    if (user.role !== "admin") {
      const storeRes = await client.query(
        `SELECT store FROM xerox.printer_store_map WHERE UPPER(TRIM(serial_number)) = $1 LIMIT 1`,
        [sn]
      );
      resolvedStore = storeRes.rows[0]?.store ?? null;
      if (!resolvedStore || resolvedStore !== user.store) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (FEEDBACK_FIELDS.includes(k)) updates[k] = v === "" ? null : v;
    }
    if (Object.keys(updates).length === 0) return badRequest("No valid fields");

    const existing = await client.query(
      `SELECT * FROM xerox.machine_feedback WHERE UPPER(TRIM(serial_number)) = $1`, [sn]
    );
    const old = existing.rows[0] ?? {};

    let row;
    if (existing.rows.length === 0) {
      const cols = ["serial_number", ...Object.keys(updates)];
      const placeholders = cols.map((_, i) => `$${i + 1}`);
      const result = await client.query(
        `INSERT INTO xerox.machine_feedback (${cols.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`,
        [sn, ...Object.values(updates)]
      );
      row = result.rows[0];
    } else {
      const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`);
      const result = await client.query(
        `UPDATE xerox.machine_feedback SET ${setClauses.join(", ")} WHERE UPPER(TRIM(serial_number)) = $1 RETURNING *`,
        [sn, ...Object.values(updates)]
      );
      row = result.rows[0];
    }

    // Phase 11 — audit log: one row per actually-changed field. Runs AFTER the
    // guards passed and the feedback UPDATE succeeded. Best-effort (own try/catch
    // inside logPrinterChanges) so a logging failure can never fail this PATCH.
    const changes: Array<{ field: string; oldVal: unknown; newVal: unknown }> = [];
    for (const [field, newVal] of Object.entries(updates)) {
      const oldVal = old[field] ?? null;
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal ?? null)) {
        changes.push({ field, oldVal, newVal: newVal ?? null });
      }
    }
    if (changes.length > 0) {
      // Resolve store for the log row (already fetched for staff; look it up for admin).
      let logStore = resolvedStore;
      if (logStore === null) {
        const storeRes = await client.query(
          `SELECT store FROM xerox.printer_store_map WHERE UPPER(TRIM(serial_number)) = $1 LIMIT 1`,
          [sn]
        );
        logStore = storeRes.rows[0]?.store ?? null;
      }
      const sessionUser = await getSessionUser();
      const userName = sessionUser?.name || user.name || "user";
      await logPrinterChanges(sn, logStore, changes, userName);
    }

    timer.done({ sn, fields: Object.keys(updates) });
    return NextResponse.json({ feedback: row });
  }).catch((err) => { timer.error(err); return serverError(err, `PATCH /api/equipment/printers/${sn}`); });
}
