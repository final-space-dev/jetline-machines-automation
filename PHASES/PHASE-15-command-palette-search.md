# Phase 15 — Command Palette & Global Search

## Goal
⌘K opens a command palette that searches across stores, equipment items, printers, and commands in one keystroke. This is the power-user interface that makes the system feel genuinely fast.

## Problems being solved
- Currently searching means navigating to the right page first, then filtering
- No way to jump to a specific serial number from anywhere in the app
- No keyboard-first workflow for admins who live in the system all day
- Command palette exists but only searches recent items — no real search

## Palette sections (in order)

```
[Search input — autofocused]

RECENT
  🏪 Alberton          last visited 2 min ago
  🖨 SN123456           Alberton · last visited 5 min ago

STORES (if query matches)
  Alberton             JEH Stores / Copper Moon
  Albertinia           ...

EQUIPMENT (if query matches)
  Polar Mohr 76EM      Guillotine · Alberton · Good
  Polar Mohr 92        Guillotine · Bedfordview · Poor

PRINTERS (if query matches)
  SN3YXB921            Xerox VersaLink · Alberton

COMMANDS (always visible or when query matches)
  Go to Fleet Health
  Export All CSV
  Add Equipment
  Open Setup
```

## Deliverables

### Search API: `GET /api/search?q=term`
Parallel queries:
1. Stores matching name (from store-groups constant, instant)
2. Equipment items: `ILIKE` on `make_model`, `serial`, `store`, `machine_type` — limit 5
3. Printers: `ILIKE` on `serial`, `model_name`, `store` — limit 5

Returns: `{ stores[], items[], printers[] }` — all 3 in single response.
Debounce: 200ms on client before firing.

### Rewrite `command-palette.tsx`
Current implementation only shows recently viewed items. Full rewrite:
- Keyboard navigation: arrow keys move selection, Enter navigates
- `Escape` closes
- Section headers ("STORES", "EQUIPMENT") only render if results exist
- Each result row: icon + primary text + secondary text (store, type, condition)
- Loading state: skeleton rows during fetch
- Empty state: "No results for '{query}'" with suggestion to check spelling

### Recent items
`getRecentItems()` from `recently-viewed.ts` populates the RECENT section when query is empty.
Max 6 recent items shown.

### Keyboard shortcut registration
`⌘K` (Mac) / `Ctrl+K` (Windows) registered globally in `app-shell.tsx`.
Header search button also opens it.

## Files to change
- `webapp/src/app/api/search/route.ts` — NEW
- `webapp/src/components/equipment/command-palette.tsx` — full rewrite
- `webapp/src/components/layout/app-shell.tsx` — ensure ⌘K is wired

## Verification
1. Press ⌘K anywhere → palette opens with recent items
2. Type "alb" → Alberton appears under STORES
3. Type "polar" → matching equipment items appear
4. Type "SN3Y" → matching printer serials appear
5. Arrow keys navigate between results
6. Enter on a result → navigates to that page, palette closes
7. Type "fleet" → "Go to Fleet Health" command appears
