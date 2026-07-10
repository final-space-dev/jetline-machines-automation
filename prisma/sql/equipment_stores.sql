-- Phase 04 — Store identity table.
-- Lives in the `bms` database (via bmsPool), schema `equipment`,
-- alongside equipment.items. NOT part of Prisma's jetline_machines schema.
-- Apply with: psql "$BMS_DATABASE_URL" -f webapp/prisma/sql/equipment_stores.sql
-- The GET /api/stores/[store] route also lazily runs this (create-if-missing) on first call.

CREATE SCHEMA IF NOT EXISTS equipment;

CREATE TABLE IF NOT EXISTS equipment.stores (
  name TEXT PRIMARY KEY,
  main_group TEXT,
  store_group TEXT,
  holding_group TEXT,
  address TEXT,
  phone TEXT,
  manager_name TEXT,
  manager_email TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
