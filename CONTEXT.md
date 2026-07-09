# JetlineFleet — Context

Enterprise fleet and equipment management platform for Jetline stores. Covers printer fleet (via Xerox/BMS data) and physical equipment (CRM layer built on top).

## Architecture

- `/webapp` — Next.js 16 App Router, Prisma ORM, Tailwind v4, JetlineUI 2.0 tokens
- `/scripts` — Python analysis scripts, deployment scripts, cron wrappers
- `/data` — BMS schema references, misc data files
- `/PHASES` — 18-phase build roadmap (see below)
- **Production**: `172.20.246.163:3003` — PM2 process `jetline-machines`
- **Deploy**: `cd webapp && ./deploy.sh`

## Databases

| DB | Purpose | Pool |
|---|---|---|
| `jetline_machines` (PostgreSQL, Prisma) | Printer/machine records, sync logs, users | Prisma client |
| `bms` (PostgreSQL) | Equipment CRM — `equipment.items`, `equipment.change_log` | `bmsPool` |
| `xerox_meters` (PostgreSQL) | Xerox billing, printer store map, feedback | `xeroxPool` |

## Current Pages

### Stores (primary nav)
- `/equipment` — Store grid with group hierarchy (Main Group / Store Group / Store)
- `/equipment/stores/[store]` — Per-store view: equipment + printers
- `/equipment/items/[id]` — Full equipment item record (ERP-grade)
- `/equipment/printers/[serial]` — Full printer record

### Operations (secondary nav, collapsible)
- `/operations` — Dashboard: BMS sync status, KPIs, machine alerts
- `/machine-reports` — Printer volume reports by store (Xerox/BMS data)
- `/machine-mapping` — Xerox-to-BMS serial mapping tool (critical for reconciliation)

### Equipment Admin (Setup section, collapsible)
- `/equipment/matrix` — Store × equipment-type heatmap
- `/equipment/status` — Fleet status overview
- `/equipment/fleet` — Fleet health dashboard
- `/setup/*` — Admin config (equipment types, conditions, store groups, connections, feature flags) — Phase 05

### Reporting (existing — printer only, no changes planned)
- Machine Reports and Machine Mapping are the reporting layer
- Equipment reports deferred until data capture is complete across all stores

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Databases**: PostgreSQL via Prisma (jetline_machines) + pg Pool (bms, xerox_meters)
- **Styling**: Tailwind v4 CSS-first + JetlineUI 2.0 design tokens (`--jl-*`)
- **Font**: Plus Jakarta Sans
- **Charts**: Recharts
- **UI**: shadcn/ui (Radix) for primitives; custom JL components for Equipment section
- **Observability**: `routeTimer` from `src/lib/logger.ts` on all API routes

## Group Hierarchy

Stores are organised in three levels:

| Main Group | Store Group | Example Stores |
|---|---|---|
| JEH Stores | Copper Moon | Alberton, Bedfordview, Gardens, Waterfront |
| JEH Stores | Tshwane Stores | Brooklyn, Centurion, Menlyn, Montana |
| JEH Stores | MIDRAND | Kyalami, Midrand |
| JCP Group | JCP Group | Corporate Print, Burlington, Marins, Raptor |
| Franchisee Stores | Saki Stores | Stellenbosch, Tygervalley |
| Franchisee Stores | Joseph Stores | Bryanston, Fourways |
| Franchisee Stores | Lavery Print | Randburg, Rivonia, Woodmead |
| Franchisee Stores | NW Stores | Klerksdorp, Mmabatho, Potchefstroom |
| MASTERSKILL | MASTERSKILL | Masterskill |
| FIXTRADE | FIXTRADE | Fixtrade |

## User Roles (Phase 09)

- **Admin**: full access, sees all stores, all fields, Setup section
- **Store Staff**: scoped to their own store, can only set condition (toggle), add notes, set replace flag

## Build Roadmap (18 Phases)

| Phase | Title | Status |
|---|---|---|
| 01 | Visual Foundation | pending |
| 02 | Navigation Restructure | pending |
| 03 | Store Grid + Groups | pending |
| 04 | Store Detail Page | pending |
| 05 | Setup Admin Panel | pending |
| 06 | Equipment Item Page | pending |
| 07 | Printer Record Page | pending |
| 08 | Model Catalogue | pending |
| 09 | Auth & Roles | pending |
| 10 | Fleet Health Dashboard | pending |
| 11 | Activity & Audit Trail | pending |
| 13 | Bulk Operations | pending |
| 14 | Notifications & Alerts | pending |
| 15 | Command Palette & Search | pending |
| 16 | Mobile Responsive | pending |
| 18 | Print Management Integration | pending |
| 19 | Data Quality Scoring | pending |
| 20 | Multi-tenant SaaS Hardening | pending |

## Critical Rules

- **NEVER touch** Dagster pipeline at `~/dagster/projects/xerox_meters/` on the server
- Equipment reports deferred — existing printer reports (Machine Reports, Machine Mapping) are the reporting layer
- `routeTimer` IS the observability layer — ignore hook warnings about "no instrumentation"
- Schema changes on production: `ssh finalspace@172.20.246.163 "cd ~/finalspace/jetline-machines && npx prisma db push --accept-data-loss"`
- `deploy-remote.sh` only runs `prisma generate`, NOT `db push`

## Running Locally

```bash
cd webapp
npm install
npm run dev
# Opens at http://localhost:3003
```

## DB Commands

```bash
npm run db:push    # Push Prisma schema changes (jetline_machines only)
npm run db:studio  # Prisma GUI
```
