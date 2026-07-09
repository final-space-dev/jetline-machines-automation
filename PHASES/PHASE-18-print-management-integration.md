# Phase 18 — Print Management Integration

## Goal
Bring the existing Xerox/BMS print data and the equipment CRM together into a unified store view. A store's page shows both its physical equipment and its printer fleet with live volume data in one place. The Operations and Machine Reports sections are reframed as "Print Management" — a sub-section of each store's record.

## Problems being solved
- Print volumes (BMS) and physical equipment (CRM) live in completely separate sections with no connection
- A store manager can't see their total operational picture in one place
- Machine Reports is a company-wide view — no store-scoped version exists
- Volume data is available but not shown on the store card in the main grid

## Deliverables

### Store card upgrade (Phase 03 baseline)
Add to each store card:
- Monthly total volume (last 30 days from BMS) — small badge
- Printer fleet health indicator: X active / Y replace flagged

### Store detail page: Print section (Phase 04 baseline)
Add a third section below Equipment and Printers:
```
[Print Volumes — last 6 months]
  Stacked bar: Black | Colour | A3 | A3 Colour
  Total this month vs last month (% change)
  Top printer by volume (serial + model)
```

### Store-scoped machine report
`GET /api/stores/[store]/print-report`
Returns same data as `/api/machine-reports` but filtered to one store.
Used on the store detail page Print section.

### Cross-reference: Xerox billing vs BMS volumes
On the store detail page, a "Billing Reconciliation" widget:
- Xerox billed volume this month vs BMS reported volume
- Variance highlighted if >5%
- Links to the full recon report for that store

### Sidebar — no renames
Machine Reports and Machine Mapping stay as-is under Operations. Equipment-specific reports are out of scope until equipment data is fully captured across all stores. The only reporting in the system is the existing printer volume/reconciliation reporting.

### BMS sync status per store
On the store detail page: last sync time for that store's BMS connection.
Badge: "Synced 2 hours ago" (green) or "Sync failed 3 days ago" (red).

## Files to change
- `webapp/src/app/(dashboard)/equipment/stores/[store]/page.tsx` — add Print section
- `webapp/src/app/api/stores/[store]/print-report/route.ts` — NEW
- `webapp/src/app/(dashboard)/equipment/page.tsx` — store card volume badge
- `webapp/src/app/api/equipment/all-stores/route.ts` — add volume data
- `webapp/src/components/layout/sidebar.tsx` — rename Machine Reports

## Verification
1. Store card shows monthly volume badge (e.g. "23.4k prints")
2. Store detail page has Print section with 6-month bar chart
3. Bar chart correctly shows Black/Colour/A3 breakdown
4. Billing reconciliation widget shows Xerox vs BMS variance
5. BMS sync badge shows correct last-sync time for that store's connection
