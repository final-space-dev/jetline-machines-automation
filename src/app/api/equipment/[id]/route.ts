import { NextRequest, NextResponse } from "next/server";
import { bmsPool } from "@/lib/bms-pool";
import { withClient, notFound, badRequest, serverError } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { requireUser, requireAdmin, AuthError, type SessionUser } from "@/lib/auth";

const ALLOWED_FIELDS = ["store", "machine_type", "make_model", "serial", "condition", "located_at", "status"];

// Store staff get full editing on their own store's equipment except `store`
// (reassigning to another store is admin-only).
const STAFF_FIELDS = new Set(ALLOWED_FIELDS.filter((f) => f !== "store"));

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user: SessionUser;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { id } = await params;
  const timer = routeTimer(`PATCH /api/equipment/${id}`);
  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");

  // Determine which fields this request wants to touch, for role scoping.
  const requestedFields: string[] = [];
  if (body.fields && typeof body.fields === "object") {
    requestedFields.push(...Object.keys(body.fields));
  } else if (body.field) {
    requestedFields.push(String(body.field));
  }

  // Store staff field-scoping: reject any field outside the staff-allowed set.
  if (user.role !== "admin") {
    for (const k of requestedFields) {
      if (!STAFF_FIELDS.has(k)) {
        return NextResponse.json({ error: "Forbidden: field not permitted for your role" }, { status: 403 });
      }
    }
  }

  return withClient(bmsPool, async (client) => {
    const updates: Record<string, string | null> = {};

    if (body.fields && typeof body.fields === "object") {
      for (const [k, v] of Object.entries(body.fields)) {
        if (ALLOWED_FIELDS.includes(k)) updates[k] = v as string | null;
      }
    } else if (body.field && ALLOWED_FIELDS.includes(body.field)) {
      updates[body.field] = body.value ?? null;
    }

    if (Object.keys(updates).length === 0) return badRequest("No valid fields to update");

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
    const setValues = Object.values(updates);
    const updated = await client.query(
      `UPDATE equipment.items SET ${setClauses.join(", ")}, updated_at = NOW() WHERE id = $${setValues.length + 1} RETURNING *`,
      [...setValues, id]
    );

    // Attribution comes ONLY from the authenticated session, never the request
    // body, so audit entries cannot be spoofed.
    const changed_by = user.email ?? user.name ?? String(user.id);
    for (const [field, newVal] of Object.entries(updates)) {
      const oldVal = old[field] ?? null;
      if (String(oldVal) !== String(newVal ?? "")) {
        await client.query(
          `INSERT INTO equipment.change_log (item_id, field, old_value, new_value, changed_by) VALUES ($1,$2,$3,$4,$5)`,
          [id, field, oldVal, newVal, changed_by]
        );
      }
    }

    timer.done({ id, fields: Object.keys(updates) });
    return NextResponse.json({ row: updated.rows[0] });
  }).catch((err) => { timer.error(err); return serverError(err, `PATCH /api/equipment/${id}`); });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { id } = await params;
  const timer = routeTimer(`DELETE /api/equipment/${id}`);
  return withClient(bmsPool, async (client) => {
    const result = await client.query(`DELETE FROM equipment.items WHERE id = $1 RETURNING id`, [id]);
    if (result.rowCount === 0) return notFound();
    timer.done({ id });
    return NextResponse.json({ ok: true });
  }).catch((err) => { timer.error(err); return serverError(err, `DELETE /api/equipment/${id}`); });
}
