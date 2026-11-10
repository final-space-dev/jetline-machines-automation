# The Jetline kit in Machines

Machines' whole interface is built from the Jetline front kit that Archon
serves. This file is the record of that adoption and the rules that keep it
whole. It was done on 10 November 2026, on the `dev` branch, following
Archon's adoption playbook (`jetline-archon/docs/ui/ADOPTION-PLAYBOOK.md`).

## The three laws

1. **Dev branch only.** UI work lands on `dev` and is seen in the dev
   environment (`docs/DEV-ENVIRONMENT.md`). Never on the branch production is
   deployed from, never against the production database.
2. **The kit is never edited.** `src/components/ui/`, `src/lib/ui/` and
   `src/app/jetline-theme.css` are pulled from Archon. A change the kit needs
   is asked of Archon; a thing the kit lacks is composed from kit parts in
   `src/components/machines/`.
3. **The audit stays clean.** `npm run ui:audit` must print
   `ui-audit: N files clean` before any commit that touches `src/app` or
   `src/components`. It is part of `npm run gate`.

## Status

Every route, and whether it is on the kit. "Converted" means: built only from
kit components and Machines' layer, the audit clean over its files, looked at
on a 1280 px screen and a 390 px phone.

| Route | Screen | Status |
|---|---|---|
| `/login` | Sign in | Converted |
| `/` | Landing redirect by role | No interface |
| `/account` | Account | Converted |
| `/no-access` | No access yet | Converted |
| `/equipment` | All stores | Converted |
| `/equipment/stores` | Stores index | Converted |
| `/equipment/stores/[store]` | A store: equipment, printers, printer performance | Converted |
| `/equipment/stores/[store]/add` | Add equipment | Converted |
| `/equipment/items/[id]` | An equipment item | Converted |
| `/equipment/printers/[serial]` | A printer | Converted |
| `/equipment/fleet` | Fleet health | Converted |
| `/stores` | Redirect to All stores | No interface |
| `/stores/[id]` | Store analysis (utilisation) | Converted |
| `/operations` | Operations dashboard | Converted |
| `/machine-reports` | Machine reports, six tabs | Converted |
| `/reports/replacements` | Replacement requests | Converted |
| `/activity` | Activity | Converted |
| `/machine-mapping` | Machine mapping | Converted |
| `/setup` | Config: Stores, Machine Mapping, Import, Models, Suppliers, Equipment Types, Conditions, Users, Recently Deleted | Converted |
| `/setup/conditions`, `/setup/connections`, `/setup/equipment-types`, `/setup/models`, `/setup/store-groups`, `/setup/users` | Old deep links into Config | Converted (they render Config) |
| not-found and loading pages under `/equipment` | | Converted |

The frame around every signed-in page (menu, search, notifications, sync
progress, the phone menu) is the kit `Shell`, mounted once in
`src/app/(dashboard)/layout.tsx`.

### What changed in behaviour, and why

Presentation only was the rule: routes, API calls, permissions and business
rules are as they were. These are the places where fitting a kit component
changed how something is done:

- **Print volumes** (a store's Printer Performance tab) was a stacked bar per
  month. The kit bar chart draws series side by side, so the four counters
  stand beside each other and the monthly total is in the hover.
- **Fleet health's condition breakdown** was a chart whose segments switched
  the attention tab when clicked. It is now the condition bar with its legend;
  the tabs are switched by the tabs.
- **A store's condition tile** shows the count in good condition with the
  condition bar under it.
- **Bulk actions on equipment**: choosing a new status, condition or store
  now asks one confirming question instead of opening a small panel with an
  Apply button.
- **Deleting a supplier or a model** asks in the kit's dialog instead of the
  browser's own `confirm()`.
- **Config forms** (conditions, equipment types, models, suppliers, a store's
  groups, users, machine mapping) open in a dialog instead of a card above
  the table.
- **Config → Stores** is one table with a Holding Group column, ordered by
  holding group, instead of one table with a heading row per holding group.
- **A printer's condition** is a three-way choice with a Clear button (the
  old control cleared when the chosen value was clicked again).
- **Make / model and supplier** fields are the kit's searchable pick. Typing a
  value that is not in the list offers "Add new …" exactly as before.
- **The phone** has a top bar with search, the menu and the bell, and the
  menu opens as a sheet. The old bottom tab bar is gone.
- **Tables** hide their secondary columns on a narrow screen and scroll inside
  their card; the old separate phone card list for a store's equipment is
  gone. Reports keep every column and scroll sideways.
- **Two config panels that no tab reached** (`setup/connections/panel.tsx`,
  `setup/store-groups/panel.tsx`) were removed. Their old addresses still open
  Config.

## Where things are

| Path | What it is | Who changes it |
|---|---|---|
| `src/components/ui/` | The kit's components | Archon only (pulled) |
| `src/lib/ui/` | The kit's tokens, fonts, formats, `cn` | Archon only (pulled) |
| `src/app/jetline-theme.css` | The kit's theme | Archon only (pulled) |
| `src/app/globals.css` | Theme import, Machines' menu colour, the semantic solids as utilities, the print rule | Machines |
| `src/components/machines/` | Machines' own layer, built only from kit parts | Machines |
| `scripts/ui-audit.sh` | The gate | Machines |

### Pulling a newer kit

```
set -a; . ./.env.local; set +a
curl -fsS -H "Authorization: Bearer $ARCHON_KEY" "$ARCHON_URL/api/ui/install" -o jetline-ui.mjs
ARCHON_URL=$ARCHON_URL ARCHON_KEY=$ARCHON_KEY node jetline-ui.mjs --dir src/components/ui --lib src/lib/ui --theme src/app/jetline-theme.css
rm jetline-ui.mjs
```

Install any dependency the script prints, then run `npm run gate`. The pulled
version is recorded in `src/lib/ui/.jetline-ui.json` (this adoption pulled
`95b37ea6e828`, then `56b6c72c1df9` for the darker muted grey). The script's
list is general: `class-variance-authority` is on it and no kit file imports
it, so it is not installed here. If a pull changes a value in the kit's
`COLORS`, change the same value in the `@theme` block of `globals.css`. `ARCHON_URL` and `ARCHON_KEY` are in `.env.local`, which is
never committed.

### Colour

The kit is light only and its colours are its own. Machines adds two things,
both in `src/app/globals.css` and nowhere else:

- **The menu colour.** The kit Shell reads the `--face-*` variables; Machines
  sets them to the colours its navigation always had: Jetline red
  (`#E6121F`) on ink (`#161B24`).
- **The kit's semantic solids as utilities**: `bg-proven`, `bg-pending`,
  `bg-deficit`, `bg-signal`, `bg-track`, `text-faint` and so on. They are the
  kit's own `COLORS` values (`src/lib/ui/ui-tokens.ts`), named so that the few
  marks the kit has no component for (a condition bar, a figure that is bad)
  can use them without a colour literal.

No hex colour, Tailwind palette class or inline style appears in `src/app` or
`src/components`. The audit enforces it.

### Machines' layer (`src/components/machines/`)

| File | Gives |
|---|---|
| `machines-shell.tsx` | The frame: kit Shell, role-aware menu, phone bar and menu sheet, the DEV mark |
| `page.tsx` | `Page`: title, breadcrumbs, actions, toolbar, the scrolling working area, the bell |
| `panel.tsx` | `Panel`, `SectionHeading`, `Muted` |
| `data-table.tsx` | `DataTable`: the kit DataGrid with sorting, hidden columns on a phone, pages. The only file that may import the kit's raw table |
| `tile.tsx` | `Tile`, `TileRow`: figures |
| `field.tsx`, `read-field.tsx` | A labelled control; a labelled fact |
| `pick.tsx` | `Pick`: the kit Select from a list of options |
| `day-field.tsx` | `DayField`: a date from the kit Calendar |
| `file-picker.tsx` | `FilePicker`: the only file that may hold a native file input |
| `confirm.tsx` | `Confirm`: one question, one named action |
| `action-menu.tsx`, `row-actions.tsx`, `link-button.tsx`, `text-link.tsx` | Actions and links |
| `status-badge.tsx` | Every enum to a kit Badge: condition, equipment status, utilisation, completeness |
| `mix-bar.tsx` | `MixBar`, `ConditionBar`: how a whole splits |
| `charts.tsx` | `Bars`, `Lines`, `Donut`, `Legend` over the kit charts |
| `search-palette.tsx`, `notification-bell.tsx`, `sync-panel.tsx`, `toast-bridge.tsx` | The frame's parts |
| `empty.tsx`, `loading.tsx` | Nothing here; still fetching |

Toasts: call `toast.success()`, `toast.error()` or `toast()` from
`@/lib/toast`. The bridge hands them to the kit's toast.

## The audit

`scripts/ui-audit.sh` reads every `.tsx` under `src/app` and
`src/components` except the kit folder and fails on:

- a raw `<table>` or an import of the kit's table outside `data-table.tsx`
- an `<svg>` (icons come from `lucide-react`)
- a native select, checkbox, date or time input, or file input (outside `file-picker.tsx`)
- a bare `<button>` (use the kit `Button`)
- `role="switch"`, `animate-spin`
- a hex colour, an `oklch()` literal, a Tailwind palette class (`bg-red-500`, `text-white`)
- an arbitrary pixel size (`w-[12px]`)
- an inline `style={{ … }}`
- a `description=` prop (headings stand alone)
- a `DataGrid` inside a `.map()` (one kind of thing belongs in one table)

Run it with `npm run ui:audit`. `npm run gate` runs the audit, the type
check, the unit tests and the build.

## Screenshots

Before a UI change is called done it is looked at, signed in, on a 1280 px
screen and a 390 px phone, against the dev database and never the production
one. `docs/DEV-ENVIRONMENT.md` says how to run a local copy on the dev
database.

## Lint

`npm run lint` reported errors before this work and still does: the React
compiler rules object to the way the pages load their data in an effect
(`useEffect(() => { load(); }, [load])`). Those are data fetching, which this
adoption did not touch. The kit folders are excluded from lint because they
are not edited here.
