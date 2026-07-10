/**
 * Phase 20 — Tenant onboarding script (schema-per-tenant).
 *
 * Idempotent. Given a tenant id it:
 *   1. CREATE SCHEMA equipment_<id>            (IF NOT EXISTS)
 *   2. Runs the equipment DDL into that schema (items, change_log,
 *      printer_change_log, stores, equipment_types, conditions,
 *      store_group_map, feature_flags, models) — all IF NOT EXISTS.
 *   3. Seeds default equipment_types + conditions.
 *   4. Creates an admin user (Prisma, jetline_machines.users) tagged with the
 *      tenant id, so the future `tenant_id` JWT claim resolves to this schema
 *      (see src/lib/tenant.ts). A nullable `tenant_id` column is added to
 *      users IF NOT EXISTS — non-breaking for the single-tenant app.
 *
 * The base DDL mirrors what the /api/setup/* and /api/equipment/* routes create
 * lazily in the `equipment` schema; here it is emitted into equipment_<id>.
 *
 * Run:
 *   cd webapp
 *   TENANT_ID=acme \
 *   TENANT_ADMIN_EMAIL=admin@acme.local \
 *   TENANT_ADMIN_PASSWORD='<strong>' \
 *   TENANT_ADMIN_NAME='Acme Admin' \
 *   npx tsx scripts/create-tenant.ts
 *
 * Env:
 *   TENANT_ID              required  lower snake_case (^[a-z0-9_]+$)
 *   TENANT_ADMIN_EMAIL     required
 *   TENANT_ADMIN_PASSWORD  required
 *   TENANT_ADMIN_NAME      default: "Tenant Admin"
 */

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const SCHEMA_RE = /^[a-z0-9_]+$/;

const DEFAULT_EQUIPMENT_TYPES = [
  "Printer",
  "Copier",
  "Guillotine",
  "Laminator",
  "Binder",
  "Folder",
  "Plotter",
  "Computer",
  "Other",
];

const DEFAULT_CONDITIONS: Array<{ label: string; color: string; keywords: string[] }> = [
  { label: "Good", color: "#16a34a", keywords: ["good", "excellent", "working", "new"] },
  { label: "Fair", color: "#d97706", keywords: ["fair", "ok", "average", "used"] },
  { label: "Poor", color: "#dc2626", keywords: ["poor", "broken", "faulty", "old", "needs repair"] },
];

/** Full equipment DDL for a tenant schema. All statements are IF NOT EXISTS. */
function tenantDdl(schema: string): string {
  return `
    CREATE SCHEMA IF NOT EXISTS ${schema};

    CREATE TABLE IF NOT EXISTS ${schema}.items (
      id              SERIAL PRIMARY KEY,
      store           TEXT NOT NULL,
      machine_type    TEXT NOT NULL,
      make_model      TEXT,
      serial          TEXT,
      condition       TEXT,
      located_at      TEXT,
      status          TEXT DEFAULT 'active',
      model_id        INTEGER,
      purchase_date   DATE,
      supplier        TEXT,
      purchase_price  NUMERIC,
      warranty_expiry DATE,
      updated_at      TIMESTAMPTZ DEFAULT NOW(),
      created_at      TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ${schema}.change_log (
      id         SERIAL PRIMARY KEY,
      item_id    INTEGER,
      field      TEXT NOT NULL,
      old_value  TEXT,
      new_value  TEXT,
      changed_by TEXT DEFAULT 'user',
      changed_at TIMESTAMPTZ DEFAULT NOW(),
      user_id    INTEGER,
      user_name  TEXT,
      item_type  TEXT DEFAULT 'equipment',
      store      TEXT
    );

    CREATE TABLE IF NOT EXISTS ${schema}.printer_change_log (
      id         SERIAL PRIMARY KEY,
      serial     TEXT NOT NULL,
      store      TEXT,
      field      TEXT NOT NULL,
      old_value  TEXT,
      new_value  TEXT,
      user_name  TEXT DEFAULT 'user',
      changed_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ${schema}.stores (
      name          TEXT PRIMARY KEY,
      main_group    TEXT,
      store_group   TEXT,
      holding_group TEXT,
      address       TEXT,
      phone         TEXT,
      manager_name  TEXT,
      manager_email TEXT,
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ${schema}.equipment_types (
      id         SERIAL PRIMARY KEY,
      name       TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ${schema}.conditions (
      id       SERIAL PRIMARY KEY,
      label    TEXT NOT NULL,
      color    TEXT NOT NULL,
      keywords TEXT[] DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS ${schema}.store_group_map (
      store         TEXT PRIMARY KEY,
      main_group    TEXT,
      store_group   TEXT,
      holding_group TEXT
    );

    CREATE TABLE IF NOT EXISTS ${schema}.feature_flags (
      key        TEXT PRIMARY KEY,
      enabled    BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ${schema}.models (
      id              SERIAL PRIMARY KEY,
      name            TEXT NOT NULL,
      manufacturer    TEXT,
      equipment_type  TEXT NOT NULL,
      year_introduced INTEGER,
      notes           TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(name, equipment_type)
    );

    CREATE INDEX IF NOT EXISTS idx_${schema}_change_log_changed_at
      ON ${schema}.change_log (changed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_${schema}_change_log_store
      ON ${schema}.change_log (store);
    CREATE INDEX IF NOT EXISTS idx_${schema}_printer_change_log_changed_at
      ON ${schema}.printer_change_log (changed_at DESC);
  `;
}

async function main() {
  const tenantId = (process.env.TENANT_ID || "").trim().toLowerCase();
  if (!tenantId) throw new Error("TENANT_ID is required");

  const schema = `equipment_${tenantId}`;
  if (!SCHEMA_RE.test(schema)) {
    throw new Error(`Invalid TENANT_ID '${tenantId}' — must match ^[a-z0-9_]+$ once prefixed`);
  }

  const email = (process.env.TENANT_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.TENANT_ADMIN_PASSWORD || "";
  const name = process.env.TENANT_ADMIN_NAME || "Tenant Admin";
  if (!email) throw new Error("TENANT_ADMIN_EMAIL is required");
  if (!password) throw new Error("TENANT_ADMIN_PASSWORD is required");

  // ── 1-3: schema + DDL + seeds (bms DB via a dedicated pool) ────────────────
  const bmsPool = new Pool({
    host: process.env.BMS_DB_HOST || "localhost",
    port: Number(process.env.BMS_DB_PORT || 5432),
    database: process.env.BMS_DB_NAME || "bms",
    user: process.env.BMS_DB_USER || "postgres",
    password: process.env.BMS_DB_PASSWORD || "j3tl1n3@26",
    max: 2,
  });

  const client = await bmsPool.connect();
  try {
    await client.query(tenantDdl(schema));

    // Seed equipment types (idempotent).
    for (const t of DEFAULT_EQUIPMENT_TYPES) {
      await client.query(
        `INSERT INTO ${schema}.equipment_types (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
        [t]
      );
    }

    // Seed conditions only when the table is empty (no natural unique key).
    const condCount = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM ${schema}.conditions`
    );
    if (Number(condCount.rows[0]?.count ?? 0) === 0) {
      for (const c of DEFAULT_CONDITIONS) {
        await client.query(
          `INSERT INTO ${schema}.conditions (label, color, keywords) VALUES ($1, $2, $3)`,
          [c.label, c.color, c.keywords]
        );
      }
    }

    console.log(`Schema ready: ${schema} (types + conditions seeded)`);
  } finally {
    client.release();
    await bmsPool.end();
  }

  // ── 4: admin user (Prisma jetline_machines) tagged with tenant id ──────────
  const prisma = new PrismaClient();
  try {
    // Non-breaking, nullable tenant_id column for tenant→schema resolution.
    await prisma.$executeRawUnsafe(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id TEXT`
    );

    const hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.upsert({
      where: { email },
      update: { role: "admin" }, // never clobber an existing password on re-run
      create: { email, password: hash, name, role: "admin", store: null },
    });

    await prisma.$executeRawUnsafe(
      `UPDATE users SET tenant_id = $1 WHERE id = $2`,
      tenantId,
      user.id
    );

    console.log(
      `Tenant admin ready: ${user.email} (id=${user.id}, tenant_id=${tenantId})`
    );
  } finally {
    await prisma.$disconnect();
  }

  console.log(`Tenant '${tenantId}' provisioned → schema ${schema}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
