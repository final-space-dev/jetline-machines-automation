/**
 * Standardized API response helpers and error handling for all route handlers.
 * Replaces ad-hoc NextResponse.json() calls with consistent structure.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { z } from "zod";

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

/**
 * Parse + validate a JSON body against a zod schema in one step. Returns either
 * `{ data }` (typed, validated) or `{ error }` (a ready-to-return 400 response
 * with a compact field-level message). Keeps route handlers thin:
 *
 *   const parsed = await validateBody(req, MySchema);
 *   if (parsed.error) return parsed.error;
 *   const { field } = parsed.data;
 */
export async function validateBody<S extends z.ZodTypeAny>(
  req: NextRequest | Request,
  schema: S,
): Promise<{ data: z.infer<S>; error?: never } | { data?: never; error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { error: badRequest("Invalid JSON body") };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    // First issue is enough for a human-friendly message; full list in `fields`.
    const issues = result.error.issues;
    const first = issues[0];
    const path = first?.path.join(".") || "body";
    return {
      error: NextResponse.json(
        { error: `${path}: ${first?.message ?? "invalid"}`, fields: issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
        { status: 400 },
      ),
    };
  }
  return { data: result.data };
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

// ── Store-feedback schema (comments + replacement requests) ───────────────────
// Two shared tables serving BOTH entity types via a polymorphic key:
//   entity_type: 'equipment' (ref = items.id) | 'printer' (ref = serial_number)
// Comments are an immutable, attributed, timestamped log ("constant commentary").
// Replacement requests replace the old replace_flag entirely — a store REQUESTS a
// replacement with a motivation; admins triage via status. Idempotent self-heal.
export async function ensureFeedbackTables(client: PoolClient): Promise<void> {
  await client.query(`CREATE SCHEMA IF NOT EXISTS equipment`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS equipment.machine_comments (
      id          SERIAL PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_ref  TEXT NOT NULL,
      store       TEXT,
      body        TEXT NOT NULL,
      author_id   TEXT,
      author_name TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS machine_comments_entity_idx
      ON equipment.machine_comments (entity_type, entity_ref, created_at DESC)
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS equipment.replacement_requests (
      id            SERIAL PRIMARY KEY,
      entity_type   TEXT NOT NULL,
      entity_ref    TEXT NOT NULL,
      store         TEXT,
      item_label    TEXT,
      motivation    TEXT NOT NULL,
      urgency       TEXT NOT NULL DEFAULT 'medium',
      status        TEXT NOT NULL DEFAULT 'open',
      requested_by_id   TEXT,
      requested_by_name TEXT,
      response_note TEXT,
      responded_by  TEXT,
      responded_at  TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Ownership — an admin can take/assign a request so it's not an anonymous queue.
  await client.query(`
    ALTER TABLE equipment.replacement_requests
      ADD COLUMN IF NOT EXISTS assigned_to_id   TEXT,
      ADD COLUMN IF NOT EXISTS assigned_to_name TEXT
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS replacement_requests_status_idx
      ON equipment.replacement_requests (status, created_at DESC)
  `);
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
      ADD COLUMN IF NOT EXISTS created_at       TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT NOW(),
      -- Soft delete: DELETE sets deleted_at; reads filter it out; recoverable.
      ADD COLUMN IF NOT EXISTS deleted_at       TIMESTAMPTZ
  `);
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
      ADD COLUMN IF NOT EXISTS age              TEXT,
      ADD COLUMN IF NOT EXISTS install_date     DATE,
      ADD COLUMN IF NOT EXISTS contract_end     DATE,
      ADD COLUMN IF NOT EXISTS technician_notes TEXT,
      ADD COLUMN IF NOT EXISTS last_visit       DATE,
      ADD COLUMN IF NOT EXISTS notes            TEXT,
      ADD COLUMN IF NOT EXISTS supplier         TEXT,
      ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT NOW()
  `);
}

// NOTE: replace_flag is fully deprecated (superseded by equipment.replacement_
// requests). The schema self-heals above no longer create or touch it, so it
// won't appear on fresh environments. Existing replace_flag columns are left in
// place (harmless — nothing reads them) and can be dropped in a deliberate
// destructive migration later if desired.
