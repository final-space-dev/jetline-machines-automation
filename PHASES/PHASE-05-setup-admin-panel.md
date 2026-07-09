# Phase 05 — Setup / Admin Panel

## Goal
All configuration that only admins touch moves into a collapsible "Setup" section in the sidebar. This includes equipment types, condition statuses, store group configuration, BMS connections, and feature flags. Store staff never see this section.

## Problems being solved
- Equipment types are a hardcoded constant — no way to add/remove without a code deploy
- Condition statuses (Good/Fair/Poor) are also hardcoded
- BMS connection testing lives inside the Settings page buried behind a nav item
- Feature toggles (which sidebar items are visible) have no proper home
- No way for an admin to onboard a new store or reassign a store to a different group

## Sidebar Setup section (collapsible, admin-only in future)

```
▼ Setup
    Equipment Types     /setup/equipment-types
    Conditions          /setup/conditions
    Store Groups        /setup/store-groups
    Connections         /setup/connections
    Feature Flags       /setup/features
```

## Deliverables

### `/setup/equipment-types`
- Table: all current types with count of items using each
- "+ Add Type" inline row at bottom
- Edit name inline (click to edit)
- Delete only if count = 0 (greyed out otherwise with tooltip)
- DB: `equipment.equipment_types (id SERIAL, name TEXT UNIQUE, created_at)`
- API: `GET/POST/PATCH/DELETE /api/setup/equipment-types`

### `/setup/conditions`
- Table: condition label, colour (Good=green/Fair=amber/Poor=red), keyword triggers
- Admin can add custom condition buckets and assign keywords that auto-classify to them
- DB: `equipment.conditions (id SERIAL, label TEXT, color TEXT, keywords TEXT[])`
- API: `GET/POST/PATCH/DELETE /api/setup/conditions`

### `/setup/store-groups`
- Hierarchical table: Main Group → Store Group → Stores
- Edit group assignments per store (drag-drop or select)
- Add/rename groups
- DB: `equipment.store_group_map (store TEXT PRIMARY KEY, main_group TEXT, store_group TEXT, holding_group TEXT)`
- API: `GET/POST/PATCH /api/setup/store-groups`

### `/setup/connections`
- Migrated from Settings page
- BMS connection list with Test button (latency)
- Add/remove connections

### `/setup/features`
- Migrated from Settings page
- Feature flag toggles for which sidebar sections are visible
- Stored in DB instead of localStorage so it's consistent across users/devices

### Remove `/settings` page and Settings nav item
Content fully migrated to `/setup/*`.

## Files to change
- `webapp/src/app/(dashboard)/setup/` — NEW section, 5 pages
- `webapp/src/app/api/setup/` — NEW API routes
- `webapp/src/components/layout/sidebar.tsx` — Setup section (Phase 02 stub becomes real)
- `webapp/src/app/(dashboard)/settings/page.tsx` — DELETE (redirect to /setup)
- DB migrations: 4 new tables

## Verification
1. `/setup/equipment-types` shows all 19 types with usage counts
2. Add "Ring Binder" → appears in equipment type dropdowns on store pages
3. Delete a type with 0 items → removed; delete a type with items → blocked
4. `/setup/connections` shows BMS connection list, Test button works
5. Settings nav item gone from sidebar
