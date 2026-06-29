# Dagster Pipeline Brief: BMS Machine Registry Sync

**Project:** Jetline Machines Automation  
**Date:** 2026-06-29  
**Author:** Claude (on behalf of Alwyn Kotze)  
**Target Dagster project:** `xerox_meters` pipeline (or new job within it)

---

## Purpose

Provide the Jetline Machines operational system with a clean, authoritative registry of which machines exist in BMS, what they're called, and where they are.

**This is identity data only — not readings.** All volume/meter readings come exclusively from the Xerox pipeline already running in Dagster. Do not sync meter counters, rates, or volumes.

---

## What We Need From BMS (Per Machine, Per Company)

```sql
-- Run against each company's BMS MySQL instance (schema: e.g. menlynbms2)
SELECT
    serialnumber,           -- matches Xerox serial_number
    machinename,            -- BMS internal name
    machine_make_name,      -- filter: only 'Xerox'
    machine_model_name,     -- raw BMS model string
    machinestatus,          -- 1 = active, 0 = inactive
    installeddate,          -- date machine was installed at this store
    sitelocationname        -- BMS store/site name
FROM machines
WHERE machinestatus = 1     -- ONLY active machines
  AND serialnumber IS NOT NULL
  AND serialnumber != ''
  AND machine_make_name = 'Xerox'
```

---

## Where To Write It

**Target database:** `jetline_machines` PostgreSQL on `172.20.246.163`  
**Target table:** `public.machines` (Prisma-managed, already exists)

**Upsert logic:**

```sql
INSERT INTO public.machines (
    id,
    serial_number,
    bms_status,
    model_name,
    installed_date,
    bms_site_name,
    company_id,
    updated_at
)
VALUES (
    gen_random_uuid(),
    <serialnumber>,
    <machinestatus>,          -- 1 or 0
    <machine_model_name>,
    <installeddate>,
    <sitelocationname>,
    <company UUID>,           -- looked up by bms_schema, see below
    NOW()
)
ON CONFLICT (serial_number) DO UPDATE SET
    bms_status     = EXCLUDED.bms_status,
    model_name     = EXCLUDED.model_name,
    installed_date = EXCLUDED.installed_date,
    bms_site_name  = EXCLUDED.bms_site_name,
    company_id     = EXCLUDED.company_id,
    updated_at     = NOW();
```

**Note on `company_id`:** Look up the UUID from `public.companies` by matching `bms_schema`. Example: for the company row where `bms_schema = 'menlynbms2'`, use its `id` as the `company_id`.

---

## Where To Get The BMS Connection Config

Dagster reads the list of active BMS companies directly from the same PostgreSQL database it writes to — no hardcoded store list needed.

```sql
SELECT
    id,
    name,
    bms_schema,    -- e.g. 'menlynbms2' → MySQL database name
    bms_host,      -- e.g. 'menlyn.jetlinestores.co.za' (may be NULL — see derivation below)
    is_active
FROM public.companies
WHERE is_active = true
```

### Host Derivation Rule

If `bms_host` is NULL, derive it from `bms_schema`:

```
menlynbms2       → menlyn.jetlinestores.co.za
waterfrontbms2   → waterfront.jetlinestores.co.za
diebultbms2      → diebult.jetlinestores.co.za
```

Strip the `bms2` suffix, append `.jetlinestores.co.za`.

**Exception — Fixtrade:** Always use IP, never derive from schema:
```
bms_schema = 'nscbms2'  →  host = 172.20.251.127  (hardcoded)
```

### BMS MySQL Credentials (Same For All Stores)

```
user:     fortyone
password: fo123@!
port:     3306
database: <bms_schema value from companies table>
```

---

## What To Write After Each Run

After each company sync, write a row to `public.sync_runs`:

```sql
INSERT INTO public.sync_runs (
    id,
    started_at,
    completed_at,
    status,               -- 'success' | 'partial' | 'failed'
    company_id,
    machines_synced,      -- count of rows upserted
    error_detail,         -- NULL on success, error string on failure
    triggered_by          -- 'dagster'
) VALUES (...)
```

This table is the single most important feed for the operational dashboard. Every sync result — success or failure — must be recorded here. The app reads this table to display sync health without ever connecting to BMS directly.

---

## Alert Flags To Write

After each full sync across all companies, write to `public.alerts`:

```sql
INSERT INTO public.alerts (
    type,
    machine_id,     -- FK to public.machines (nullable)
    company_id,     -- FK to public.companies (nullable)
    serial_number,  -- denormalised — for machines not yet in our DB
    message,
    severity,       -- 'info' | 'warning' | 'critical'
    first_seen,
    last_seen
)
ON CONFLICT (type, serial_number) DO UPDATE SET
    last_seen = NOW(),
    message   = EXCLUDED.message;
```

### Alert Types

| type | Trigger Condition | severity |
|------|------------------|----------|
| `sync_failed` | Could not connect to BMS MySQL for a company | `critical` |
| `bms_inactive` | Machine was active last sync, now `machinestatus = 0` | `warning` |
| `stale_xerox_reading` | Serial in active BMS machines but `latest_reading_date` in `xerox.meter_readings_normalised` is >14 days old | `warning` |
| `xerox_missing` | Serial in active BMS machines but not found in `xerox.printer_dimensions` at all | `warning` |
| `new_serial` | Serial appears in `xerox.printer_dimensions` (manufacturer = 'Xerox') but has no matching row in `public.machines` | `info` |

**Note:** `stale_xerox_reading` and `new_serial` require a cross-database query. Dagster reads from both `xerox_meters` PostgreSQL and `jetline_machines` PostgreSQL to generate these. Both databases are on the same server (`172.20.246.163`).

---

## Schedule

| Trigger | Frequency |
|---------|-----------|
| Full sync (all active companies) | Every 4 hours |
| On-demand single company | Poll `public.sync_requests` every 60 seconds |

### On-Demand Trigger Mechanism

The app writes a row to request a sync. Dagster polls and picks it up. Pure database handshake — no HTTP coupling.

```sql
-- App writes this to request a sync:
INSERT INTO public.sync_requests (company_id, requested_at, status)
VALUES (<company_uuid>, NOW(), 'pending');

-- Dagster sensor: poll every 60s, find 'pending' rows, run that company's sync
-- Then update:
UPDATE public.sync_requests
SET status = 'completed', completed_at = NOW()
WHERE id = <request_id>;
```

---

## Schema: Tables Dagster Must Create (If Not Exists)

Run these as part of pipeline startup or a migration step. The Prisma schema in the app will be updated to match.

```sql
CREATE TABLE IF NOT EXISTS public.sync_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at      TIMESTAMPTZ NOT NULL,
    completed_at    TIMESTAMPTZ,
    status          TEXT NOT NULL,  -- 'running' | 'success' | 'partial' | 'failed'
    company_id      UUID REFERENCES public.companies(id),
    triggered_by    TEXT DEFAULT 'dagster',
    machines_synced INTEGER DEFAULT 0,
    error_detail    TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.alerts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type          TEXT NOT NULL,
    machine_id    UUID REFERENCES public.machines(id),
    company_id    UUID REFERENCES public.companies(id),
    serial_number TEXT,
    message       TEXT NOT NULL,
    severity      TEXT NOT NULL DEFAULT 'info',
    first_seen    TIMESTAMPTZ DEFAULT NOW(),
    last_seen     TIMESTAMPTZ DEFAULT NOW(),
    resolved_at   TIMESTAMPTZ,
    UNIQUE (type, serial_number)
);

CREATE TABLE IF NOT EXISTS public.sync_requests (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id   UUID REFERENCES public.companies(id),
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    status       TEXT DEFAULT 'pending',  -- 'pending' | 'running' | 'completed' | 'failed'
    completed_at TIMESTAMPTZ
);
```

---

## What Dagster Does NOT Do

- ❌ Sync meter readings — Xerox pipeline owns that
- ❌ Calculate volumes, periods, or CPC — the operational app handles that on read
- ❌ Manage store mapping — the app's Machine Mapping page owns that
- ❌ Write to `xerox_meters` schema — read-only access only, for cross-check alerts

---

## Operational App Responsibilities (For Context)

So there is no confusion about the boundary:

- The app (`jetline-machines`) owns the UI, reporting, and alerting display
- The app owns the `public.companies` config table — adding a new store is done via the app's Settings page, Dagster picks it up on next poll
- The app reads `public.sync_runs` and `public.alerts` to display health and issues
- The app never connects to BMS MySQL directly once this pipeline is live
- The app never connects to `xerox_meters` for writes — read only for reporting

---

## Connection Strings

```
jetline_machines PostgreSQL:
  host:     172.20.246.163
  port:     5432
  database: jetline_machines
  user:     (same as app — check .env on server)

xerox_meters PostgreSQL (read-only access needed):
  host:     172.20.246.163 (or localhost if Dagster runs on same server)
  port:     5432
  database: xerox_meters
  user:     postgres
  password: j3tl1n3@26

BMS MySQL (one connection per company, credentials same for all):
  port:     3306
  user:     fortyone
  password: fo123@!
  database: <bms_schema from companies table>
```

---

## Summary

> Add a new Dagster job: **BMS Machine Registry Sync**.
>
> It reads active BMS companies from `public.companies` in `jetline_machines` PostgreSQL. For each company it connects to BMS MySQL, pulls active Xerox machines (serial, model, status, install date, site name only), and upserts into `public.machines`. After each company it writes a `sync_runs` row. After a full run it writes alerts for failures, newly inactive machines, stale Xerox readings, and new serials not yet mapped.
>
> No meter readings. No rates. Identity data only.
>
> Schedule: every 4 hours. On-demand via `sync_requests` table poll every 60 seconds.
>
> Adding a new BMS store requires no code change — add it via the app's Settings page and Dagster picks it up automatically on the next run.
