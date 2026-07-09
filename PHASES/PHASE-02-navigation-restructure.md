# Phase 02 — Navigation Restructure

## Goal
Rearrange the sidebar so Stores is the entry point and primary navigation object. Machines become secondary. Equipment admin tools move to a collapsible Setup section. Settings is removed from the sidebar.

## Problems being solved
- "CRM" as a nav label means nothing to store staff
- Stores should be the top-level concept — everything else is filtered through a store
- Machine Reports / Operations / Machine Mapping are internal ops tools, not primary nav
- Feature toggle settings have no place in a nav item
- Mini section headers ("MACHINES", "EQUIPMENT") can't collapse and waste vertical space

## New sidebar structure

```
[JetlineFleet logo]

▼ Stores          ← primary nav, always expanded
    All Stores        /stores
    Fleet Health      /equipment/fleet

▼ Operations      ← collapsible, default collapsed
    Dashboard         /operations
    Machine Reports   /machine-reports   ← keep as-is, printer volumes only
    Machine Mapping   /machine-mapping   ← keep as-is, critical for Xerox→BMS matching

▼ Setup           ← collapsible, default collapsed, admin only (future auth gate)
    Equipment Types   /setup/equipment-types
    Store Groups      /setup/store-groups
    Statuses          /setup/statuses
    BMS Connections   /setup/connections
    Feature Flags     /setup/features

[user avatar / version at bottom]
```

## Deliverables

### Sidebar component rewrite (`src/components/layout/sidebar.tsx`)
- Three `NavSection` components, each with a chevron toggle
- Collapse state persisted to localStorage per section key
- Active section auto-expands on route change
- No section header labels — the section title IS the toggle button
- Bottom: version string `v1.x.x` only, no user info (no auth yet)

### Route: `/stores` → redirects to `/equipment` for now (Phase 03 rebuilds it)
### Route: `/setup/*` → stub pages returning "Coming in Phase 05" for now

### Remove Settings from nav
The BMS connection test and feature toggles move to `/setup/connections` and `/setup/features` in Phase 05.

## Files to change
- `webapp/src/components/layout/sidebar.tsx` — full rewrite
- `webapp/src/app/(dashboard)/stores/page.tsx` — redirect to `/equipment`
- `webapp/src/app/(dashboard)/setup/` — NEW stub pages

## Verification
1. Sidebar shows three collapsible sections
2. Clicking "All Stores" goes to the store grid
3. Operations section is collapsed by default
4. Setup section is collapsed by default
5. Collapse state survives page refresh (localStorage)
