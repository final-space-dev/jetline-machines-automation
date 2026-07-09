# Phase 08 — Machine Model Catalogue

## Goal
Create a central catalogue of equipment makes and models that admins maintain. Store staff always pick from this catalogue — they never free-type a model name. This ensures data consistency across all 48 stores.

## Problems being solved
- "Polar Mohr 76EM" typed as "polar mohr 76em", "Polar 76EM", "Polar Mohr 76 EM" across stores
- No way to know which model a piece of equipment is without visiting each store
- No canonical list of what equipment types each model belongs to
- No spec data (width, weight, power, date introduced) attached to models

## Data model

```sql
CREATE TABLE equipment.models (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,           -- "Polar Mohr 76 EM"
  manufacturer TEXT,            -- "Polar Mohr"
  equipment_type TEXT NOT NULL, -- FK-like to equipment_types.name
  year_introduced INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, equipment_type)
);
```

Link existing `equipment.items.make_model` → `equipment.models.id` (add `model_id INTEGER` column).
Keep `make_model TEXT` as a fallback for legacy records.

## Deliverables

### `/setup/models` page (admin)
- Table: model name, manufacturer, type, year, items using it (count)
- "+ Add Model" inline row
- Edit all fields inline
- Import from CSV button (bulk onboard from spreadsheet)
- API: `GET/POST/PATCH/DELETE /api/setup/models`

### Autosuggest upgrade (from Phase 04)
`model-suggest.tsx` now queries `equipment.models` filtered by the selected `equipment_type`.
When a type is selected first, only models of that type appear in the suggest dropdown.

### Catalogue page at `/equipment/models` (read-only, for all users)
- Filterable grid of all models by type
- Each model card: name, manufacturer, type chip, item count badge
- Click → list of all items using that model across all stores

## Files to change
- `webapp/src/app/(dashboard)/setup/models/page.tsx` — NEW
- `webapp/src/app/(dashboard)/equipment/models/page.tsx` — NEW (read-only catalogue)
- `webapp/src/app/api/setup/models/route.ts` — NEW
- `webapp/src/app/api/equipment/models/route.ts` — update to query models table
- `webapp/src/components/equipment/model-suggest.tsx` — update to filter by type
- DB migration: `equipment.models` table + `model_id` column on `equipment.items`

## Verification
1. `/setup/models` shows all models with item counts
2. Adding "Polar Mohr 76 EM" under "Guillotine" → it appears in autosuggest when Guillotine is selected
3. Selecting a model from autosuggest on the item page populates make_model correctly
4. `/equipment/models` catalogue shows filterable model grid
5. Duplicate model names within same type are rejected
