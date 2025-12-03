# Context

- Built a minimal Next.js app (app router) on port 3002 to iterate Jetline company schemas and collect machine data.
- `lib/companies.ts` carries the full company list with switch/host/port/split metadata; only ON entries are used.
- Server-side routes:
  - `POST /api/run-company` runs the provided machine query for a single schema (defaults to user `fortyone` / `fo123@!`), inserts results into SQLite (`data/runtime.db`). `truncate` clears previous rows.
  - `POST /api/reset` truncates `machine_data`.
  - `GET /api/companies` returns active companies; `GET /api/status` returns cached row count/last touch; `GET /api/export` streams the cache as CSV.
- Frontend (`app/page.tsx`) offers run-all and test-with-2 buttons, live status modal scoped to the current run (per-entity indicators/progress bar), and a CSV download button once data exists. UI copy no longer surfaces credentials.
- SQLite schema lives in `lib/sqlite.ts` (better-sqlite3); `MACHINE_DB_DIR`/`MACHINE_DB_PATH` envs can override data location. Machine query and row mapping live in `lib/query.ts`.
- Install deps with `npm install`, start with `npm run dev` (port 3002). Tests via `npm test` (Vitest, jsdom); covers sqlite insertion, row mapping, and UI render smoke.
