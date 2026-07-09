# Phase 07 — Printer Record Page

## Goal
The per-printer page at `/equipment/printers/[serial]` is rebuilt with the same role-aware pattern as the item page. Machine info from Xerox is clearly separated from the editable feedback layer. Volume history becomes a proper chart.

## Problems being solved
- Machine Information section says "read only" in a subtitle — that subtitle is now gone but the visual doesn't communicate it clearly enough
- Condition notes is a free-text textarea — store staff should use toggles
- Volume history bar chart is hand-coded SVG — brittle and hard to read
- Contract dates use native `<input type="date">`
- No way to see multiple counter types (black, colour, A3) in the history chart
- Replace flag (YES/MAYBE/NO) is 3 buttons but they don't visually communicate severity well

## Page layout

```
[Sticky bar: breadcrumb "Stores / Alberton / SN123456" | Save]

[Machine identity — read only, clearly labelled]
  Serial    Model    Store    Type    Manufacturer    Colour    Duplex    Last Seen
  Visual treatment: grey sunken background (--jl-surface-sunken) to communicate read-only

[Condition — editable, all users]
  Condition: [Good] [Fair] [Poor] toggle
  Replace: severity-coloured toggle [YES=red] [MAYBE=amber] [NO=green]
  Notes: textarea (comment only)

[Contract & Lifecycle — admin only]
  Install Date    Contract End    Last Visit (JL date pickers)
  Technician Notes: textarea
  Contract expired banner (if end < today)

[Volume History — visual chart]
  Counter type toggle: Total / Black / Colour / A3
  6-month bar chart with proper axis labels
  Monthly delta values labeled on each bar
  Table below: last 8 readings, all counter columns
```

## Deliverables

### 1. Sunken read-only section
Machine Information card gets `background: var(--jl-surface-sunken)` and a lock icon instead of the red icon to visually signal it's data from Xerox, not editable.

### 2. Condition toggle (matches Phase 06 pattern)
Good / Fair / Poor buttons — same component, no free text.

### 3. Replace severity colours
- YES: red-500 background, white text
- MAYBE: amber-500 background, white text  
- NO: green-500 background, white text
Current implementation: border + text colour only — upgrade to filled buttons.

### 4. Volume chart upgrade
Replace the hand-coded bar chart divs with a proper chart:
- Use `recharts` (already installed or add as dep)
- `BarChart` component with 6 months on X-axis
- Counter type selector above chart (Total / Black / Colour / A3 / A3 Colour)
- Tooltip on hover showing exact monthly delta
- ResponsiveContainer fills card width

### 5. JL date pickers for contract fields

## Files to change
- `webapp/src/app/(dashboard)/equipment/printers/[serial]/page.tsx` — full rewrite
- `webapp/src/app/api/equipment/printers/[serial]/route.ts` — no schema change needed
- `package.json` — add `recharts` if not present

## Verification
1. Machine information section visually looks "locked" (sunken bg, lock icon)
2. Condition is 3 toggles, not a textarea
3. Replace buttons are filled colour (YES=red, MAYBE=amber, NO=green)
4. Volume chart renders with counter type selector
5. Switching to "Colour" counter shows correct monthly colour deltas
