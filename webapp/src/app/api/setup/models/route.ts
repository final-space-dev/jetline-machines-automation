import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { bmsPool } from "@/lib/bms-pool";
import { withClient, badRequest, notFound, serverError } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { requireAdmin, AuthError } from "@/lib/auth";

/** Admin gate: returns a 401/403 response if not an admin, else null. */
async function adminGate(): Promise<NextResponse | null> {
  try {
    await requireAdmin();
    return null;
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

/**
 * Lazily create equipment.models + the items.model_id link column, and seed
 * the catalogue from existing distinct (make_model, machine_type) values on
 * first run. Self-heals without a prod migration.
 */
async function ensureTable(client: PoolClient) {
  await client.query(`CREATE SCHEMA IF NOT EXISTS equipment`);
  await client.query(
    `CREATE TABLE IF NOT EXISTS equipment.models (
       id              SERIAL PRIMARY KEY,
       name            TEXT NOT NULL,
       manufacturer    TEXT,
       equipment_type  TEXT NOT NULL,
       year_introduced INTEGER,
       notes           TEXT,
       created_at      TIMESTAMPTZ DEFAULT NOW(),
       UNIQUE(name, equipment_type)
     )`
  );
  await client.query(`ALTER TABLE equipment.items ADD COLUMN IF NOT EXISTS model_id INTEGER`);
  const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM equipment.models`);
  if (rows[0].n === 0) {
    await client.query(
      `INSERT INTO equipment.models (name, equipment_type)
       SELECT DISTINCT btrim(make_model) AS name, machine_type AS equipment_type
       FROM equipment.items
       WHERE make_model IS NOT NULL AND btrim(make_model) <> ''
         AND machine_type IS NOT NULL AND btrim(machine_type) <> ''
       ON CONFLICT (name, equipment_type) DO NOTHING`
    );
  }
}

function validId(id: unknown): id is number {
  return typeof id === "number" && Number.isInteger(id) && id > 0;
}

/** Coerce a year field to an int in a sane range, else null. */
function parseYear(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  if (!Number.isInteger(n) || n < 1800 || n > 2100) return null;
  return n;
}

const SELECT_WITH_COUNT = `
  SELECT m.id, m.name, m.manufacturer, m.equipment_type,
         m.year_introduced, m.notes, m.created_at,
         COALESCE(c.count, 0)::int AS item_count
  FROM equipment.models m
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS count
    FROM equipment.items i
    WHERE i.model_id = m.id OR (i.model_id IS NULL AND btrim(i.make_model) = m.name)
  ) c ON TRUE
`;

export async function GET() {
  const gate = await adminGate();
  if (gate) return gate;
  const timer = routeTimer("GET /api/setup/models");
  return withClient(bmsPool, async (client) => {
    await ensureTable(client);
    const { rows } = await client.query(
      `${SELECT_WITH_COUNT} ORDER BY m.name, m.equipment_type`
    );
    timer.done({ total: rows.length });
    return NextResponse.json({ rows });
  }).catch((err) => { timer.error(err); return serverError(err, "GET /api/setup/models"); });
}

export async function POST(req: NextRequest) {
  const gate = await adminGate();
  if (gate) return gate;
  const timer = routeTimer("POST /api/setup/models");
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const equipment_type = typeof body?.equipment_type === "string" ? body.equipment_type.trim() : "";
  const manufacturer = typeof body?.manufacturer === "string" ? body.manufacturer.trim() : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
  const year_introduced = parseYear(body?.year_introduced);
  if (!name) return badRequest("name is required");
  if (!equipment_type) return badRequest("equipment_type is required");

  return withClient(bmsPool, async (client) => {
    await ensureTable(client);
    const { rows } = await client.query(
      `INSERT INTO equipment.models (name, manufacturer, equipment_type, year_introduced, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (name, equipment_type) DO NOTHING
       RETURNING id`,
      [name, manufacturer || null, equipment_type, year_introduced, notes || null]
    );
    if (rows.length === 0) {
      return NextResponse.json(
        { error: `A model named "${name}" already exists under ${equipment_type}` },
        { status: 409 }
      );
    }
    const full = await client.query(`${SELECT_WITH_COUNT} WHERE m.id = $1`, [rows[0].id]);
    timer.done({ name, equipment_type });
    return NextResponse.json({ row: full.rows[0] }, { status: 201 });
  }).catch((err) => { timer.error(err); return serverError(err, "POST /api/setup/models"); });
}

export async function PATCH(req: NextRequest) {
  const gate = await adminGate();
  if (gate) return gate;
  const timer = routeTimer("PATCH /api/setup/models");
  const body = await req.json().catch(() => null);
  const id = body?.id;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const equipment_type = typeof body?.equipment_type === "string" ? body.equipment_type.trim() : "";
  const manufacturer = typeof body?.manufacturer === "string" ? body.manufacturer.trim() : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
  const year_introduced = parseYear(body?.year_introduced);
  if (!validId(id)) return badRequest("valid id is required");
  if (!name) return badRequest("name is required");
  if (!equipment_type) return badRequest("equipment_type is required");

  return withClient(bmsPool, async (client) => {
    await ensureTable(client);
    const current = await client.query(
      `SELECT name FROM equipment.models WHERE id = $1`, [id]
    );
    if (current.rows.length === 0) return notFound();

    const dupe = await client.query(
      `SELECT 1 FROM equipment.models
       WHERE name = $1 AND equipment_type = $2 AND id <> $3`,
      [name, equipment_type, id]
    );
    if (dupe.rows.length > 0) {
      return NextResponse.json(
        { error: `A model named "${name}" already exists under ${equipment_type}` },
        { status: 409 }
      );
    }

    await client.query(
      `UPDATE equipment.models
       SET name = $1, manufacturer = $2, equipment_type = $3,
           year_introduced = $4, notes = $5
       WHERE id = $6`,
      [name, manufacturer || null, equipment_type, year_introduced, notes || null, id]
    );
    const full = await client.query(`${SELECT_WITH_COUNT} WHERE m.id = $1`, [id]);
    timer.done({ id, name });
    return NextResponse.json({ row: full.rows[0] });
  }).catch((err) => { timer.error(err); return serverError(err, "PATCH /api/setup/models"); });
}

export async function DELETE(req: NextRequest) {
  const gate = await adminGate();
  if (gate) return gate;
  const timer = routeTimer("DELETE /api/setup/models");
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!validId(id)) return badRequest("valid id is required");

  return withClient(bmsPool, async (client) => {
    await ensureTable(client);
    const current = await client.query(
      `SELECT name FROM equipment.models WHERE id = $1`, [id]
    );
    if (current.rows.length === 0) return notFound();
    const name = current.rows[0].name as string;

    // Detach any items that link to this model before removing it.
    await client.query(`UPDATE equipment.items SET model_id = NULL WHERE model_id = $1`, [id]);
    await client.query(`DELETE FROM equipment.models WHERE id = $1`, [id]);
    timer.done({ id, name });
    return NextResponse.json({ ok: true });
  }).catch((err) => { timer.error(err); return serverError(err, "DELETE /api/setup/models"); });
}
