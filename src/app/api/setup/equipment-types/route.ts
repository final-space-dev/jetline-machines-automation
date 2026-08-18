import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { bmsPool } from "@/lib/bms-pool";
import { withClient, badRequest, notFound, serverError } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { requireAnyCapability, AuthError } from "@/lib/auth";

/**
 * Capability gate: admins + custom users holding Equipment Types OR Models (the
 * Models panel reads equipment types). Returns a 401/403 response, else null.
 */
async function adminGate(): Promise<NextResponse | null> {
  try {
    await requireAnyCapability(["config:equipment-types", "config:models"]);
    return null;
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

/** Lazily create the table and seed from existing distinct machine_type values. */
async function ensureTable(client: PoolClient) {
  await client.query(`CREATE SCHEMA IF NOT EXISTS equipment`);
  await client.query(
    `CREATE TABLE IF NOT EXISTS equipment.equipment_types (
       id         SERIAL PRIMARY KEY,
       name       TEXT UNIQUE NOT NULL,
       created_at TIMESTAMPTZ DEFAULT NOW()
     )`
  );
  const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM equipment.equipment_types`);
  if (rows[0].n === 0) {
    await client.query(
      `INSERT INTO equipment.equipment_types (name)
       SELECT DISTINCT machine_type FROM equipment.items
       WHERE machine_type IS NOT NULL AND btrim(machine_type) <> ''
       ON CONFLICT (name) DO NOTHING`
    );
  }
}

function validId(id: unknown): id is number {
  return typeof id === "number" && Number.isInteger(id) && id > 0;
}

export async function GET() {
  const gate = await adminGate();
  if (gate) return gate;
  const timer = routeTimer("GET /api/setup/equipment-types");
  return withClient(bmsPool, async (client) => {
    await ensureTable(client);
    const { rows } = await client.query(
      `SELECT t.id, t.name, t.created_at,
              COALESCE(c.count, 0)::int AS count
       FROM equipment.equipment_types t
       LEFT JOIN (
         SELECT machine_type, COUNT(*) AS count
         FROM equipment.items
         GROUP BY machine_type
       ) c ON c.machine_type = t.name
       ORDER BY t.name`
    );
    timer.done({ total: rows.length });
    return NextResponse.json({ rows });
  }).catch((err) => { timer.error(err); return serverError(err, "GET /api/setup/equipment-types"); });
}

export async function POST(req: NextRequest) {
  const gate = await adminGate();
  if (gate) return gate;
  const timer = routeTimer("POST /api/setup/equipment-types");
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return badRequest("name is required");

  return withClient(bmsPool, async (client) => {
    await ensureTable(client);
    const { rows } = await client.query(
      `INSERT INTO equipment.equipment_types (name) VALUES ($1)
       ON CONFLICT (name) DO NOTHING
       RETURNING id, name, created_at`,
      [name]
    );
    if (rows.length === 0) return badRequest("A type with that name already exists");
    timer.done({ name });
    return NextResponse.json({ row: { ...rows[0], count: 0 } }, { status: 201 });
  }).catch((err) => { timer.error(err); return serverError(err, "POST /api/setup/equipment-types"); });
}

export async function PATCH(req: NextRequest) {
  const gate = await adminGate();
  if (gate) return gate;
  const timer = routeTimer("PATCH /api/setup/equipment-types");
  const body = await req.json().catch(() => null);
  const id = body?.id;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!validId(id)) return badRequest("valid id is required");
  if (!name) return badRequest("name is required");

  return withClient(bmsPool, async (client) => {
    await ensureTable(client);
    const current = await client.query(
      `SELECT name FROM equipment.equipment_types WHERE id = $1`, [id]
    );
    if (current.rows.length === 0) return notFound();
    const oldName = current.rows[0].name as string;

    const dupe = await client.query(
      `SELECT 1 FROM equipment.equipment_types WHERE name = $1 AND id <> $2`, [name, id]
    );
    if (dupe.rows.length > 0) return badRequest("A type with that name already exists");

    const { rows } = await client.query(
      `UPDATE equipment.equipment_types SET name = $1 WHERE id = $2
       RETURNING id, name, created_at`,
      [name, id]
    );
    // Keep existing items pointing at the renamed type.
    if (oldName !== name) {
      await client.query(
        `UPDATE equipment.items SET machine_type = $1 WHERE machine_type = $2`,
        [name, oldName]
      );
    }
    timer.done({ id, name });
    return NextResponse.json({ row: rows[0] });
  }).catch((err) => { timer.error(err); return serverError(err, "PATCH /api/setup/equipment-types"); });
}

export async function DELETE(req: NextRequest) {
  const gate = await adminGate();
  if (gate) return gate;
  const timer = routeTimer("DELETE /api/setup/equipment-types");
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!validId(id)) return badRequest("valid id is required");

  return withClient(bmsPool, async (client) => {
    await ensureTable(client);
    const current = await client.query(
      `SELECT name FROM equipment.equipment_types WHERE id = $1`, [id]
    );
    if (current.rows.length === 0) return notFound();
    const name = current.rows[0].name as string;

    const used = await client.query(
      `SELECT COUNT(*)::int AS n FROM equipment.items WHERE machine_type = $1`, [name]
    );
    if (used.rows[0].n > 0) {
      return badRequest(`Cannot delete: ${used.rows[0].n} item(s) still use this type`);
    }

    await client.query(`DELETE FROM equipment.equipment_types WHERE id = $1`, [id]);
    timer.done({ id, name });
    return NextResponse.json({ ok: true });
  }).catch((err) => { timer.error(err); return serverError(err, "DELETE /api/setup/equipment-types"); });
}
