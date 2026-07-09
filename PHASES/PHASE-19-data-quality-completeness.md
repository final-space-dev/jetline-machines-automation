# Phase 19 — Data Quality & Completeness Scoring

## Goal
Every store has a "completeness score" that measures how well their equipment data is filled in. Admins can see which stores are ignoring the system and which are actively keeping records updated. Gamification encourages data hygiene.

## Problems being solved
- 25 stores currently have zero equipment records — nobody is held accountable
- Even stores with records have massive gaps: no serial numbers, no service dates, no models
- No metric to measure whether the system is being used well
- No way to report to management on data quality

## Completeness scoring formula

Per equipment item, score out of 100:
- machine_type filled: 10pts (always true if item exists)
- make_model filled: 15pts
- serial filled: 15pts
- condition set: 20pts
- status set (not default "active"): 5pts
- purchase_date filled: 10pts
- warranty_expiry filled: 5pts
- last_serviced filled: 10pts
- next_service_due filled: 10pts

Per store:
- Average item score across all items
- Printer completeness: % of printers with condition set, age set, replace_flag set
- Combined weighted score: 70% equipment + 30% printer feedback

## Deliverables

### Completeness API: `GET /api/stores/[store]/completeness`
Returns:
```json
{
  "store": "Alberton",
  "equipmentScore": 72,
  "printerScore": 45,
  "overallScore": 62,
  "itemBreakdown": [{ "id": 1, "type": "Guillotine", "score": 85, "missing": ["serial", "purchase_date"] }],
  "printerBreakdown": [{ "serial": "SN123", "score": 33, "missing": ["condition", "age"] }]
}
```

### Completeness badge on store cards
Small score badge (e.g. "62%") in bottom-right of store card.
Colour: green (>80%), amber (50–80%), red (<50%).

### Completeness page: `/stores/[store]/completeness`
Shows the full item breakdown with exactly what's missing for each item.
Each missing field is a link that opens that item page with the field highlighted.
"Fill in all missing fields" CTA at top — goes through each incomplete item sequentially.

### Leaderboard widget on Fleet Health page
Top 5 and bottom 5 stores by completeness score.
"Alberton is your most complete store (94%). Klerksdorp needs attention (12%)."

### Admin report: Data Quality (`/reports/data-quality`)
Table of all stores with: overall score, items count, items with no serial, items with no service date, printers with no condition.
Exportable to CSV.
Use as a management accountability report.

## Files to change
- `webapp/src/app/api/stores/[store]/completeness/route.ts` — NEW
- `webapp/src/app/api/reports/data-quality/route.ts` — NEW
- `webapp/src/app/(dashboard)/equipment/page.tsx` — add completeness badge to store card
- `webapp/src/app/(dashboard)/equipment/stores/[store]/page.tsx` — add completeness summary
- `webapp/src/app/(dashboard)/stores/[store]/completeness/page.tsx` — NEW
- `webapp/src/app/(dashboard)/reports/data-quality/page.tsx` — NEW
- `webapp/src/app/(dashboard)/equipment/fleet/page.tsx` — add leaderboard widget

## Verification
1. Store card shows completeness badge (62% for Alberton)
2. `/stores/Alberton/completeness` shows item breakdown with missing fields listed
3. Clicking a missing field link opens that item with the field visually highlighted
4. Fleet Health leaderboard shows top 5 and bottom 5 correctly
5. Data Quality report exports CSV with all stores ranked by score
