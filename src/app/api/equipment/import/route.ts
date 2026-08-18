import { NextRequest, NextResponse } from "next/server";
import { bmsPool } from "@/lib/bms-pool";
import { withClient, badRequest, serverError, ensureItemColumns } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { requireCapability, AuthError } from "@/lib/auth";

/**
 * Equipment mass-import (ADMIN ONLY) — the CRM bulk-load tool under Config.
 *
 * POST /api/equipment/import
 * Body: { rows: item[], mode?: "create" | "upsert" }
 *   (a bare array is also accepted and treated as create mode, for back-compat)
 *
 * Every equipment attribute is importable EXCEPT images. In "upsert" mode a row
 * whose `serial` matches an existing item UPDATES it; otherwise it's created.
 * Each write logs a change_log row with changed_by = "csv_import".
 *
 * Returns: { imported, updated, skipped, errors: [{ row, reason }] }
 */

// Every writable equipment.items attribute (matches the create route / template).
const IMPORT_COLUMNS = [
  "store", "machine_type", "make_model", "serial", "condition",
  "located_at", "status", "purchase_date", "supplier", "purchase_price",
  "warranty_expiry", "last_serviced", "next_service_due", "service_provider", "notes",
] as const;

type ImportRow = Record<string, unknown>;

const CONDITION_BUCKETS: Record<string, string> = { good: "Good", fair: "Fair", poor: "Poor" };
const VALID_STATUSES = new Set(["active", "inactive", "disposed", "transferred"]);

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function normStatus(v: unknown): string {
  const s = str(v).toLowerCase();
  return VALID_STATUSES.has(s) ? s : "active";
}

function normCondition(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  return CONDITION_BUCKETS[s.toLowerCase()] ?? s;
}

// Accept YYYY-MM-DD (or anything Date can parse) and return YYYY-MM-DD, else null.
function normDate(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normPrice(v: unknown): number | null {
  const s = str(v).replace(/[, ]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: NextRequest) {
  try {
    await requireCapability("config:import");
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const timer = routeTimer("POST /api/equipment/import");
  const body = await req.json().catch(() => null);
  // Accept { rows, mode } or a bare array (legacy) treated as create mode.
  const rows: ImportRow[] = Array.isArray(body) ? body : Array.isArray(body?.rows) ? body.rows : [];
  const mode: "create" | "upsert" = body?.mode === "upsert" ? "upsert" : "create";
  if (rows.length === 0) return badRequest("No rows to import");
  if (rows.length > 2000) return badRequest("Too many rows (max 2000 per import)");

  // Normalize one import row into { column: value } for all IMPORT_COLUMNS.
  const normalizeRow = (raw: ImportRow): Record<string, unknown> => ({
    store: str(raw.store),
    machine_type: str(raw.machine_type),
    make_model: str(raw.make_model) || null,
    serial: str(raw.serial) || null,
    condition: normCondition(raw.condition),
    located_at: str(raw.located_at) || null,
    status: normStatus(raw.status),
    purchase_date: normDate(raw.purchase_date),
    supplier: str(raw.supplier) || null,
    purchase_price: normPrice(raw.purchase_price),
    warranty_expiry: normDate(raw.warranty_expiry),
    last_serviced: normDate(raw.last_serviced),
    next_service_due: normDate(raw.next_service_due),
    service_provider: str(raw.service_provider) || null,
    notes: str(raw.notes) || null,
  });

  return withClient(bmsPool, async (client) => {
    // Self-heal the schema so a freshly-provisioned DB has every column.
    await ensureItemColumns(client);

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors: { row: number; reason: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const v = normalizeRow(rows[i]);
      const store = v.store as string;
      const machine_type = v.machine_type as string;
      const serial = v.serial as string | null;

      if (!store || !machine_type) {
        skipped++;
        errors.push({ row: i + 1, reason: "store and machine_type are required" });
        continue;
      }

      try {
        // Upsert: if a serial is given and matches an existing item, UPDATE it;
        // otherwise INSERT. Serial is not a DB unique key, so match explicitly.
        let existingId: number | null = null;
        if (mode === "upsert" && serial) {
          const found = await client.query(
            `SELECT id FROM equipment.items WHERE serial = $1 ORDER BY id LIMIT 1`,
            [serial]
          );
          existingId = found.rows[0]?.id ?? null;
        }

        if (existingId != null) {
          const cols = [...IMPORT_COLUMNS];
          const setSql = cols.map((c, idx) => `${c} = $${idx + 1}`).join(", ");
          await client.query(
            `UPDATE equipment.items SET ${setSql}, updated_at = NOW() WHERE id = $${cols.length + 1}`,
            [...cols.map((c) => v[c]), existingId]
          );
          await client.query(
            `INSERT INTO equipment.change_log (item_id, field, old_value, new_value, changed_by)
             VALUES ($1, $2, $3, $4, $5)`,
            [existingId, "updated", null, `${machine_type} @ ${store}`, "csv_import"]
          );
          updated++;
        } else {
          const cols = [...IMPORT_COLUMNS];
          const inserted = await client.query(
            `INSERT INTO equipment.items (${cols.join(", ")})
             VALUES (${cols.map((_, idx) => `$${idx + 1}`).join(", ")})
             RETURNING id`,
            cols.map((c) => v[c])
          );
          const id = Number(inserted.rows[0].id);
          await client.query(
            `INSERT INTO equipment.change_log (item_id, field, old_value, new_value, changed_by)
             VALUES ($1, $2, $3, $4, $5)`,
            [id, "created", null, `${machine_type} @ ${store}`, "csv_import"]
          );
          imported++;
        }
      } catch (rowErr) {
        skipped++;
        const reason = rowErr instanceof Error ? rowErr.message : "write failed";
        errors.push({ row: i + 1, reason });
      }
    }

    timer.done({ imported, updated, skipped, total: rows.length });
    return NextResponse.json({ imported, updated, skipped, errors });
  }).catch((err) => { timer.error(err); return serverError(err, "POST /api/equipment/import"); });
}
