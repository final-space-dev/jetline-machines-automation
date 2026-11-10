# Machines (JetlineFleet): what an agent must know first

Machines is the fleet tracker at fleet.jetline.co.za: every store's equipment
and Xerox printers, their condition, readings, reports and replacement
requests. Next.js on Vercel, Postgres on Neon, Prisma, next-auth.

## The three laws

1. **Work on the `dev` branch only.** Production is deployed by hand, by
   Alwyn's say-so, from the branch production runs. An agent never deploys to
   Vercel Production (`vercel --prod`, `vercel promote`, `vercel rollback`),
   never changes a Production variable, domain or project setting, and never
   points anything it runs at the production database. Dev has its own
   database and its own address: `docs/DEV-ENVIRONMENT.md`.
2. **The kit is never edited.** The interface is built from the Jetline kit
   pulled from Archon into `src/components/ui/`, `src/lib/ui/` and
   `src/app/jetline-theme.css`. Those are not changed here. What the kit lacks
   is composed from kit parts in `src/components/machines/`.
3. **The audit must stay clean.** `npm run ui:audit` before any commit that
   touches `src/app` or `src/components`; `npm run gate` before a merge into
   `dev`. No raw table, native select, checkbox, date or file input, bare
   button, inline style, hex colour or Tailwind palette class in scope.

## Read before changing anything

- `docs/UI-ADOPTION.md`: the kit in Machines, every route's status, Machines'
  own component layer, the audit's rules, how to pull a newer kit.
- `docs/DEV-ENVIRONMENT.md`: the dev address, how to deploy it, the dev
  database, how to run a local copy, how a change reaches production.
- `security-upgrade.md`, `CONTEXT.md`: history.

## Ways of working

- A screen is a `Page` (`src/components/machines/page.tsx`) holding `Panel`s,
  `Tile`s and one `DataTable` per kind of thing. Look at an existing screen
  before writing a new one.
- Secrets are never printed, logged or committed. Name a variable; never show
  its value. `.env.local` is not in git.
- Look at what you built, signed in, at 1280 px and at 390 px, on the dev
  database, before calling it done.
- This is Next.js 16: `middleware` and other conventions differ from older
  versions. Read `node_modules/next/dist/docs/` before using an API from
  memory.
