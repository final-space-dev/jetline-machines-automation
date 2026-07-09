import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { bmsPool } from "@/lib/bms-pool";
import { withClient, badRequest, serverError } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { STORE_GROUPS } from "@/lib/store-groups";
import { requireAdmin, AuthError } from "@/lib/auth";

/**
 * Store group hierarchy — THREE-LEVEL model with per-store active toggle.
 *
 * Hierarchy (top -> bottom): Holding Group -> Store Group -> Group -> Store.
 *   holding_group : top-level owning entity   (source `holdingGroup`)
 *   store_group   : mid-level cluster         (source `storeGroup`)
 *   "group"       : third grouping bucket     (source `mainGroup`)
 *   store         : leaf / primary key        (source `store`)
 *   active        : per-store on/off toggle   (default true)
 *
 * Table: equipment.store_group_map in the `bms` database (bmsPool).
 * See prisma/sql/store_groups.sql for the standalone migration note.
 */

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
 * Lazily create the 3-level table (or upgrade an older 2-col version in place),
 * then seed from the STORE_GROUPS constant when the table is empty.
 */
async function ensureTable(client: PoolClient) {
  await client.query(`CREATE SCHEMA IF NOT EXISTS equipment`);

  // Fresh (3-level) table.
  await client.query(
    `CREATE TABLE IF NOT EXISTS equipment.store_group_map (
       store         TEXT PRIMARY KEY,
       holding_group TEXT,
       store_group   TEXT,
       "group"       TEXT,
       active        BOOLEAN     DEFAULT true,
       updated_at    TIMESTAMPTZ DEFAULT NOW()
     )`
  );

  // Upgrade path: an older 2-col version lacked holding_group / "group" / active.
  // Add each missing column so both fresh and legacy tables end up 3-level.
  await client.query(`ALTER TABLE equipment.store_group_map ADD COLUMN IF NOT EXISTS holding_group TEXT`);
  await client.query(`ALTER TABLE equipment.store_group_map ADD COLUMN IF NOT EXISTS store_group   TEXT`);
  await client.query(`ALTER TABLE equipment.store_group_map ADD COLUMN IF NOT EXISTS "group"       TEXT`);
  await client.query(`ALTER TABLE equipment.store_group_map ADD COLUMN IF NOT EXISTS active        BOOLEAN     DEFAULT true`);
  await client.query(`ALTER TABLE equipment.store_group_map ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT NOW()`);

  // Backfill "group" from a legacy `main_group` column if it still exists.
  await client.query(
    `DO $$
     BEGIN
       IF EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'equipment'
           AND table_name   = 'store_group_map'
           AND column_name  = 'main_group'
       ) THEN
         EXECUTE 'UPDATE equipment.store_group_map SET "group" = main_group WHERE "group" IS NULL';
       END IF;
     END $$`
  );

  const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM equipment.store_group_map`);
  if (rows[0].n === 0) {
    for (const e of STORE_GROUPS) {
      // Source `holdingGroup`/`mainGroup` are the same top-level entity in the
      // seed data; map holdingGroup -> holding_group, storeGroup -> store_group,
      // and the third grouping (mainGroup) -> "group".
      await client.query(
        `INSERT INTO equipment.store_group_map (store, holding_group, store_group, "group", active)
         VALUES ($1, $2, $3, $4, true) ON CONFLICT (store) DO NOTHING`,
        [e.store, e.holdingGroup, e.storeGroup, e.mainGroup]
      );
    }
  }
}

// Row shape returned to the client (camelCase, `group` last).
const SELECT_COLS = `store,
                     holding_group AS "holdingGroup",
                     store_group   AS "storeGroup",
                     "group"       AS "group",
                     active`;

export async function GET() {
  const gate = await adminGate();
  if (gate) return gate;
  const timer = routeTimer("GET /api/setup/store-groups");
  return withClient(bmsPool, async (client) => {
    await ensureTable(client);
    const { rows } = await client.query(
      `SELECT ${SELECT_COLS}
       FROM equipment.store_group_map
       ORDER BY holding_group, store_group, store`
    );
    timer.done({ total: rows.length });
    return NextResponse.json({ rows });
  }).catch((err) => { timer.error(err); return serverError(err, "GET /api/setup/store-groups"); });
}

// Upsert a store's group assignment and/or active flag. Only the fields present
// in the body are written; the store row is created if it does not yet exist.
export async function PATCH(req: NextRequest) {
  const gate = await adminGate();
  if (gate) return gate;
  const timer = routeTimer("PATCH /api/setup/store-groups");
  const body = await req.json().catch(() => null);
  const store = typeof body?.store === "string" ? body.store.trim() : "";
  if (!store) return badRequest("store is required");

  // Collect the provided group fields (string -> trimmed or null).
  const groupCols: { col: string; value: string | null }[] = [];
  if (typeof body?.holdingGroup === "string") groupCols.push({ col: "holding_group", value: body.holdingGroup.trim() || null });
  if (typeof body?.storeGroup === "string") groupCols.push({ col: "store_group", value: body.storeGroup.trim() || null });
  if (typeof body?.group === "string") groupCols.push({ col: `"group"`, value: body.group.trim() || null });

  const hasActive = typeof body?.active === "boolean";
  if (groupCols.length === 0 && !hasActive) {
    return badRequest("No fields to update (holdingGroup, storeGroup, group, or active)");
  }

  return withClient(bmsPool, async (client) => {
    await ensureTable(client);

    // Column/value lists for the INSERT, plus the DO UPDATE SET clause so the
    // same request works whether or not the store row already exists.
    const cols: string[] = ["store"];
    const values: unknown[] = [store];
    const updates: string[] = [];

    for (const { col, value } of groupCols) {
      values.push(value);
      cols.push(col);
      updates.push(`${col} = EXCLUDED.${col}`);
    }
    if (hasActive) {
      values.push(body.active as boolean);
      cols.push("active");
      updates.push(`active = EXCLUDED.active`);
    }
    updates.push(`updated_at = NOW()`);

    const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
    const { rows } = await client.query(
      `INSERT INTO equipment.store_group_map (${cols.join(", ")})
       VALUES (${placeholders})
       ON CONFLICT (store) DO UPDATE SET ${updates.join(", ")}
       RETURNING ${SELECT_COLS}`,
      values
    );

    timer.done({ store });
    return NextResponse.json({ row: rows[0] });
  }).catch((err) => { timer.error(err); return serverError(err, "PATCH /api/setup/store-groups"); });
}
