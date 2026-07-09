# Phase 10 — Fleet Health Dashboard

## Goal
The Fleet Health page becomes the operational command centre — a live view of the entire fleet's condition, equipment needing attention, printers nearing end-of-life, and service schedule. This is the "wow the board" page.

## Problems being solved
- Current fleet page is a static aggregation with no actionable items
- No way to see which specific items are in poor condition across all stores
- No contract expiry monitoring — Xerox contracts end and nobody notices
- No service overdue list — next_service_due dates exist but aren't surfaced
- The "replace" flag exists on printers but never aggregates into a fleet view

## Page layout

```
[Page title: Fleet Health]

[KPI row — 5 cards]
  Total Equipment   |   Poor Condition   |   Service Overdue   |   Replace Flagged   |   Contracts Expiring

[Condition breakdown — stacked bar across all stores]
  Full-width bar: Good (green) | Fair (amber) | Poor (red) | Unassessed (grey)
  Click a segment → filters the attention list below

[Attention list — items needing action]
  Tabs: Poor Condition | Service Overdue | Replace Flagged | Contracts Expiring
  Each tab: table of items/printers with store link, type, last updated
  Sortable by store, type, date

[Store health table]
  All 48 stores, ranked by health score (% good condition)
  Health score = good / (good + fair + poor)
  Traffic-light colour on score column
  Columns: Store | Group | Equipment | Poor | Printers | Replace | Score | Last Activity
```

## Deliverables

### API: `GET /api/dashboard/fleet-health` (replace current fleet-health route)
Returns:
```json
{
  "kpi": { "total": 303, "poor": 20, "serviceOverdue": 8, "replaceFlagged": 14, "contractsExpiring30d": 3 },
  "conditionBreakdown": { "good": 229, "fair": 54, "poor": 20, "unknown": 0 },
  "attentionItems": {
    "poorCondition": [...],
    "serviceOverdue": [...],
    "replaceFlagged": [...],
    "contractsExpiring": [...]
  },
  "storeHealth": [...]
}
```

### Recharts integration for condition breakdown
Full-width stacked horizontal bar using `BarChart` with `layout="vertical"` and a single data point. Click handler filters the attention list.

### Attention list component (`src/components/dashboard/attention-list.tsx`)
Reusable tabbed table that accepts the four lists. Each row links to the relevant item or printer page. Sortable columns.

### Contract expiry monitoring
Query `xerox.machine_feedback.contract_end` for all serials. Flag any expiring within 30/60/90 days. Show in "Contracts Expiring" tab with days remaining badge.

## Files to change
- `webapp/src/app/(dashboard)/equipment/fleet/page.tsx` — full rewrite
- `webapp/src/app/api/equipment/fleet-health/route.ts` — full rewrite
- `webapp/src/components/dashboard/attention-list.tsx` — NEW
- `package.json` — ensure recharts is installed

## Verification
1. Fleet Health KPI row shows 5 cards with real counts
2. "Poor Condition" tab lists all items with condition="poor" across all stores
3. "Service Overdue" tab lists items where next_service_due < today
4. "Contracts Expiring" tab lists printers with contract_end within 30 days
5. Store health table ranks stores by health score, lowest at top
6. Clicking a store name navigates to that store's page
