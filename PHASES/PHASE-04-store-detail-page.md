# Phase 04 — Store Detail Page Rebuild

## Goal
The per-store page at `/stores/[store]` becomes a proper ERP store record — not a tabbed list. It shows identity, group membership, equipment summary, and printer fleet in a single scrollable page with a sticky header. No modals for adding equipment.

## Problems being solved
- Current page is a tabbed table — Equipment tab | Printers tab — with inline add modal
- No store identity section (address, owner, group, contact)
- "Add equipment" opens a modal with free-text fields — no dropdowns, no model search
- Printer serial numbers link to a full printer page but the store page itself has no context
- No way to see both equipment and printers at the same time

## Page layout

```
[Sticky top bar: breadcrumb "Stores / Alberton" | Save button if dirty]

[Identity section]
  Store name (h1, 28px, 800)
  Group badge: "Copper Moon · JEH Stores · Equity Holdings"
  Fields (admin editable): Address, Phone, Manager name, Email

[Summary strip]
  Equipment: 15 items   Printers: 4 active   Condition: [health bar]   Last updated: 3 days ago

[Equipment section — no tab, always visible]
  [Toolbar: "+ Add Equipment" | search | type filter (JL select) | status filter]
  [Equipment table — full rows, click → /equipment/items/:id]

[Printers section — always visible below equipment]
  [Printer table — serial, model, type, last seen, replace flag]
  [Each row → /equipment/printers/:serial]
```

## Deliverables

### 1. Store identity stored in equipment schema
New table: `equipment.stores`
```sql
CREATE TABLE IF NOT EXISTS equipment.stores (
  name TEXT PRIMARY KEY,
  main_group TEXT,
  store_group TEXT,
  holding_group TEXT,
  address TEXT,
  phone TEXT,
  manager_name TEXT,
  manager_email TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```
API: `GET /api/stores/[store]` returns identity + equipment + printers
API: `PATCH /api/stores/[store]` updates identity fields

### 2. Add Equipment — no modal, inline form
When "+ Add Equipment" is clicked, a row expands inline at the top of the table:
- Type: JL custom select (required)
- Make/Model: autosuggest input (searches existing makes in DB first)
- Serial: text input
- Status: toggle buttons (Active / Inactive / Disposed / Transferred)
- Condition: dropdown (Good / Fair / Poor) — not free-text at store level
- Save button inline

### 3. Model autosuggest (`src/components/equipment/model-suggest.tsx`)
- Input with 300ms debounce
- Calls `GET /api/equipment/models?q=term` → returns distinct `make_model` values from DB
- Dropdown shows matching existing models
- If no match: "Add new model: [term]" option at bottom

### 4. JL-styled filter toolbar
- Search input: JL token styling
- Type filter: JL custom select (from Phase 01)
- Status filter: segmented toggle buttons (not a select)

## Files to change
- `webapp/src/app/(dashboard)/equipment/stores/[store]/page.tsx` — full rewrite
- `webapp/src/app/api/equipment/stores/[store]/route.ts` — add identity fields
- `webapp/src/app/api/stores/[store]/route.ts` — NEW (identity CRUD)
- `webapp/src/app/api/equipment/models/route.ts` — NEW (autosuggest)
- `webapp/src/components/equipment/model-suggest.tsx` — NEW
- DB migration: `equipment.stores` table

## Verification
1. `/stores/Alberton` shows identity section with group badges
2. Click "+ Add Equipment" → inline row expands (no modal)
3. Type field is a JL select dropdown — not macOS native
4. Make/Model autosuggest shows existing models from DB
5. Condition field is a 3-option toggle (Good / Fair / Poor)
6. Both equipment and printers visible without switching tabs
