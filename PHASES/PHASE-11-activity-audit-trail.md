# Phase 11 — Activity Feed & Audit Trail

## Goal
Every change made to equipment or printers is recorded and surfaced as a chronological activity feed — at the item level, store level, and global level. This is the "provenance" layer that makes the system trustworthy for management.

## Problems being solved
- `equipment.change_log` exists but is only visible on the individual item page
- No way to see all recent activity across all stores
- No actor identity (everything shows "user" — meaningless once auth is added)
- No way for a manager to see what their store staff changed today
- Printer feedback changes are not logged at all

## Activity feed hierarchy

### Global: `/activity`
- Last 200 changes across all equipment and printers
- Filter: by store, by user, by type (equipment/printer), by date range
- Each entry: actor avatar | field changed | item name | store | time ago

### Store level: visible on store detail page (Phase 04)
- Last 30 changes affecting that store's equipment or printers
- Same format as global but scoped

### Item level: already exists on item page
- Last 50 changes for that specific item
- After Phase 09 auth: shows real user names not "user"

## Data model additions

```sql
-- Extend equipment.change_log
ALTER TABLE equipment.change_log
  ADD COLUMN IF NOT EXISTS user_id INTEGER,      -- FK to users after Phase 09
  ADD COLUMN IF NOT EXISTS user_name TEXT,        -- denormalized for display
  ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'equipment',  -- 'equipment' | 'printer'
  ADD COLUMN IF NOT EXISTS store TEXT;            -- denormalized for filtering

-- New: printer feedback change log
CREATE TABLE IF NOT EXISTS equipment.printer_change_log (
  id SERIAL PRIMARY KEY,
  serial TEXT NOT NULL,
  store TEXT,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  user_name TEXT DEFAULT 'user',
  changed_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Deliverables

### Global activity page (`/activity`)
- Timeline layout: date group headers (Today, Yesterday, This Week, Earlier)
- Each entry: coloured dot (equipment=red, printer=blue) | "{user} changed {field} on {item} at {store}" | time
- Infinite scroll or "Load more" pagination (50 per page)
- Filter bar: store dropdown, date range, type toggle

### API: `GET /api/activity`
Params: `store`, `from`, `to`, `type`, `page`, `limit`
Unions `equipment.change_log` and `equipment.printer_change_log`, sorted by `changed_at` DESC.

### Printer change logging
`PATCH /api/equipment/printers/[serial]` now writes to `printer_change_log` for each changed field — same pattern as equipment item PATCH.

### Store-level activity widget
Reusable `ActivityFeed` component used on the store detail page (Phase 04) — last 10 entries, "View all" link to `/activity?store=X`.

### Sidebar nav entry: "Activity" under Operations section
- Badge showing count of changes today

## Files to change
- `webapp/src/app/(dashboard)/activity/page.tsx` — NEW
- `webapp/src/app/api/activity/route.ts` — NEW
- `webapp/src/app/api/equipment/printers/[serial]/route.ts` — add change logging
- `webapp/src/components/dashboard/activity-feed.tsx` — NEW reusable component
- `webapp/src/components/layout/sidebar.tsx` — add Activity nav entry
- DB migration: extend change_log + new printer_change_log

## Verification
1. `/activity` shows chronological list of all changes with store and item labels
2. Change condition on an item → appears in global activity within seconds
3. Change printer replace flag → appears in activity (printer_change_log)
4. Filter by store "Alberton" → only Alberton changes visible
5. Store detail page shows last 10 changes with "View all" link
