import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { bmsPool } from "@/lib/bms-pool";
import { withClient, badRequest, notFound, serverError } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { requireAdmin, requireUser, AuthError } from "@/lib/auth";

/**
 * Suppliers — a shared CRM picklist used by BOTH equipment and printers to record
 * where an item was bought. GET is available to any signed-in user (so the item /
 * printer pages can populate their supplier dropdown); writes are admin-only.
 *
 * Table: equipment.suppliers (bms DB). On first load it seeds itself from any
 * existing free-text equipment.items.supplier values so nothing already captured
 * is lost.
 */

async function adminGate(): Promise<NextResponse | null> {
  try {
    await requireAdmin();
    return null;
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

async function ensureTable(client: PoolClient) {
  await client.query(`CREATE SCHEMA IF NOT EXISTS equipment`);
  await client.query(
    `CREATE TABLE IF NOT EXISTS equipment.suppliers (
       id         SERIAL PRIMARY KEY,
       name       TEXT NOT NULL,
       contact    TEXT,
       phone      TEXT,
       email      TEXT,
       notes      TEXT,
       created_at TIMESTAMPTZ DEFAULT NOW()
     )`
  );
  // Case-insensitive uniqueness on name so we never seed / create duplicates.
  await client.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS suppliers_name_lower_idx
       ON equipment.suppliers (LOWER(name))`
  );
  // Seed from existing free-text supplier values on equipment.items (one-time;
  // ON CONFLICT keeps it idempotent). Guarded so a missing column can't error.
  const hasCol = await client.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema='equipment' AND table_name='items' AND column_name='supplier' LIMIT 1`
  );
  if (hasCol.rows.length > 0) {
    await client.query(
      `INSERT INTO equipment.suppliers (name)
       SELECT DISTINCT TRIM(supplier) FROM equipment.items
       WHERE supplier IS NOT NULL AND TRIM(supplier) <> ''
       ON CONFLICT (LOWER(name)) DO NOTHING`
    );
  }
}

function validId(id: unknown): id is number {
  return typeof id === "number" && Number.isInteger(id) && id > 0;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

const SELECT_COLS = `id, name, contact, phone, email, notes`;

// GET — any signed-in user (needed to populate supplier dropdowns).
export async function GET() {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const timer = routeTimer("GET /api/setup/suppliers");
  return withClient(bmsPool, async (client) => {
    await ensureTable(client);
    const { rows } = await client.query(
      `SELECT ${SELECT_COLS} FROM equipment.suppliers ORDER BY name`
    );
    timer.done({ total: rows.length });
    return NextResponse.json({ rows });
  }).catch((err) => { timer.error(err); return serverError(err, "GET /api/setup/suppliers"); });
}

// POST — create a supplier (admin only).
export async function POST(req: NextRequest) {
  const gate = await adminGate();
  if (gate) return gate;
  const timer = routeTimer("POST /api/setup/suppliers");
  const body = await req.json().catch(() => null);
  const name = str(body?.name);
  if (!name) return badRequest("name is required");

  return withClient(bmsPool, async (client) => {
    await ensureTable(client);
    try {
      const { rows } = await client.query(
        `INSERT INTO equipment.suppliers (name, contact, phone, email, notes)
         VALUES ($1, $2, $3, $4, $5) RETURNING ${SELECT_COLS}`,
        [name, str(body?.contact) || null, str(body?.phone) || null, str(body?.email) || null, str(body?.notes) || null]
      );
      timer.done({ id: rows[0].id });
      return NextResponse.json({ row: rows[0] }, { status: 201 });
    } catch (e) {
      // Unique-violation on name -> friendly 409.
      if (e && typeof e === "object" && (e as { code?: string }).code === "23505") {
        return NextResponse.json({ error: "A supplier with that name already exists" }, { status: 409 });
      }
      throw e;
    }
  }).catch((err) => { timer.error(err); return serverError(err, "POST /api/setup/suppliers"); });
}

// PATCH — update a supplier (admin only). Body: { id, ...fields }.
export async function PATCH(req: NextRequest) {
  const gate = await adminGate();
  if (gate) return gate;
  const timer = routeTimer("PATCH /api/setup/suppliers");
  const body = await req.json().catch(() => null);
  const id = body?.id;
  if (!validId(id)) return badRequest("valid id is required");

  const sets: string[] = [];
  const values: unknown[] = [];
  for (const f of ["name", "contact", "phone", "email", "notes"] as const) {
    if (typeof body?.[f] === "string") {
      values.push(f === "name" ? str(body[f]) : str(body[f]) || null);
      sets.push(`${f} = $${values.length}`);
    }
  }
  if (sets.length === 0) return badRequest("No fields to update");
  values.push(id);

  return withClient(bmsPool, async (client) => {
    await ensureTable(client);
    const { rows } = await client.query(
      `UPDATE equipment.suppliers SET ${sets.join(", ")} WHERE id = $${values.length} RETURNING ${SELECT_COLS}`,
      values
    );
    if (rows.length === 0) return notFound();
    timer.done({ id });
    return NextResponse.json({ row: rows[0] });
  }).catch((err) => { timer.error(err); return serverError(err, "PATCH /api/setup/suppliers"); });
}

// DELETE — remove a supplier (admin only). Body: { id }.
export async function DELETE(req: NextRequest) {
  const gate = await adminGate();
  if (gate) return gate;
  const timer = routeTimer("DELETE /api/setup/suppliers");
  const body = await req.json().catch(() => null);
  const id = body?.id;
  if (!validId(id)) return badRequest("valid id is required");

  return withClient(bmsPool, async (client) => {
    await ensureTable(client);
    const { rowCount } = await client.query(`DELETE FROM equipment.suppliers WHERE id = $1`, [id]);
    if (rowCount === 0) return notFound();
    timer.done({ id });
    return NextResponse.json({ ok: true });
  }).catch((err) => { timer.error(err); return serverError(err, "DELETE /api/setup/suppliers"); });
}
