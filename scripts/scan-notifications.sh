#!/usr/bin/env bash
#
# Phase 14 — Notifications alert scanner cron wrapper.
#
# Triggers POST /api/notifications/scan on the local app. The route reads
# equipment.items (bmsPool) + xerox.machine_feedback (xeroxPool), and inserts
# de-duplicated Notification rows for service/contract/condition/replace alerts.
#
# Auth: sends the x-cron-secret header from $CRON_SECRET. If CRON_SECRET is unset
# here AND on the server, the route allows unauthenticated calls (see scan route).
#
# Run every 6 hours from crontab. Edit crontab with: crontab -e
#
#   0 */6 * * * /home/finalspace/finalspace/jetline-machines/webapp/scripts/scan-notifications.sh >> /home/finalspace/finalspace/jetline-machines/webapp/logs/scan-notifications.log 2>&1
#
set -euo pipefail

URL="${SCAN_URL:-http://localhost:3003/api/notifications/scan}"
SECRET="${CRON_SECRET:-}"

echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] scan-notifications: POST ${URL}"

if [ -n "${SECRET}" ]; then
  curl -fsS -X POST "${URL}" \
    -H "Content-Type: application/json" \
    -H "x-cron-secret: ${SECRET}"
else
  curl -fsS -X POST "${URL}" \
    -H "Content-Type: application/json"
fi

echo ""
echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] scan-notifications: done"
