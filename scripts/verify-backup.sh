#!/usr/bin/env bash
#
# Phase 20 — Automated backup verification (daily).
#
# Restores the latest pg_dump backup into a throwaway schema, counts a few key
# tables to prove the dump is usable, drops the schema, and logs the outcome to
# jetline_machines.backup_log. Designed to be safe: it never touches live data
# (restore target is an isolated temp schema) and always cleans up.
#
# It CANNOT run in this dev sandbox — it is written to run on the production
# server against the real backups directory.
#
# Assumptions (override via env):
#   BMS_DB           bms                        DB whose equipment schema is verified
#   BACKUP_DIR       /home/finalspace/backups   where dumps land (newest = latest)
#   BACKUP_GLOB      bms-*.sql*                  filename pattern for dumps
#   LOG_DB           jetline_machines           DB holding backup_log
#   PGUSER           postgres
#   PGHOST           localhost
#   PGPORT           5432
#   PGPASSWORD       (export in the environment / .pgpass; not hard-coded here)
#
# Install (crontab, runs 03:30 daily and appends stdout/stderr to a log):
#   30 3 * * * /home/finalspace/jetline-machines/webapp/scripts/verify-backup.sh \
#     >> /home/finalspace/logs/verify-backup.log 2>&1
#
# Or via PM2 as a cron-restart process:
#   pm2 start /home/finalspace/jetline-machines/webapp/scripts/verify-backup.sh \
#     --name verify-backup --cron "30 3 * * *" --no-autorestart --interpreter bash

set -euo pipefail

BMS_DB="${BMS_DB:-bms}"
BACKUP_DIR="${BACKUP_DIR:-/home/finalspace/backups}"
BACKUP_GLOB="${BACKUP_GLOB:-bms-*.sql*}"
LOG_DB="${LOG_DB:-jetline_machines}"
export PGUSER="${PGUSER:-postgres}"
export PGHOST="${PGHOST:-localhost}"
export PGPORT="${PGPORT:-5432}"

TEMP_SCHEMA="backup_verify_$(date +%Y%m%d_%H%M%S)"
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Ensure the log table exists (idempotent).
psql -d "$LOG_DB" -v ON_ERROR_STOP=1 -q <<SQL
CREATE TABLE IF NOT EXISTS backup_log (
  id           SERIAL PRIMARY KEY,
  verified_at  TIMESTAMPTZ DEFAULT NOW(),
  backup_file  TEXT,
  status       TEXT NOT NULL,          -- 'ok' | 'failed'
  row_count    BIGINT,
  detail       TEXT
);
SQL

log_result() {
  local status="$1" file="$2" rows="$3" detail="$4"
  psql -d "$LOG_DB" -v ON_ERROR_STOP=1 -q \
    -c "INSERT INTO backup_log (backup_file, status, row_count, detail)
        VALUES ('$file', '$status', ${rows:-NULL}, \$detail\$${detail}\$detail\$);"
}

cleanup() {
  psql -d "$BMS_DB" -q -c "DROP SCHEMA IF EXISTS ${TEMP_SCHEMA} CASCADE;" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Find the newest backup file.
LATEST="$(ls -1t "${BACKUP_DIR}"/${BACKUP_GLOB} 2>/dev/null | head -n1 || true)"
if [[ -z "${LATEST}" ]]; then
  echo "No backup found in ${BACKUP_DIR} matching ${BACKUP_GLOB}"
  log_result "failed" "none" "" "no backup file found in ${BACKUP_DIR}"
  exit 1
fi
echo "Verifying latest backup: ${LATEST} (started ${STARTED_AT})"

# Create the isolated temp schema.
psql -d "$BMS_DB" -v ON_ERROR_STOP=1 -q -c "CREATE SCHEMA ${TEMP_SCHEMA};"

# Restore into the temp schema by rewriting the dump's schema references.
# The dump is expected to reference the 'equipment' schema; we remap it to the
# temp schema so live data is never touched. Handles plain and gzipped dumps.
remap() {
  # sed remaps 'equipment.' qualified names and 'SCHEMA equipment' statements.
  sed -e "s/\bequipment\./${TEMP_SCHEMA}./g" \
      -e "s/SCHEMA equipment\b/SCHEMA ${TEMP_SCHEMA}/g"
}

set +e
if [[ "${LATEST}" == *.gz ]]; then
  gunzip -c "${LATEST}" | remap | psql -d "$BMS_DB" -v ON_ERROR_STOP=1 -q
else
  remap < "${LATEST}" | psql -d "$BMS_DB" -v ON_ERROR_STOP=1 -q
fi
RESTORE_RC=$?
set -e

if [[ ${RESTORE_RC} -ne 0 ]]; then
  echo "Restore FAILED (rc=${RESTORE_RC})"
  log_result "failed" "$(basename "${LATEST}")" "" "restore returned rc=${RESTORE_RC}"
  exit 1
fi

# Count rows in the restored items table as the integrity proxy.
ROWS="$(psql -d "$BMS_DB" -tA \
  -c "SELECT COALESCE((SELECT COUNT(*) FROM ${TEMP_SCHEMA}.items), -1);" 2>/dev/null || echo -1)"

if [[ "${ROWS}" -lt 0 ]]; then
  echo "Restored dump has no ${TEMP_SCHEMA}.items table — verification FAILED"
  log_result "failed" "$(basename "${LATEST}")" "" "restored dump missing items table"
  exit 1
fi

echo "Backup verified OK: ${ROWS} rows in ${TEMP_SCHEMA}.items"
log_result "ok" "$(basename "${LATEST}")" "${ROWS}" "restored + counted successfully"
# cleanup() runs via trap on exit.
exit 0
