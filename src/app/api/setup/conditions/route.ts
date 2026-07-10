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

/** Lazily create the table and seed Good/Fair/Poor defaults. */
async function ensureTable(client: PoolClient) {
  await client.query(`CREATE SCHEMA IF NOT EXISTS equipment`);
  await client.query(
    `CREATE TABLE IF NOT EXISTS equipment.conditions (
       id       SERIAL PRIMARY KEY,
       label    TEXT NOT NULL,
       color    TEXT NOT NULL,
       keywords TEXT[] DEFAULT '{}'
     )`
  );
  const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM equipment.conditions`);
  if (rows[0].n === 0) {
    await client.query(
      `INSERT INTO equipment.conditions (label, color, keywords) VALUES
         ('Good', 'green', $1),
         ('Fair', 'amber', $2),
         ('Poor', 'red',   $3)`,
      [
        ["excellent", "new", "perfect", "good", "neat", "reliable", "working order", "operational"],
        ["fair", "old", "average", "okay", "used", "below avg", "time for replacement"],
        ["not working", "broken", "not operational", "not in use", "poor", "repair", "disposed", "0%"],
      ]
    );
  }
}

function validId(id: unknown): id is number {
  return typeof id === "number" && Number.isInteger(id) && id > 0;
}

const COLORS = ["green", "amber", "red", "blue", "grey"];

function normKeywords(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map((k) => String(k).trim().toLowerCase()).filter(Boolean);
  }
  if (typeof input === "string") {
    return input.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
  }
  return [];
}

export async function GET() {
  const gate = await adminGate();
  if (gate) return gate;
  const timer = routeTimer("GET /api/setup/conditions");
  return withClient(bmsPool, async (client) => {
    await ensureTable(client);
    const { rows } = await client.query(
      `SELECT id, label, color, keywords FROM equipment.conditions ORDER BY id`
    );
    timer.done({ total: rows.length });
    return NextResponse.json({ rows });
  }).catch((err) => { timer.error(err); return serverError(err, "GET /api/setup/conditions"); });
}

export async function POST(req: NextRequest) {
  const gate = await adminGate();
  if (gate) return gate;
  const timer = routeTimer("POST /api/setup/conditions");
  const body = await req.json().catch(() => null);
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  const color = typeof body?.color === "string" && COLORS.includes(body.color) ? body.color : "grey";
  const keywords = normKeywords(body?.keywords);
  if (!label) return badRequest("label is required");

  return withClient(bmsPool, async (client) => {
    await ensureTable(client);
    const { rows } = await client.query(
      `INSERT INTO equipment.conditions (label, color, keywords) VALUES ($1, $2, $3)
       RETURNING id, label, color, keywords`,
      [label, color, keywords]
    );
    timer.done({ label });
    return NextResponse.json({ row: rows[0] }, { status: 201 });
  }).catch((err) => { timer.error(err); return serverError(err, "POST /api/setup/conditions"); });
}

export async function PATCH(req: NextRequest) {
  const gate = await adminGate();
  if (gate) return gate;
  const timer = routeTimer("PATCH /api/setup/conditions");
  const body = await req.json().catch(() => null);
  const id = body?.id;
  if (!validId(id)) return badRequest("valid id is required");

  const sets: string[] = [];
  const values: unknown[] = [];
  if (typeof body?.label === "string" && body.label.trim()) {
    values.push(body.label.trim()); sets.push(`label = $${values.length}`);
  }
  if (typeof body?.color === "string" && COLORS.includes(body.color)) {
    values.push(body.color); sets.push(`color = $${values.length}`);
  }
  if (body?.keywords !== undefined) {
    values.push(normKeywords(body.keywords)); sets.push(`keywords = $${values.length}`);
  }
  if (sets.length === 0) return badRequest("No valid fields");

  return withClient(bmsPool, async (client) => {
    await ensureTable(client);
    values.push(id);
    const { rows } = await client.query(
      `UPDATE equipment.conditions SET ${sets.join(", ")} WHERE id = $${values.length}
       RETURNING id, label, color, keywords`,
      values
    );
    if (rows.length === 0) return notFound();
    timer.done({ id });
    return NextResponse.json({ row: rows[0] });
  }).catch((err) => { timer.error(err); return serverError(err, "PATCH /api/setup/conditions"); });
}

export async function DELETE(req: NextRequest) {
  const gate = await adminGate();
  if (gate) return gate;
  const timer = routeTimer("DELETE /api/setup/conditions");
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!validId(id)) return badRequest("valid id is required");

  return withClient(bmsPool, async (client) => {
    await ensureTable(client);
    const result = await client.query(
      `DELETE FROM equipment.conditions WHERE id = $1 RETURNING id`, [id]
    );
    if (result.rowCount === 0) return notFound();
    timer.done({ id });
    return NextResponse.json({ ok: true });
  }).catch((err) => { timer.error(err); return serverError(err, "DELETE /api/setup/conditions"); });
}
