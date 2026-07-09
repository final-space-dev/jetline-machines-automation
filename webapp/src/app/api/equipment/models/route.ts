import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { bmsPool } from "@/lib/bms-pool";
import { withClient, serverError } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { requireUser, AuthError } from "@/lib/auth";

/**
 * Lazily create equipment.models + the items.model_id link column so the
 * autosuggest self-heals even before /api/setup/models is first called.
 * Kept intentionally light: no seeding here (that happens in the setup route).
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
}

/**
 * Autosuggest for model names.
 * GET /api/equipment/models?q=term&type=Guillotine -> { models: string[] }.
 * Queries the canonical equipment.models catalogue, optionally filtered by
 * equipment_type. Falls back to distinct equipment.items.make_model when the
 * catalogue is empty so existing consumers keep working before seeding.
 */
export async function GET(req: NextRequest) {
  // Model autosuggest is used by store staff on the add-equipment form;
  // require an authenticated user (any role).
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const timer = routeTimer("GET /api/equipment/models");
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  const type = (req.nextUrl.searchParams.get("type") ?? "").trim().slice(0, 100);

  return withClient(bmsPool, async (client) => {
    await ensureTable(client);

    const conditions: string[] = [];
    const values: string[] = [];
    if (q) { values.push(`%${q}%`); conditions.push(`name ILIKE $${values.length}`); }
    if (type) { values.push(type); conditions.push(`equipment_type = $${values.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const catalogue = await client.query<{ name: string }>(
      `SELECT DISTINCT name FROM equipment.models ${where} ORDER BY name LIMIT 20`,
      values
    );

    let models = catalogue.rows.map((r) => r.name);

    // Fallback: catalogue empty -> distinct make_model from items.
    if (models.length === 0) {
      const fbConditions: string[] = [
        `make_model IS NOT NULL`,
        `btrim(make_model) <> ''`,
      ];
      const fbValues: string[] = [];
      if (q) { fbValues.push(`%${q}%`); fbConditions.push(`make_model ILIKE $${fbValues.length}`); }
      if (type) { fbValues.push(type); fbConditions.push(`machine_type = $${fbValues.length}`); }
      const fallback = await client.query<{ make_model: string }>(
        `SELECT DISTINCT make_model FROM equipment.items
         WHERE ${fbConditions.join(" AND ")}
         ORDER BY make_model LIMIT 20`,
        fbValues
      );
      models = fallback.rows.map((r) => r.make_model);
    }

    timer.done({ q, type, count: models.length });
    return NextResponse.json({ models });
  }).catch((err) => { timer.error(err); return serverError(err, "GET /api/equipment/models"); });
}
