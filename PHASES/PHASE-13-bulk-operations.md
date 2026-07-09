# Phase 13 — Bulk Operations

## Goal
Admins can select multiple equipment items and update them in bulk — change status, reassign store, update condition, schedule service. Also: bulk import from CSV to onboard a new store's equipment in one go.

## Problems being solved
- Updating 30 items from "active" to "disposed" after a store closes requires 30 individual page visits
- Onboarding a new store means manually adding each piece of equipment one by one
- No way to bulk-reassign equipment when stores merge or are restructured
- Store closures leave orphaned equipment with no efficient way to mark it all disposed

## Deliverables

### Multi-select on equipment tables
- Checkbox column (leftmost) on the store equipment table
- "Select all on this page" checkbox in header
- Selection persists across filter changes (by item ID set)
- When ≥1 selected: bulk action toolbar appears above table

### Bulk action toolbar (`src/components/equipment/bulk-action-bar.tsx`)
```
[N items selected]  [Change Status ▼]  [Change Condition ▼]  [Reassign Store ▼]  [Delete] [Clear]
```
- Each action opens a compact confirmation popover (not a modal)
- "Change Status" → dropdown of 4 statuses → "Apply to N items"
- "Reassign Store" → JL select of all stores → confirm
- "Delete" → destructive red confirmation with count

### API: `PATCH /api/equipment/bulk`
Body: `{ ids: number[], field: string, value: string }`
Validates all IDs exist, applies update, writes change_log for each.
Returns: `{ updated: number, errors: [] }`

### CSV Import
Admin page at `/setup/import`:
- Download template CSV button (pre-filled with all column headers)
- Upload CSV → parse client-side with `papaparse`
- Preview table showing all rows with validation state (missing required field = red row)
- "Import N valid rows" button → POST to `/api/equipment/import`
- Import creates items, writes change_log with `changed_by = "csv_import"`

### API: `POST /api/equipment/import`
Body: array of item objects.
Validates each row, inserts valid rows, returns summary: `{ imported: N, skipped: M, errors: [] }`.

## Files to change
- `webapp/src/app/(dashboard)/equipment/stores/[store]/page.tsx` — add checkbox column + bulk bar
- `webapp/src/app/api/equipment/bulk/route.ts` — NEW
- `webapp/src/app/api/equipment/import/route.ts` — NEW
- `webapp/src/app/(dashboard)/setup/import/page.tsx` — NEW
- `webapp/src/components/equipment/bulk-action-bar.tsx` — NEW
- `package.json` — add `papaparse`

## Verification
1. Check 5 items on store page → bulk toolbar appears with count
2. Change Status → Poor for 5 items → all 5 updated in one request, change_log has 5 entries
3. Download CSV template → has all required columns
4. Upload CSV with 10 rows (1 missing type) → preview shows 9 valid rows + 1 red error row
5. Import 9 rows → all 9 appear on correct store page
6. Bulk delete: confirmation shows count, deletes all selected
