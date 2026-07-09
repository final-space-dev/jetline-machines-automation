import { NextRequest, NextResponse } from "next/server";
import { bmsPool } from "@/lib/bms-pool";
import { withClient, badRequest, serverError } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { requireAdmin, AuthError } from "@/lib/auth";

/**
 * Phase 13 — CSV Import.
 *
 * POST /api/equipment/import (ADMIN ONLY)
 * Body: array of item objects (parsed client-side from CSV).
 *
 * Validates each row (store + machine_type required), inserts valid rows into
 * equipment.items, and writes a change_log 'created' row per insert with
 * changed_by = "csv_import".
 *
 * Returns: { imported: number, skipped: number, errors: [{ row, reason }] }
 */

// Columns accepted from an import row and inserted into equipment.items.
const INSERT_COLUMNS = [
  "store", "machine_type", "make_model", "serial", "condition",
  "located_at", "status", "purchase_date", "supplier",
  "purchase_price", "warranty_expiry",
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
    await requireAdmin();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const timer = routeTimer("POST /api/equipment/import");
  const body = await req.json().catch(() => null);
  if (!Array.isArray(body)) return badRequest("Body must be an array of item objects");

  const rows = body as ImportRow[];
  if (rows.length === 0) return badRequest("No rows to import");
  if (rows.length > 2000) return badRequest("Too many rows (max 2000 per import)");

  return withClient(bmsPool, async (client) => {
    let imported = 0;
    let skipped = 0;
    const errors: { row: number; reason: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const store = str(raw.store);
      const machine_type = str(raw.machine_type);

      if (!store || !machine_type) {
        skipped++;
        errors.push({ row: i + 1, reason: "store and machine_type are required" });
        continue;
      }

      const values = [
        store,
        machine_type,
        str(raw.make_model) || null,
        str(raw.serial) || null,
        normCondition(raw.condition),
        str(raw.located_at) || null,
        normStatus(raw.status),
        normDate(raw.purchase_date),
        str(raw.supplier) || null,
        normPrice(raw.purchase_price),
        normDate(raw.warranty_expiry),
      ];

      try {
        const inserted = await client.query(
          `INSERT INTO equipment.items (${INSERT_COLUMNS.join(", ")})
           VALUES (${INSERT_COLUMNS.map((_, idx) => `$${idx + 1}`).join(", ")})
           RETURNING id`,
          values
        );
        const id = Number(inserted.rows[0].id);
        await client.query(
          `INSERT INTO equipment.change_log (item_id, field, old_value, new_value, changed_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, "created", null, `${machine_type} @ ${store}`, "csv_import"]
        );
        imported++;
      } catch (rowErr) {
        skipped++;
        const reason = rowErr instanceof Error ? rowErr.message : "insert failed";
        errors.push({ row: i + 1, reason });
      }
    }

    timer.done({ imported, skipped, total: rows.length });
    return NextResponse.json({ imported, skipped, errors });
  }).catch((err) => { timer.error(err); return serverError(err, "POST /api/equipment/import"); });
}
