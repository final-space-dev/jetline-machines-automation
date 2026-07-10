-- Store group hierarchy — THREE-LEVEL model with per-store active toggle.
-- Lives in the `bms` database (via bmsPool), schema `equipment`,
-- alongside equipment.items / equipment.stores. NOT part of Prisma's
-- jetline_machines schema.
--
-- Hierarchy (top -> bottom): Holding Group -> Store Group -> Group -> Store.
--   holding_group : top-level owning entity (e.g. "JEH Stores")
--   store_group   : mid-level cluster      (e.g. "Copper Moon")
--   "group"       : third grouping bucket   (source `mainGroup`)
--   store         : leaf, primary key       (e.g. "Alberton")
--   active        : per-store on/off toggle (default true)
--
-- Apply with: psql "$BMS_DATABASE_URL" -f webapp/prisma/sql/store_groups.sql
-- The /api/setup/store-groups route also lazily runs this (create-if-missing,
-- add-columns-if-missing, seed-if-empty) on first GET/PATCH call, so applying
-- this file by hand is optional.

CREATE SCHEMA IF NOT EXISTS equipment;

-- Fresh (3-level) table.
CREATE TABLE IF NOT EXISTS equipment.store_group_map (
  store         TEXT PRIMARY KEY,
  holding_group TEXT,
  store_group   TEXT,
  "group"       TEXT,
  active        BOOLEAN     DEFAULT true,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Upgrade path: an earlier 2-col version had (store, main_group, store_group,
-- holding_group) and no on/off toggle. Add the new columns if they are missing.
-- The old `main_group` column is left in place (backfilled into "group" below);
-- dropping it is optional and left to the operator.
ALTER TABLE equipment.store_group_map ADD COLUMN IF NOT EXISTS holding_group TEXT;
ALTER TABLE equipment.store_group_map ADD COLUMN IF NOT EXISTS store_group   TEXT;
ALTER TABLE equipment.store_group_map ADD COLUMN IF NOT EXISTS "group"       TEXT;
ALTER TABLE equipment.store_group_map ADD COLUMN IF NOT EXISTS active        BOOLEAN     DEFAULT true;
ALTER TABLE equipment.store_group_map ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT NOW();

-- Backfill "group" from the legacy main_group column if it still exists and
-- "group" is empty (no-op on fresh installs — guarded by information_schema).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'equipment'
      AND table_name   = 'store_group_map'
      AND column_name  = 'main_group'
  ) THEN
    EXECUTE 'UPDATE equipment.store_group_map SET "group" = main_group WHERE "group" IS NULL';
  END IF;
END $$;

-- Seeding of rows from the STORE_GROUPS constant is handled by the route on
-- first request (INSERT ... ON CONFLICT DO NOTHING), so no seed data here.
