import { NextRequest, NextResponse } from "next/server";
import { bmsPool } from "@/lib/bms-pool";
import { withClient, notFound, badRequest, serverError, ensureItemColumns } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { requireUser, requireAdmin, AuthError, type SessionUser } from "@/lib/auth";

const ALLOWED_FIELDS = [
  "store", "machine_type", "make_model", "serial", "condition", "located_at", "status",
  "purchase_date", "supplier", "purchase_price", "warranty_expiry",
  "last_serviced", "next_service_due", "service_provider", "notes", "photos",
  // Optional column (present on prod; probed defensively by fleet-health). Kept
  // whitelisted so the staff "replace" capability in STAFF_FIELDS actually persists.
  "replace_flag",
];

// Fields a store_staff user is permitted to patch on their own store's items.
const STAFF_FIELDS = new Set(["condition", "notes", "replace_flag"]);

// Condition is stored as a bucket string. Accept the enum directly; normalize
// casing so "Good"/"good"/"GOOD" all persist as "Good".
const CONDITION_BUCKETS: Record<string, string> = { good: "Good", fair: "Fair", poor: "Poor" };

function normalizeCondition(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const key = v.trim().toLowerCase();
  return CONDITION_BUCKETS[key] ?? v;
}

function validId(id: string): boolean {
  return /^\d+$/.test(id) && parseInt(id) > 0;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user: SessionUser;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { id } = await params;
  if (!validId(id)) return notFound();
  const timer = routeTimer(`GET /api/equipment/items/${id}`);
  return withClient(bmsPool, async (client) => {
    await ensureItemColumns(client);
    const [item, logRows] = await Promise.all([
      client.query(`SELECT * FROM equipment.items WHERE id = $1`, [id]),
      client.query(
        `SELECT field, old_value, new_value, changed_by, changed_at
         FROM equipment.change_log WHERE item_id = $1 ORDER BY changed_at DESC LIMIT 50`,
        [id]
      ),
    ]);
    if (item.rows.length === 0) return notFound();
    // Store staff may only view items belonging to their own store.
    if (user.role !== "admin" && item.rows[0].store !== user.store) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    timer.done({ id });
    return NextResponse.json({ item: item.rows[0], log: logRows.rows });
  }).catch((err) => { timer.error(err); return serverError(err, `GET /api/equipment/items/${id}`); });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user: SessionUser;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { id } = await params;
  if (!validId(id)) return notFound();
  const timer = routeTimer(`PATCH /api/equipment/items/${id}`);
  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");

  // Store staff field-scoping: reject any field outside the staff-allowed set.
  if (user.role !== "admin") {
    for (const k of Object.keys(body)) {
      if (k === "_changed_by") continue;
      if (!STAFF_FIELDS.has(k)) {
        return NextResponse.json({ error: "Forbidden: field not permitted for your role" }, { status: 403 });
      }
    }
  }

  return withClient(bmsPool, async (client) => {
    await ensureItemColumns(client);

    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (k === "_changed_by" || !ALLOWED_FIELDS.includes(k)) continue;
      updates[k] = k === "condition" ? normalizeCondition(v ?? null) : (v ?? null);
    }
    if (Object.keys(updates).length === 0) return badRequest("No valid fields");

    const current = await client.query(
      `SELECT ${ALLOWED_FIELDS.join(", ")} FROM equipment.items WHERE id = $1`, [id]
    );
    if (current.rows.length === 0) return notFound();
    const old = current.rows[0];

    // Store staff may only edit items belonging to their own store.
    if (user.role !== "admin" && old.store !== user.store) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`);
    const updated = await client.query(
      `UPDATE equipment.items SET ${setClauses.join(", ")}, updated_at = NOW()
       WHERE id = $${Object.keys(updates).length + 1} RETURNING *`,
      [...Object.values(updates), id]
    );

    // Audit log — one row per changed field. Attribution comes ONLY from the
    // authenticated session, never the request body, so it cannot be spoofed.
    const changed_by = user.email ?? user.name ?? String(user.id);
    for (const [field, newVal] of Object.entries(updates)) {
      const oldVal = old[field] ?? null;
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal ?? null)) {
        await client.query(
          `INSERT INTO equipment.change_log (item_id, field, old_value, new_value, changed_by)
           VALUES ($1,$2,$3,$4,$5)`,
          [id, field, oldVal === null ? null : String(oldVal), newVal === null ? null : String(newVal), changed_by]
        );
      }
    }

    timer.done({ id, fields: Object.keys(updates) });
    return NextResponse.json({ item: updated.rows[0] });
  }).catch((err) => { timer.error(err); return serverError(err, `PATCH /api/equipment/items/${id}`); });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { id } = await params;
  if (!validId(id)) return notFound();
  const timer = routeTimer(`DELETE /api/equipment/items/${id}`);
  return withClient(bmsPool, async (client) => {
    const result = await client.query(`DELETE FROM equipment.items WHERE id = $1 RETURNING id`, [id]);
    if (result.rowCount === 0) return notFound();
    timer.done({ id });
    return NextResponse.json({ ok: true });
  }).catch((err) => { timer.error(err); return serverError(err, `DELETE /api/equipment/items/${id}`); });
}
