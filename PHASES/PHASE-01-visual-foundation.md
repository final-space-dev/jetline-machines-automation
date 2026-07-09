# Phase 01 — Visual Foundation

## Goal
Replace every white-on-white surface, every native OS control, and every text-heavy label with the JetlineUI 2.0 design system. This is the visual base every subsequent phase builds on.

## Problems being solved
- Store cards are white on a white canvas — zero contrast, no depth
- Native `<select>` and `<input type="date">` elements throughout (macOS chrome, no JL styling)
- Section headers have subtitles nobody reads
- KPI cards have sub-labels ("across 23 stores", "of 48 total stores") that state the obvious
- Condition health bars exist but are 5px tall and invisible at a glance

## Deliverables

### 1. Canvas + Card contrast
- Canvas: `#f0f2f5` (slightly darker than current `#f4f6f9`)
- Store cards: `#ffffff` background, `box-shadow: var(--jl-sh-md)`, `border-radius: var(--jl-r-lg)`
- No card should ever sit on a surface the same colour as itself

### 2. Custom select component (`src/components/ui/jl-select.tsx`)
Replace every native `<select>` in the equipment section with a styled component:
- Trigger button: full JL token border, height 40px, chevron icon right-aligned
- Dropdown: white surface, `var(--jl-sh-lg)`, `border-radius: var(--jl-r-md)`
- Options: 36px tall, hover `var(--jl-red-tint)`, active `var(--jl-red-500)` text
- No Radix dependency — pure React state + `useRef` for click-outside

### 3. Custom date picker (`src/components/ui/jl-date.tsx`)
Replace every `<input type="date">` with:
- Styled trigger showing formatted date (e.g. "12 Jan 2025") or placeholder
- Calendar popover: 7-col grid, red accent on selected day, today indicator
- Keyboard: arrow keys navigate, Enter selects, Escape closes

### 4. Condition health bar upgrade
- Height: 8px (from 5px)
- Rounded caps on each segment
- Tooltip on hover showing exact counts

### 5. Remove all KPI sub-labels
KPI cards show only: large number + label. No "of 48 total" text beneath.

### 6. Remove all section eyebrow labels ("EQUIPMENT" in red above headings)
Pages navigate themselves — the sidebar already tells the user where they are.

## Files to change
- `webapp/src/app/globals.css` — canvas token tweak
- `webapp/src/app/(dashboard)/equipment/page.tsx` — cards, KPI strip, health bar
- `webapp/src/app/(dashboard)/equipment/stores/[store]/page.tsx` — replace selects
- `webapp/src/app/(dashboard)/equipment/items/[id]/page.tsx` — date inputs, selects
- `webapp/src/app/(dashboard)/equipment/printers/[serial]/page.tsx` — date inputs
- `webapp/src/components/ui/jl-select.tsx` — NEW
- `webapp/src/components/ui/jl-date.tsx` — NEW

## Verification
1. Open `/equipment` — cards visually lift off the canvas, no white-on-white
2. Click any select — JL-styled dropdown appears, not macOS native
3. Click any date field — calendar popover opens, styled with JL tokens
4. KPI strip shows 4 numbers with labels, no sub-text
