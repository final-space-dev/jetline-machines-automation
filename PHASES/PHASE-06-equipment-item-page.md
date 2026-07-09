# Phase 06 — Equipment Item Full Record Page

## Goal
The per-item page at `/equipment/items/[id]` becomes a complete ERP record with role-aware editing. Admins see all fields and can edit everything. Store staff can only update condition (via dropdown toggle, not free text) and add notes comments.

## Problems being solved
- All fields are editable by anyone — no role separation
- Condition is a free-text textarea — store staff type "its broken" in 10 different ways
- Purchase date, price, warranty, service fields use native `<input type="date">` with macOS chrome
- Section headers have subtitles ("Purchase details, supplier and warranty") 
- No photo upload UI (photos field exists in DB but is never populated)
- Auto-save fires on every keystroke with no visual confirmation

## Role behaviour (no auth yet — use localStorage admin flag from Setup)
- **Admin view**: all fields editable, full procurement and service sections visible
- **Store view**: only Condition (3-button toggle), Notes comment box, and Replace recommendation visible. Everything else read-only.

## Page layout

```
[Sticky bar: breadcrumb | Auto-save indicator | Save button (⌘S)]

[Identity card]
  Equipment Type    Make/Model    Serial Number    Store
  Status toggle (Active/Inactive/Disposed/Transferred)

[Condition card — visible to all]
  Condition: [Good] [Fair] [Poor] toggle buttons  ← replaces free-text
  Replace: [Yes] [Maybe] [No] toggle
  Notes: textarea (only free-text store staff can fill)

[Procurement card — admin only]
  Purchase Date (JL date picker)    Supplier (text)    Price (number)
  Warranty Expiry (JL date picker)

[Service card — admin only]
  Last Serviced (JL date picker)    Next Due (JL date picker)    Provider (text)
  Overdue warning banner if next_due < today

[Photos card — admin only]
  Upload area (drag-and-drop or click)
  Stored as file paths or base64 in photos[] column

[Change history — admin only]
  Last 50 changes in a clean table
```

## Deliverables

### 1. Condition as enum, not free text
- Replace textarea with 3-button toggle: Good / Fair / Poor
- DB stores the bucket string directly (not a prose description)
- `classifyCondition()` in equipment-utils becomes unnecessary for new records
- Old free-text condition values remain readable as a "legacy notes" display

### 2. JL date picker integration (from Phase 01)
All date fields use the custom `JlDate` component.

### 3. Role flag
`localStorage.getItem("jl_admin")` === `"true"` shows admin sections.
Toggle in `/setup/features` sets this flag.

### 4. Auto-save UX
- Pulse dot "Saving…" while PATCH in flight
- Green check "Saved" for 3s after success, then disappears
- No save indicator when page is clean (not dirty)

### 5. Photo upload
- `<input type="file" multiple accept="image/*">` hidden, triggered by styled button
- Files uploaded to `/api/equipment/items/[id]/photos` (POST multipart)
- Stored as URLs in `photos TEXT[]` column
- Displayed as a small image grid with delete (×) on each

## Files to change
- `webapp/src/app/(dashboard)/equipment/items/[id]/page.tsx` — full rewrite
- `webapp/src/app/api/equipment/items/[id]/route.ts` — condition as enum in PATCH
- `webapp/src/app/api/equipment/items/[id]/photos/route.ts` — NEW
- `webapp/src/components/ui/jl-date.tsx` — consumed here (from Phase 01)

## Verification
1. Condition shows 3 toggle buttons, not a textarea
2. Selecting "Poor" immediately saves and updates the condition pill on the store page
3. Admin sections (procurement, service, history) hidden when localStorage admin flag is false
4. Date fields open calendar popover, not macOS date picker
5. Upload a photo → thumbnail appears in the photos card
