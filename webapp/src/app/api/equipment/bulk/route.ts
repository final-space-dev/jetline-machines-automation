import { NextRequest, NextResponse } from "next/server";
import { bmsPool } from "@/lib/bms-pool";
import { withClient, badRequest, serverError } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { requireAdmin, AuthError, type SessionUser } from "@/lib/auth";

/**
 * Phase 13 — Bulk Operations.
 *
 * PATCH /api/equipment/bulk (ADMIN ONLY)
 * Body: { ids: number[], field: string, value: string }
 *
 * Two variants:
 *  - Update:  field in BULK_FIELDS -> UPDATE ... WHERE id = ANY($ids),
 *             one change_log row per id (old -> new).
 *  - Delete:  field === "__delete__" (sentinel) -> DELETE ... WHERE id = ANY($ids),
 *             one change_log 'deleted' row per id (old_value = prior status, new_value = null).
 *
 * Returns: { updated: number, errors: [] }
 */

// Fields admins may set in bulk. Deliberately narrow (no free-text/date columns).
const BULK_FIELDS = new Set(["status", "condition", "store", "machine_type"]);

const DELETE_SENTINEL = "__delete__";

const CONDITION_BUCKETS: Record<string, string> = { good: "Good", fair: "Fair", poor: "Poor" };

function normalizeValue(field: string, v: unknown): string {
  const s = typeof v === "string" ? v.trim() : String(v ?? "");
  if (field === "condition") {
    return CONDITION_BUCKETS[s.toLowerCase()] ?? s;
  }
  return s;
}

function sanitizeIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  for (const v of raw) {
    const n = typeof v === "number" ? v : parseInt(String(v), 10);
    if (Number.isInteger(n) && n > 0) out.push(n);
  }
  return [...new Set(out)];
}

export async function PATCH(req: NextRequest) {
  let user: SessionUser;
  try {
    user = await requireAdmin();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const timer = routeTimer("PATCH /api/equipment/bulk");
  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");

  const ids = sanitizeIds(body.ids);
  if (ids.length === 0) return badRequest("ids must be a non-empty array of positive integers");

  const field = typeof body.field === "string" ? body.field : "";
  if (!field) return badRequest("field is required");

  const isDelete = field === DELETE_SENTINEL;
  if (!isDelete && !BULK_FIELDS.has(field)) {
    return badRequest(`field must be one of: ${[...BULK_FIELDS].join(", ")}, or "${DELETE_SENTINEL}"`);
  }

  const value = isDelete ? "" : normalizeValue(field, body.value);
  if (!isDelete && value.length === 0) return badRequest("value is required");

  const changed_by = user.name || user.email || "admin";

  return withClient(bmsPool, async (client) => {
    // Load existing rows so we can validate ids and capture old values for the log.
    const existing = await client.query(
      `SELECT id, status, ${field === DELETE_SENTINEL ? "status" : field} AS field_value
       FROM equipment.items WHERE id = ANY($1::int[])`,
      [ids]
    );
    const foundIds = existing.rows.map((r) => Number(r.id));
    if (foundIds.length === 0) return badRequest("No matching items found");

    const oldByField = new Map<number, unknown>(
      existing.rows.map((r) => [Number(r.id), r.field_value])
    );

    if (isDelete) {
      const del = await client.query(
        `DELETE FROM equipment.items WHERE id = ANY($1::int[]) RETURNING id`,
        [foundIds]
      );
      for (const r of del.rows) {
        const id = Number(r.id);
        const priorStatus = oldByField.get(id);
        await client.query(
          `INSERT INTO equipment.change_log (item_id, field, old_value, new_value, changed_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, "deleted", priorStatus == null ? null : String(priorStatus), null, changed_by]
        );
      }
      timer.done({ deleted: del.rowCount, requested: ids.length });
      return NextResponse.json({ updated: del.rowCount ?? 0, errors: [] });
    }

    await client.query(
      `UPDATE equipment.items SET ${field} = $1, updated_at = NOW() WHERE id = ANY($2::int[])`,
      [value, foundIds]
    );

    for (const id of foundIds) {
      const oldVal = oldByField.get(id);
      if (String(oldVal ?? "") === value) continue;
      await client.query(
        `INSERT INTO equipment.change_log (item_id, field, old_value, new_value, changed_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, field, oldVal == null ? null : String(oldVal), value, changed_by]
      );
    }

    timer.done({ updated: foundIds.length, field, requested: ids.length });
    return NextResponse.json({ updated: foundIds.length, errors: [] });
  }).catch((err) => { timer.error(err); return serverError(err, "PATCH /api/equipment/bulk"); });
}
