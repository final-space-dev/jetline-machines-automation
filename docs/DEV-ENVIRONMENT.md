# Machines' dev environment

A copy of Machines that is safe to break: its own address, its own database,
its own secrets. Built on 10 November 2026. Production (fleet.jetline.co.za)
is not touched by anything on this page.

## At a glance

| | Production | Dev |
|---|---|---|
| Address | https://fleet.jetline.co.za | https://jetline-machines-dev.vercel.app |
| Vercel project | `jetline-machines` | `jetline-machines-dev` (a separate project) |
| Git branch | `flatten-to-root` (deployed by hand with the CLI) | `dev` (deployed by `scripts/deploy-dev.sh`) |
| Database | Neon project `jetline-machines-database`, branch `main` | The same Neon project, branch `dev` |
| Mark on screen | none | **DEV** beside the name in the menu, on the phone bar and on the sign-in page |

Both Vercel projects are in the FinalSpace team. The Neon project is in the
FinalSpace Neon organisation, region eu-central-1.

### Why dev is its own Vercel project

The plan was a Preview deployment of `dev` inside `jetline-machines`. That
cannot work today: every new Preview deployment of `jetline-machines` stops
before the build with "Resource provisioning timed out". The step that hangs
is the Neon integration connected to that project, which is asked to prepare
a database for each preview and never answers (five attempts on 10 November
2026, from git pushes and from the CLI; the last preview that worked was on
2 November). So the dev copy is a separate project with no integrations:
nothing in it can touch production, and nothing in production's project can
break it.

## Opening it

The dev address is behind Vercel's deployment protection, set to cover every
address of the dev project: Vercel asks you to sign in to Vercel before it
shows the page. On the iPad, sign in to Vercel once in Safari and the address
opens from then on. Anything that asks without signing in (Archon's check,
`curl`) is redirected to Vercel's sign-in (`302`); that answer means the
deployment is up and protected, not that it is down.

Then sign in to Machines itself with a dev account. The dev database is a
copy of production's, so production's accounts exist there with the passwords
they had when the copy was taken. Two accounts exist only on dev:
`dev-admin@jetline.local` (admin) and `dev-store@jetline.local` (store staff,
Alberton). Their password is not written down anywhere in git; make the
accounts again with a new one when needed (see "A local copy on the dev
database").

## Deploying dev

```
git checkout dev && git pull
scripts/deploy-dev.sh
```

The script refuses to run on any other branch or with uncommitted changes. It
names the dev project by id, checks that the id still belongs to a project
called `jetline-machines-dev`, makes a **Preview** deployment of it and points
`jetline-machines-dev.vercel.app` at that deployment. It contains no
production deploy flag.

A push to `dev` deploys nothing. `vercel.json` switches off git deployments
for `dev` and `ui/archon-kit`, because a push would otherwise start a preview
in production's project that fails at the Neon step.

Run by hand from this checkout, `vercel` acts on the project the checkout is
linked to, which is production's. Do not run `vercel deploy`, `vercel --prod`,
`vercel promote` or `vercel rollback` by hand here. The script is the only
deploy an agent runs.

## Variables

Dev's variables live on the project `jetline-machines-dev`. Names only; values
are never written here or anywhere in git.

| Name | What it is |
|---|---|
| `DATABASE_URL` | The pooled address of the Neon branch `dev` |
| `AUTH_SECRET` | next-auth's signing secret, dev's own (a production session is not valid on dev) |
| `CRON_SECRET` | Dev's own |
| `JL_ENVIRONMENT` | `dev`. Turns on the DEV mark and makes photos read-only (`src/lib/environment.ts`) |

Each is set for the dev project's Preview environment, which is what the
script deploys, and for its Production environment in case Vercel ever treats
a deployment of the dev project as its production one (it did so for the very
first deployment of the new project).

To change one, name the project explicitly so the command cannot land on
production's project (the value is typed at the prompt, never put on the
command line):

```
VERCEL_ORG_ID=team_rdzvPFmt6vykW9Fg69BxJNi0 VERCEL_PROJECT_ID=prj_v9CCDtNAkX7ACQegeOpg3DuOurxk vercel env add NAME preview --sensitive
```

Never add, change or remove a variable on `jetline-machines`.

## The dev database

Neon branch `dev` of project `jetline-machines-database`, made from `main` on
10 November 2026. It is a full copy as of that moment: every store, item,
reading and user. It is separate storage from then on: a change on dev never
reaches production, and production's later changes do not appear on dev.

To refresh dev from production (this throws away everything changed on dev):

```
neonctl branches reset dev --parent --project-id <the project id>
```

The branch keeps its address, so `DATABASE_URL` stays right. The dev-only
accounts disappear with the reset; make them again. Until production has the
`meter_readings` table (see "Known gaps"), run `prisma/sql/meter_readings.sql`
on the dev branch again after a reset.

Schema changes: run them against dev first (`DATABASE_URL` of the dev branch
in the shell, then `npx prisma db push`). Never run a migration, a seed or a
script against production's database from a dev checkout.

## A local copy on the dev database

```
# .env.local (never committed): DATABASE_URL of the Neon dev branch,
# AUTH_SECRET, NEXTAUTH_URL=http://localhost:3033
npm run build && npx next start -p 3033
```

Check before starting that `DATABASE_URL` in `.env.local` is the dev branch
(its host begins `ep-bold-sun`), not production. Stop the server when done;
this laptop is short of memory.

To make the dev-only admin (the script creates the account; it does not
change the password of one that exists, so remove the account in Config →
Users first if it is there):

```
SEED_ADMIN_EMAIL=dev-admin@jetline.local SEED_ADMIN_NAME="Dev Admin" SEED_ADMIN_PASSWORD='<a new password>' npx tsx scripts/seed-users.ts
```

## What dev may not do

- **Photos are read-only on dev, and do not display.** The dev database copy
  holds the addresses of production's photos. The upload and delete routes
  refuse on the dev copy and on any preview
  (`src/app/api/equipment/items/[id]/photos/route.ts`), so a click on dev can
  never remove a photo production shows. The dev project is not connected to
  the photo store at all, so photos show as broken images there.
- **BMS sync does nothing on dev.** The BMS databases are on the stores'
  private network, which Vercel cannot reach. The sync button fails; that is
  expected.
- Machines sends no email or SMS, so there is nothing else to switch off.

## From dev to production

Production is Alwyn's call, each time:

1. The change is on `dev`, `npm run gate` passes, it is deployed with
   `scripts/deploy-dev.sh` and it has been looked at on the dev address.
2. Alwyn says to release.
3. `dev` is merged into the branch production is deployed from
   (`flatten-to-root`) and that branch is deployed to Production by hand.

An agent does step 1 only.

## Known gaps (10 November 2026)

- **Previews of `jetline-machines` are broken** ("Resource provisioning timed
  out" at the Neon integration step, see above). It is not known whether a
  production deployment of `jetline-machines` runs the same step. If the next
  production deploy hangs the same way, the fix is in the Neon integration's
  connection to the project (Vercel dashboard, Storage), not in the code.
  Production itself keeps running on its last deployment either way.
- **Leftovers in `jetline-machines` from the first attempt**: three Preview
  variables scoped to the branch `dev` (`DATABASE_URL`, `AUTH_SECRET`,
  `CRON_SECRET`; they point at the dev database and nothing uses them) and
  five failed preview deployments of 10 November. They can be removed in the
  dashboard; an agent leaves production's project alone.
- **Leftovers in `jetline-machines-dev`**: its very first deployment was made
  its Production deployment by Vercel and was built before the variables
  existed, so it does not work. It sits at
  `jetline-machines-dev-finalspace-alwyns-projects.vercel.app`; the dev
  address does not point at it. It can be removed in the dashboard.
- **A deployment-protection bypass token exists on the dev project.** The CLI
  made it the first time `vercel curl` was used. It is how an automated check
  gets past Vercel's sign-in: `vercel curl /login --deployment <address>`
  with the dev project named as in "Variables", or a browser script that
  sends the token in the `x-vercel-protection-bypass` header (read the token
  from the project with the API into a private file; never print or commit
  it). Whoever holds it can reach the dev sign-in page without a Vercel
  account, so remove it in the dashboard if that is not wanted.
- Vercel's "production branch" setting for `jetline-machines` is `main`, which
  is far behind what production actually runs (`flatten-to-root`, deployed by
  the CLI), and git deployments are switched on. A push to `main` would try to
  deploy old code to production. Decide which branch is production and make
  the setting agree.
- **BMS credentials in the code (Archon Work W-85).**
  `src/lib/bms/connection.ts` falls back to a database user and password
  written in the code when `BMS_DB_USER` and `BMS_DB_PASSWORD` are not set.
  They were left in place on 10 November 2026 because production's project
  has neither variable (checked by name only), so removing the fallback would
  change what production does. To remove them: add both variables to
  production's project first, or decide the BMS sync is retired (it cannot
  reach the stores' network from Vercel) and delete the module; then change
  the password itself, since it has been in git.
- The box still has a `jetline_machines` database and the repository still
  has `deploy.sh` and `ecosystem.config.cjs` from the time Machines ran
  there; nothing runs from them. (Archon's register now says Neon.)
- **The Prisma table `meter_readings` is missing from the database (W-86).**
  `/api/machines/utilization` answered 500 because `public.meter_readings`,
  the table behind the Prisma model `MeterReading`, does not exist. The dev
  branch is a copy of production's database, so production lacks it too, and
  there the same routes fail: `/api/machines/utilization` (the store analysis
  page, `/stores/[id]`), the reading count in `/api/health/detailed` and in
  `/api/sync`, and the BMS sync. Print volumes are not affected; they come
  from `xerox.meter_readings_normalised`. `prisma/sql/meter_readings.sql`
  creates the table exactly as the schema describes it and was run on the dev
  branch. **Production needs the same file run once**, by Alwyn's say-so; it
  only adds an empty table. The table stays empty until a BMS sync fills it,
  and with no readings the route calls every machine 0% utilised, Critical
  and a lift candidate. Those figures on the store analysis page mean "no
  readings", not idle machines.
- The links to `/stores/<store>/completeness` (a page that never existed) and
  fleet health's links to `/stores/<store name>` (the store analysis page
  wants a company id, so they showed "Store not found") now open the store's
  own page. `docs/UI-ADOPTION.md` "What changed in behaviour".
