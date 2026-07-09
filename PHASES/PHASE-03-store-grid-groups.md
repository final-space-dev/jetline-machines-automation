# Phase 03 — Store Grid with Group Hierarchy

## Goal
The store grid at `/stores` (currently `/equipment`) groups stores by the three-level hierarchy from the company data: Main Group → Store Group → Store. Users can switch between group views using a toggle. No more "stores with data" vs "no data yet" split.

## Problems being solved
- Flat alphabetical list with a "no data yet" section reads like a spreadsheet error log
- Store owners want to see their 5 stores together, not mixed alphabetically with 43 others
- The three-level hierarchy (JEH Stores → Copper Moon → Alberton) exists in the DB but is never surfaced
- No way to filter by franchise group, holding company, or store group

## Group hierarchy (from company data)

| Main Group | Store Group | Stores |
|---|---|---|
| JEH Stores | Copper Moon | Alberton, Bedfordview, Constantia, Durban, Gardens, Greenpoint, Hillcrest, Parktown, Pietermaritzburg, Rosebank, Waterfront |
| JEH Stores | JEH Stores | Blackheath, Boksburg, Illovo, Melrose, Nelspruit, Sandown, Wits, Anglo |
| JEH Stores | Tshwane Stores | Brooklyn, Centurion, Menlyn, Montana |
| JEH Stores | MIDRAND | Kyalami, Midrand |
| JEH Stores | NW Stores | Polokwane |
| JCP Group | JCP Group | Corporate Print, Burlington, Formatt, Landk, Marins, Pocket Media, Raptor, System Print, 25 AMCPS, Typo, Printout, First Labels |
| Franchisee Stores | Saki Stores | Stellenbosch, Tygervalley |
| Franchisee Stores | D&G Print | George, Modderfontein |
| Franchisee Stores | Joseph Stores | Bryanston, Fourways |
| Franchisee Stores | Lavery Print | Randburg, Rivonia, Woodmead |
| Franchisee Stores | NW Stores | Klerksdorp, Mmabatho, Potchefstroom, Rustenburg, Vaalreefs, Ballito |
| Franchisee Stores | Franchisee Stores | Century City, Foxstreet, Hydepark, Sunninghill, Welkom, Benoni |
| MASTERSKILL | MASTERSKILL | Masterskill |
| FIXTRADE | FIXTRADE | Fixtrade |

## Deliverables

### 1. Group mapping constant (`src/lib/store-groups.ts`)
```ts
export const STORE_GROUPS: StoreGroupEntry[] = [
  { mainGroup: "JEH Stores", storeGroup: "Copper Moon", store: "Alberton", holdingGroup: "Equity Holdings" },
  ...
]
// Helper lookups:
export function getStoreGroup(store: string): StoreGroupEntry | undefined
export function getMainGroups(): string[]
export function getStoreGroupsByMain(main: string): string[]
export function getStoresByGroup(storeGroup: string): string[]
```

### 2. All-stores API update (`/api/equipment/all-stores`)
Add group data to each store in the response:
```json
{
  "name": "Alberton",
  "mainGroup": "JEH Stores",
  "storeGroup": "Copper Moon",
  "holdingGroup": "Equity Holdings",
  "equipment_count": 12,
  "machine_count": 3,
  "has_data": true,
  "condition": { "good": 8, "fair": 3, "poor": 1 }
}
```

### 3. Group view toggle on store grid
Three toggle buttons above the grid:
- **By Store** — flat A–Z grid (current behaviour, no "no data" split)
- **By Store Group** — grouped cards: "Copper Moon (11 stores)" header, stores inside
- **By Main Group** — larger group headers: "JEH Stores (31 stores)"

Toggle state persists to localStorage.

### 4. Group header card design
When grouped, each group gets a summary row above its store cards:
- Group name (bold, 16px)
- Total equipment count across group stores
- Aggregate condition bar
- Collapse/expand the group's cards

### 5. Remove the "no data yet" section
All stores appear in the same grid. Stores with no equipment data get a subtle dashed border and a quiet amber dot — they don't get banished to a separate section.

## Files to change
- `webapp/src/lib/store-groups.ts` — NEW
- `webapp/src/app/api/equipment/all-stores/route.ts` — add group fields
- `webapp/src/app/(dashboard)/equipment/page.tsx` — group toggle + grouped rendering
- `webapp/src/app/(dashboard)/stores/page.tsx` — redirect or merge into above

## Verification
1. Toggle "By Store Group" → stores appear under "Copper Moon", "Tshwane Stores", etc.
2. Toggle "By Main Group" → three big sections: JEH Stores, JCP Group, Franchisee Stores
3. Alberton card shows correct group badge
4. Stores with no equipment data appear in the grid with dashed border, not a separate section
5. Group headers show aggregate condition bar and total count
