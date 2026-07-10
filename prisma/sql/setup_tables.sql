-- Phase 05 — Setup / Admin Panel tables.
-- Live in the `bms` database (via bmsPool), schema `equipment`,
-- alongside equipment.items. NOT part of Prisma's jetline_machines schema.
-- Apply with: psql "$BMS_DATABASE_URL" -f webapp/prisma/sql/setup_tables.sql
-- Each /api/setup/* route also lazily runs the matching CREATE TABLE IF NOT EXISTS
-- and seeds defaults on first call, so this file is optional for self-healing.

CREATE SCHEMA IF NOT EXISTS equipment;

-- Equipment types (was the hardcoded EQUIPMENT_TYPES constant)
CREATE TABLE IF NOT EXISTS equipment.equipment_types (
  id         SERIAL PRIMARY KEY,
  name       TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Condition buckets (was the hardcoded classifyCondition keyword lists)
CREATE TABLE IF NOT EXISTS equipment.conditions (
  id       SERIAL PRIMARY KEY,
  label    TEXT NOT NULL,
  color    TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}'
);

-- Store group assignment (Main Group -> Store Group -> Store, plus holding group)
CREATE TABLE IF NOT EXISTS equipment.store_group_map (
  store         TEXT PRIMARY KEY,
  main_group    TEXT,
  store_group   TEXT,
  holding_group TEXT
);

-- Feature flags (moved out of localStorage so they are shared across users/devices)
CREATE TABLE IF NOT EXISTS equipment.feature_flags (
  key        TEXT PRIMARY KEY,
  enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
