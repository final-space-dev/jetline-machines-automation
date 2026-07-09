# Phase 16 — Mobile Responsive Layout

## Goal
Store staff visiting the system on a phone or tablet to quickly update condition or check a serial number should have a usable experience. The sidebar collapses to a bottom nav. Tables become card stacks. Forms reflow to single column.

## Problems being solved
- Sidebar is 256px wide — takes up half a phone screen
- Tables with 6+ columns are unusable on mobile — horizontal scroll is poor UX
- The ⌘K shortcut doesn't exist on mobile — no way to quickly search
- Date pickers are impossible to use on touch without the native browser picker
- Store card grid is 7 columns on desktop — becomes 1 column on mobile

## Breakpoints
- `sm`: 640px — tablet portrait
- `md`: 768px — tablet landscape  
- `lg`: 1024px — laptop
- Default (no prefix): mobile-first

## Deliverables

### Sidebar → bottom nav on mobile
On screens < 768px:
- Sidebar is hidden
- Bottom nav bar: 5 icon buttons (Stores, Fleet, Operations, Search, Setup)
- Active state: red icon + label
- Tap "Search" → opens command palette (touch-friendly)

### Responsive store grid
- Mobile: 1 column
- sm: 2 columns
- md: 3 columns
- lg: 4–5 columns (auto-fill)

### Table → card stack on mobile
Equipment table on store page:
- Mobile: each row becomes a card with: type (bold), make/model, condition pill, status pill, chevron
- No column headers
- Tap card → navigates to item page

### Responsive forms
Item and printer edit pages:
- Mobile: all grid sections collapse to single column
- Sticky top bar still shows Save button
- Date picker uses JL calendar (touch-friendly tap targets, 44px minimum)

### Touch-friendly controls
- All button tap targets minimum 44×44px
- Condition toggle buttons: 48px tall on mobile
- Condition health bar: 12px tall (up from 8px)

### Mobile header
On mobile:
- No horizontal search bar text
- Just: hamburger (opens overlay menu) | JetlineFleet logo | bell icon

## Files to change
- `webapp/src/components/layout/sidebar.tsx` — mobile collapse logic
- `webapp/src/components/layout/app-shell.tsx` — bottom nav on mobile
- `webapp/src/app/(dashboard)/equipment/page.tsx` — responsive grid
- `webapp/src/app/(dashboard)/equipment/stores/[store]/page.tsx` — card stack on mobile
- `webapp/src/app/globals.css` — breakpoint utilities if needed

## Verification
1. Resize to 375px → sidebar hidden, bottom nav appears
2. Store grid at 375px → single column
3. Equipment table at 375px → card stack, no overflow
4. Tap condition toggle → 44px+ tap target, responds correctly
5. Save button visible on mobile item page in sticky bar
6. Tap search icon → command palette opens full-screen on mobile
