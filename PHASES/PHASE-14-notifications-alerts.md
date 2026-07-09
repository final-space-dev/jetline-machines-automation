# Phase 14 — Notifications & Alerts

## Goal
The system proactively surfaces problems — service overdue, contracts expiring, equipment in poor condition — as in-app notifications and optionally as email alerts. Nobody has to remember to check the Fleet Health page.

## Problems being solved
- Service due dates exist but nothing alerts when they pass
- Contract expiry dates exist on printers but nobody monitors them
- Poor condition equipment accumulates without anyone being notified
- Currently 100% pull — admins must visit to discover problems

## Notification types

| Alert | Trigger | Audience |
|---|---|---|
| Service Overdue | next_service_due < today | Admin |
| Service Due Soon | next_service_due within 14 days | Admin |
| Contract Expiring | contract_end within 30 days | Admin |
| Contract Expired | contract_end < today | Admin |
| Equipment Poor | condition set to "poor" | Admin + store's staff |
| Replace Flagged | replace_flag set to "YES" | Admin |
| New equipment added | POST to /api/equipment | Admin only |

## Deliverables

### Notification centre (`src/components/layout/notification-bell.tsx`)
- Bell icon in the header with unread count badge (red pill)
- Click → dropdown panel showing last 20 notifications
- Each: icon | message | store | time ago | "Mark read" ×
- "Mark all read" button at top
- Unread count persists in `jetline_machines.notifications` table

### Notification DB table
```sql
-- In jetline_machines Prisma DB
model Notification {
  id        Int      @id @default(autoincrement())
  type      String   -- "service_overdue", "contract_expiring", etc.
  message   String
  store     String?
  itemId    Int?
  serial    String?
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
}
```

### Background job: alert scanner
`/api/notifications/scan` POST — called by a cron job every 6 hours (PM2 scheduled script).
Queries all service dates, contract ends, and condition values.
Inserts notifications for any triggers not already notified (dedup by type+store+item in last 7 days).

### API routes
- `GET /api/notifications` — last 20, sorted by createdAt DESC
- `PATCH /api/notifications/[id]` — mark read
- `PATCH /api/notifications/read-all` — mark all read
- `POST /api/notifications/scan` — trigger scan (cron)

### Email alerts (optional, Phase 14b)
- SMTP config in `.env`: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- `nodemailer` sends daily digest email to admin addresses in `setup.notification_recipients`
- Email: plain HTML table listing all unread high-priority alerts

## Files to change
- `webapp/src/components/layout/notification-bell.tsx` — NEW
- `webapp/src/components/layout/header.tsx` — add bell component
- `webapp/src/app/api/notifications/route.ts` — NEW
- `webapp/src/app/api/notifications/[id]/route.ts` — NEW
- `webapp/src/app/api/notifications/scan/route.ts` — NEW
- `webapp/prisma/schema.prisma` — add Notification model
- `scripts/scan-notifications.sh` — cron wrapper

## Verification
1. Set a next_service_due to yesterday → run `/api/notifications/scan` → bell badge shows 1
2. Click bell → dropdown shows "Service overdue: [item] at [store]"
3. Mark read → badge clears
4. Set printer contract_end to 15 days from now → scan → "Contract expiring in 15 days" notification
5. Set condition to "poor" → notification appears immediately (triggered by PATCH, not scan)
