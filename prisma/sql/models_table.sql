-- Phase 08 — Machine Model Catalogue.
-- Lives in the `bms` database (via bmsPool), schema `equipment`,
-- alongside equipment.items. NOT part of Prisma's jetline_machines schema.
-- Apply with: psql "$BMS_DATABASE_URL" -f webapp/prisma/sql/models_table.sql
-- Both /api/setup/models and /api/equipment/models also lazily run these
-- statements on first call, so this file is optional for self-healing.

CREATE SCHEMA IF NOT EXISTS equipment;

-- Canonical machine model catalogue.
CREATE TABLE IF NOT EXISTS equipment.models (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,           -- "Polar Mohr 76 EM"
  manufacturer    TEXT,                    -- "Polar Mohr"
  equipment_type  TEXT NOT NULL,           -- FK-like to equipment.equipment_types.name
  year_introduced INTEGER,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, equipment_type)
);

-- Link existing items to a catalogue model. make_model TEXT is kept as a
-- legacy free-text fallback for records that predate the catalogue.
ALTER TABLE equipment.items ADD COLUMN IF NOT EXISTS model_id INTEGER;

-- Seed the catalogue from existing distinct make_model values, using each
-- item's machine_type as the best-guess equipment_type. Runs only when empty.
INSERT INTO equipment.models (name, equipment_type)
SELECT DISTINCT btrim(make_model) AS name, machine_type AS equipment_type
FROM equipment.items
WHERE make_model IS NOT NULL AND btrim(make_model) <> ''
  AND machine_type IS NOT NULL AND btrim(machine_type) <> ''
ON CONFLICT (name, equipment_type) DO NOTHING;
