-- Phase 11 — Activity Feed & Audit Trail
-- Target DB: bms (bmsPool). Idempotent — safe to run repeatedly.
-- The /api/activity route and the printer PATCH also run these lazily
-- (IF NOT EXISTS) so the schema self-heals in any environment.

-- Extend the existing equipment.change_log with actor + denormalized filter columns.
ALTER TABLE equipment.change_log
  ADD COLUMN IF NOT EXISTS user_id   INTEGER,
  ADD COLUMN IF NOT EXISTS user_name TEXT,
  ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'equipment',
  ADD COLUMN IF NOT EXISTS store     TEXT;

-- New: printer feedback change log (mirrors equipment.change_log shape).
CREATE TABLE IF NOT EXISTS equipment.printer_change_log (
  id         SERIAL PRIMARY KEY,
  serial     TEXT NOT NULL,
  store      TEXT,
  field      TEXT NOT NULL,
  old_value  TEXT,
  new_value  TEXT,
  user_name  TEXT DEFAULT 'user',
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes to keep the global feed and today-count fast.
CREATE INDEX IF NOT EXISTS idx_change_log_changed_at
  ON equipment.change_log (changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_change_log_store
  ON equipment.change_log (store);
CREATE INDEX IF NOT EXISTS idx_printer_change_log_changed_at
  ON equipment.printer_change_log (changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_printer_change_log_store
  ON equipment.printer_change_log (store);
