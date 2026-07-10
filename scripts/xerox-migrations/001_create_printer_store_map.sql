CREATE TABLE IF NOT EXISTS xerox.printer_store_map (
  serial_number  TEXT        PRIMARY KEY,
  store          TEXT,
  company_group  TEXT,
  region         TEXT,
  updated_at     TIMESTAMP   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_psm_store         ON xerox.printer_store_map (store);
CREATE INDEX IF NOT EXISTS idx_psm_company_group ON xerox.printer_store_map (company_group);
CREATE INDEX IF NOT EXISTS idx_psm_region        ON xerox.printer_store_map (region);
