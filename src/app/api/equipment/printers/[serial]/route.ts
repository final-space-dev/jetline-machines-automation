import { NextRequest, NextResponse } from "next/server";
import { xeroxPool } from "@/lib/xerox-pool";
import { bmsPool } from "@/lib/bms-pool";
import { withClient, notFound, badRequest, serverError, ensureFeedbackColumns } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { requireUser, AuthError, getSessionUser, type SessionUser } from "@/lib/auth";

const FEEDBACK_FIELDS = [
  "condition", "condition_notes", "age",
  "install_date", "contract_end", "technician_notes", "last_visit",
  "supplier",
];

// Store staff do NOT edit printer feedback fields directly — printers are a
// managed asset. Staff interact with printers only via comments and replacement
// requests (separate /api/feedback/* endpoints). So no printer feedback field is
// staff-writable; this PATCH is effectively admin-only for the machine record.
const STAFF_FEEDBACK_FIELDS = new Set<string>();

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
    // color_capable / duplex_capable aren't present in every printer_dimensions
    // (the Neon ETL doesn't populate them) — selecting them directly 42703'd and
    // bounced the whole page. Probe for them and fall back to NULL so the page
    // shows those fields blank instead of erroring.
    const capCols = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'xerox' AND table_name = 'printer_dimensions'
         AND column_name IN ('color_capable','duplex_capable')`
    );
    const hasCap = new Set(capCols.rows.map((r) => r.column_name as string));
    const colorExpr = hasCap.has("color_capable") ? "pd.color_capable" : "NULL::boolean AS color_capable";
    const duplexExpr = hasCap.has("duplex_capable") ? "pd.duplex_capable" : "NULL::boolean AS duplex_capable";

    const [dim, map, feedback, history] = await Promise.all([
      client.query(
        `SELECT pd.serial_number, pd.model, pd.manufacturer, pd.last_seen::text,
                ${colorExpr}, ${duplexExpr}
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
      // meter_readings_normalised is long-format (printer_id, report_date,
      // meter_type, reading) — NOT wide. Join via printer_id (the table has no
      // serial_number) and pivot the meter types into the total/black/colour/a3/
      // large columns the printer page expects. This is the fix for the 500 that
      // was bouncing the printer page back to /equipment.
      client.query(
        `SELECT
           r.report_date::text AS report_date,
           SUM(r.reading)::bigint AS total,
           SUM(r.reading) FILTER (WHERE r.meter_type = 'black_impressions')::bigint       AS black,
           SUM(r.reading) FILTER (WHERE r.meter_type = 'color_impressions')::bigint       AS colour,
           SUM(r.reading) FILTER (WHERE r.meter_type = 'black_large_impressions')::bigint AS a3,
           SUM(r.reading) FILTER (WHERE r.meter_type = 'color_large_impressions')::bigint AS large
         FROM xerox.meter_readings_normalised r
         JOIN xerox.printer_dimensions pd ON pd.printer_id = r.printer_id
         WHERE UPPER(TRIM(pd.serial_number)) = $1
           AND r.meter_type IN
             ('black_impressions','color_impressions','black_large_impressions','color_large_impressions')
           AND r.reading IS NOT NULL
           AND r.report_date >= CURRENT_DATE - INTERVAL '6 months'
         GROUP BY r.report_date
         ORDER BY r.report_date DESC LIMIT 30`,
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
    await ensureFeedbackColumns(client);

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
