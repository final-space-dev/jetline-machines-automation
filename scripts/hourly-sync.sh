#!/usr/bin/env bash
#
# Hourly data-refresh cron wrapper.
#
# Runs the two background jobs that keep the app's data fresh, replacing the
# manual "Sync" button in the UI so data flows automatically every hour:
#
#   1. POST /api/sync                 — full BMS/Xerox meter + machine refresh
#                                       (runFullSync over all active companies).
#                                       Body { "type": "full" } is the default;
#                                       this endpoint is NOT cron-secret gated.
#   2. POST /api/notifications/scan   — re-scan equipment.items + machine_feedback
#                                       and insert service/contract/condition/
#                                       replace notifications. Requires the
#                                       x-cron-secret header (see scan route:
#                                       fails closed with 500 if CRON_SECRET is
#                                       unset on the server, 401 on mismatch).
#
# Auth: step 2 sends the x-cron-secret header from $CRON_SECRET. Set the SAME
# value here (in the crontab environment) as on the running server, or the scan
# call returns 401. Step 1 needs no secret.
#
# Overridable env vars:
#   SYNC_URL      default http://localhost:3003/api/sync
#   SCAN_URL      default http://localhost:3003/api/notifications/scan
#   CRON_SECRET   shared secret for the scan endpoint (required for step 2)
#
# Install — run hourly on the top of every hour. Edit crontab with: crontab -e
#
#   0 * * * * CRON_SECRET=<CRON_SECRET> /home/finalspace/finalspace/jetline-machines/webapp/scripts/hourly-sync.sh >> /home/finalspace/finalspace/jetline-machines/webapp/logs/hourly-sync.log 2>&1
#
# (Ensure the logs/ directory exists: mkdir -p ~/finalspace/jetline-machines/webapp/logs)
#
set -euo pipefail

SYNC_URL="${SYNC_URL:-http://localhost:3003/api/sync}"
SCAN_URL="${SCAN_URL:-http://localhost:3003/api/notifications/scan}"
SECRET="${CRON_SECRET:-}"

ts() { date -u '+%Y-%m-%dT%H:%M:%SZ'; }

# ── 1. Full BMS/Xerox data sync ────────────────────────────────────────────────
echo "[$(ts)] hourly-sync: POST ${SYNC_URL} (full)"
curl -fsS -X POST "${SYNC_URL}" \
  -H "Content-Type: application/json" \
  -d '{"type":"full"}'
echo ""

# ── 2. Notifications alert scan ────────────────────────────────────────────────
echo "[$(ts)] hourly-sync: POST ${SCAN_URL}"
if [ -n "${SECRET}" ]; then
  curl -fsS -X POST "${SCAN_URL}" \
    -H "Content-Type: application/json" \
    -H "x-cron-secret: ${SECRET}"
else
  echo "[$(ts)] hourly-sync: WARNING CRON_SECRET unset — scan will 401/500 if the server requires it"
  curl -fsS -X POST "${SCAN_URL}" \
    -H "Content-Type: application/json"
fi
echo ""

echo "[$(ts)] hourly-sync: done"
