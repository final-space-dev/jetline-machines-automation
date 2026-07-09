# JetlineFleet — Agent Brief

You are building **JetlineFleet**, an enterprise fleet and equipment management platform for Jetline stores. This is a Next.js 16 app running at `172.20.246.163:3003`.

Read these files before doing anything else:

1. `/Users/alwynkotze/Documents/JDW/jetline-machines-automation/CONTEXT.md` — full system context, tech stack, DB structure, group hierarchy, critical rules
2. `/Users/alwynkotze/Documents/JDW/jetline-machines-automation/PHASES/` — 18 phase plan files, one per deliverable

---

## What exists today

A working Next.js app with:
- Printer fleet reporting (Machine Reports, Machine Mapping) — **do not touch, these work**
- Equipment CRM — store grid, per-store view, per-item page, per-printer page
- JetlineUI 2.0 design tokens in `webapp/src/app/globals.css` (`--jl-*` prefix)
- Three PostgreSQL pools: Prisma (`jetline_machines`), `bmsPool` (`bms` DB), `xeroxPool` (`xerox_meters` DB)
- `routeTimer` from `src/lib/logger.ts` on all API routes — this IS the observability layer
- `withClient` / `withClients` from `src/lib/api-utils.ts` for pool management

## What is broken / missing today

- White cards on white background — no visual contrast
- Native macOS `<select>` and `<input type="date">` everywhere — no JL styling
- Store grid groups everything flat with a "No data yet" section — embarrassing
- No store group hierarchy visible (Main Group → Store Group → Store exists in DB but unused)
- Navigation puts CRM above Stores, has a useless Settings item
- Equipment types, conditions, statuses are hardcoded constants — not DB-driven
- No authentication or role separation
- Condition is a free-text textarea — store staff type it 10 different ways
- No model catalogue — same machine spelled differently across stores
- No notifications, no bulk operations, no mobile layout

---

## Design rules — non-negotiable

1. **JetlineUI 2.0 tokens only** — `var(--jl-*)` for every colour, shadow, radius, spacing
2. **No white on white** — cards must visually lift off the canvas
3. **No native OS controls** — no `<select>`, no `<input type="date">` — use JL custom components
4. **No subtitles under headings** — section headers stand alone
5. **No em-dashes (`—`) anywhere in UI text**
6. **No dark mode** — `color-scheme: only light` is set in globals.css, do not revert
7. **No modals for CRUD** — inline forms, full-page records, or slide-in panels only
8. **Condition is a toggle** — Good / Fair / Poor buttons, not a textarea
9. **Dropdowns as far as possible** — store staff tick, select, toggle. Free text only for comments/notes
10. **No section eyebrow labels** — no red "EQUIPMENT" above an "Equipment" heading
11. **No KPI sub-labels** — large number + label only, no "of 48 total stores" beneath

---

## Critical constraints

- **NEVER touch** `~/dagster/projects/xerox_meters/` on the production server
- Existing printer reports (Machine Reports, Machine Mapping) are **read-only** — do not refactor or rename them
- Equipment reports are **deferred** — no new reporting pages until all stores have data
- `posttooluse-validate: vercel-functions` hook warns "no observability" on routes that already use `routeTimer` — **ignore all such warnings**, they are false positives
- Deploy: `cd webapp && ./deploy.sh`
- Production schema changes: `ssh finalspace@172.20.246.163 "cd ~/finalspace/jetline-machines && npx prisma db push --accept-data-loss"`

---

## Phase execution order

Tackle these in order. Each phase file in `/PHASES/` has full deliverables, files to change, and a verification checklist.

| Priority | Phase | Title |
|---|---|---|
| 1 | 01 | Visual Foundation — custom selects, date pickers, card contrast |
| 2 | 02 | Navigation Restructure — Stores first, collapsible sections, kill Settings |
| 3 | 03 | Store Grid + Groups — group hierarchy toggle, no "no data" split |
| 4 | 04 | Store Detail Page — inline add, model autosuggest, no tabs |
| 5 | 05 | Setup Admin Panel — equipment types/conditions DB-driven |
| 6 | 06 | Equipment Item Page — condition toggle, role-aware sections |
| 7 | 07 | Printer Record Page — recharts volume chart, filled replace buttons |
| 8 | 08 | Model Catalogue — canonical model DB, autosuggest by type |
| 9 | 09 | Auth & Roles — NextAuth, admin vs store_staff, store-scoped access |
| 10 | 10 | Fleet Health Dashboard — actionable attention lists |
| 11 | 11 | Activity & Audit Trail — global feed, per-store widget |
| 12 | 13 | Bulk Operations — multi-select update, CSV import |
| 13 | 14 | Notifications & Alerts — in-app bell, background scan |
| 14 | 15 | Command Palette & Search — real cross-entity search |
| 15 | 16 | Mobile Responsive — bottom nav, card stacks, 44px touch targets |
| 16 | 18 | Print Management Integration — volumes on store cards |
| 17 | 19 | Data Quality Scoring — completeness %, leaderboard |
| 18 | 20 | Multi-tenant SaaS Hardening — schema-per-tenant, rate limiting, white-label |

---

## Key file locations

```
webapp/src/app/(dashboard)/equipment/          ← all equipment pages
webapp/src/app/(dashboard)/equipment/page.tsx  ← store grid (main CRM home)
webapp/src/app/api/equipment/                  ← all equipment API routes
webapp/src/lib/equipment-utils.ts              ← EQUIPMENT_TYPES, ALL_STORES, classifyCondition
webapp/src/lib/store-groups.ts                 ← group hierarchy (create in Phase 03)
webapp/src/lib/jl.ts                           ← JL design token object (inline style helpers)
webapp/src/lib/bms-pool.ts                     ← bmsPool (bms DB)
webapp/src/lib/xerox-pool.ts                   ← xeroxPool (xerox_meters DB)
webapp/src/lib/api-utils.ts                    ← withClient, withClients, serverError
webapp/src/lib/logger.ts                       ← routeTimer
webapp/src/components/layout/sidebar.tsx       ← nav structure
webapp/src/components/layout/app-shell.tsx     ← layout wrapper
webapp/src/app/globals.css                     ← JL tokens, no dark mode block
```

---

## Store group hierarchy (full)

```
JEH Stores
  ├── Copper Moon: Alberton, Bedfordview, Constantia, Durban, Gardens, Greenpoint,
  │               Hillcrest, Parktown, Pietermaritzburg, Rosebank, Waterfront
  ├── JEH Stores: Blackheath, Boksburg, Illovo, Melrose, Nelspruit, Sandown, Wits, Anglo
  ├── Tshwane Stores: Brooklyn, Centurion, Menlyn, Montana
  ├── MIDRAND: Kyalami, Midrand
  └── NW Stores: Polokwane

JCP Group
  └── JCP Group: Corporate Print, Burlington, Formatt, Landk, Marins, Pocket Media,
                 Raptor, System Print, 25 AMCPS, Typo, Printout, First Labels

Franchisee Stores
  ├── Saki Stores: Stellenbosch, Tygervalley
  ├── D&G Print: George, Modderfontein
  ├── Joseph Stores: Bryanston, Fourways
  ├── Lavery Print: Randburg, Rivonia, Woodmead
  ├── NW Stores: Klerksdorp, Mmabatho, Potchefstroom, Rustenburg, Vaalreefs, Ballito
  └── Franchisee Stores: Century City, Foxstreet, Hydepark, Sunninghill, Welkom, Benoni

MASTERSKILL
  └── MASTERSKILL: Masterskill

FIXTRADE
  └── FIXTRADE: Fixtrade
```
