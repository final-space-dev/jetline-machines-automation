/**
 * Standardized API response helpers and error handling for all route handlers.
 * Replaces ad-hoc NextResponse.json() calls with consistent structure.
 */

import { NextResponse } from "next/server";

// ── Standard response envelope ────────────────────────────────────────────────

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json(data, { status: 201 });
}

export function notFound(message = "Not found"): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function serverError(err: unknown, context?: string): NextResponse {
  const message = err instanceof Error ? err.message : String(err);
  const label = context ? `[${context}]` : "[API]";
  console.error(`${label} ${message}`, err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

// ── Validated body parser ─────────────────────────────────────────────────────

export async function parseBody<T>(req: Request): Promise<T | null> {
  try {
    return await req.json() as T;
  } catch {
    return null;
  }
}

// ── Query param helpers ───────────────────────────────────────────────────────

export function getParam(url: URL, key: string): string | null {
  return url.searchParams.get(key);
}

export function getIntParam(url: URL, key: string, defaultVal: number, min = 1, max = Infinity): number {
  const raw = url.searchParams.get(key);
  if (!raw) return defaultVal;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) return defaultVal;
  return Math.min(max, Math.max(min, parsed));
}

// ── Pagination helpers ────────────────────────────────────────────────────────

export function paginate(url: URL, defaultLimit = 100) {
  const page = getIntParam(url, "page", 1);
  const limit = getIntParam(url, "limit", defaultLimit, 1, 500);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export function paginatedResponse<T>(rows: T[], total: number, page: number, limit: number) {
  return {
    rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  };
}

// ── Pool connection wrapper ───────────────────────────────────────────────────
// Ensures client is always released even on error.

import type { Pool, PoolClient } from "pg";

export async function withClient<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function withClients<T>(
  pools: Pool[],
  fn: (...clients: PoolClient[]) => Promise<T>
): Promise<T> {
  const clients = await Promise.all(pools.map((p) => p.connect()));
  try {
    return await fn(...clients);
  } finally {
    for (const c of clients) c.release();
  }
}

// ── Schema self-heal ──────────────────────────────────────────────────────────
// equipment.items is managed via raw SQL (not Prisma), and the Neon migration
// copied only a partial column set — core columns (notes, condition, located_at,
// photos, …) AND the later ERP/service columns are missing. Any query naming a
// missing column fails with 42703 "column does not exist", breaking item edit,
// item create, and CSV export. This idempotent guard declares the FULL expected
// shape (every column the API reads/writes) with ADD COLUMN IF NOT EXISTS, so it
// heals whatever is absent in one shot on first use. Column set is the authoritative
// contract from ALLOWED_FIELDS / the INSERT in /api/equipment. Runs before the
// affected queries. (Mirrors ensureActivitySchema() in /api/activity.)
export async function ensureItemColumns(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE equipment.items
      ADD COLUMN IF NOT EXISTS store            TEXT,
      ADD COLUMN IF NOT EXISTS machine_type     TEXT,
      ADD COLUMN IF NOT EXISTS make_model       TEXT,
      ADD COLUMN IF NOT EXISTS serial           TEXT,
      ADD COLUMN IF NOT EXISTS condition        TEXT,
      ADD COLUMN IF NOT EXISTS located_at       TEXT,
      ADD COLUMN IF NOT EXISTS status           TEXT DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS notes            TEXT,
      ADD COLUMN IF NOT EXISTS photos           TEXT[],
      ADD COLUMN IF NOT EXISTS purchase_date    DATE,
      ADD COLUMN IF NOT EXISTS supplier         TEXT,
      ADD COLUMN IF NOT EXISTS purchase_price   NUMERIC(12,2),
      ADD COLUMN IF NOT EXISTS warranty_expiry  DATE,
      ADD COLUMN IF NOT EXISTS last_serviced    DATE,
      ADD COLUMN IF NOT EXISTS next_service_due DATE,
      ADD COLUMN IF NOT EXISTS service_provider TEXT,
      ADD COLUMN IF NOT EXISTS replace_flag     TEXT,
      ADD COLUMN IF NOT EXISTS created_at       TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT NOW()
  `);
  // replace_flag is free-text ("yes"/"no") everywhere it's read (ILIKE '%yes%'
  // in SQL, .includes("yes") in JS). Repair it to TEXT if an earlier heal (or any
  // environment) created it as BOOLEAN — otherwise fleet-health's .toLowerCase()
  // throws and 'yes' writes fail. Idempotent: only alters when the type is wrong.
  await coerceReplaceFlagToText(client, "equipment", "items");
}

// Same self-heal for xerox.machine_feedback — the printer per-serial feedback
// columns (condition history, service dates, technician notes) can be absent on
// a freshly-provisioned database, so saving printer feedback would 42703. Creates
// the table if wholly missing, then adds each writable column idempotently. The
// column set mirrors FEEDBACK_FIELDS in /api/equipment/printers/[serial].
export async function ensureFeedbackColumns(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS xerox.machine_feedback (
      serial_number TEXT PRIMARY KEY
    )
  `);
  await client.query(`
    ALTER TABLE xerox.machine_feedback
      ADD COLUMN IF NOT EXISTS condition        TEXT,
      ADD COLUMN IF NOT EXISTS condition_notes  TEXT,
      ADD COLUMN IF NOT EXISTS replace_flag     TEXT,
      ADD COLUMN IF NOT EXISTS age              TEXT,
      ADD COLUMN IF NOT EXISTS install_date     DATE,
      ADD COLUMN IF NOT EXISTS contract_end     DATE,
      ADD COLUMN IF NOT EXISTS technician_notes TEXT,
      ADD COLUMN IF NOT EXISTS last_visit       DATE,
      ADD COLUMN IF NOT EXISTS notes            TEXT,
      ADD COLUMN IF NOT EXISTS supplier         TEXT,
      ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT NOW()
  `);
  await coerceReplaceFlagToText(client, "xerox", "machine_feedback");
}

// Idempotently ensure <schema>.<table>.replace_flag is TEXT. If a prior heal
// created it as BOOLEAN, convert in place (true->'yes', false->'no') and drop the
// NOT NULL/DEFAULT that the boolean version carried. No-op when already TEXT.
async function coerceReplaceFlagToText(client: PoolClient, schema: string, table: string): Promise<void> {
  const t = await client.query(
    `SELECT data_type FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2 AND column_name = 'replace_flag' LIMIT 1`,
    [schema, table]
  );
  if (t.rows[0]?.data_type === "boolean") {
    // ALTER … USING can't run inside a multi-statement string with the type probe,
    // so issue the conversion statements individually. Quote identifiers are static
    // (validated schema/table names from our own call sites), not user input.
    await client.query(
      `ALTER TABLE ${schema}.${table} ALTER COLUMN replace_flag DROP DEFAULT`
    );
    await client.query(
      `ALTER TABLE ${schema}.${table}
         ALTER COLUMN replace_flag TYPE TEXT
         USING (CASE WHEN replace_flag THEN 'yes' ELSE 'no' END)`
    );
    await client.query(
      `ALTER TABLE ${schema}.${table} ALTER COLUMN replace_flag DROP NOT NULL`
    );
  }
}
