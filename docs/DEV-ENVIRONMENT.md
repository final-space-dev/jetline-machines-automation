# Machines' dev environment

A copy of Machines that is safe to break: its own address, its own database,
its own secrets. Built on 10 November 2026. Production (fleet.jetline.co.za)
is not touched by anything on this page.

## At a glance

| | Production | Dev |
|---|---|---|
| Address | https://fleet.jetline.co.za | https://jetline-machines-dev.vercel.app |
| Vercel environment | Production | Preview |
| Git branch | `flatten-to-root` (deployed by hand with the CLI) | `dev` |
| Database | Neon project `jetline-machines-database`, branch `main` | The same Neon project, branch `dev` |
| Mark on screen | none | **DEV** beside the name in the menu, on the phone bar and on the sign-in page |

The Vercel project is `jetline-machines` in the FinalSpace team. The Neon
project is in the FinalSpace Neon organisation, region eu-central-1.

## Opening it

The dev address sits behind Vercel's deployment protection: Vercel asks you
to sign in to Vercel before it shows the page. On the iPad, sign in to Vercel
once in Safari and the address opens from then on. Anything that probes it
without signing in (Archon's check, `curl`) gets `401`; that answer means the
deployment is up and protected, not that it is down.

Sign in to Machines itself with a dev account. The dev database is a copy of
production's, so production's staff accounts exist there with the passwords
they had when the copy was taken. Two accounts exist only on dev:
`dev-admin@jetline.local` (admin) and `dev-store@jetline.local` (store staff,
Alberton). Their password is not written down anywhere in git; reset it with
`scripts/seed-users.ts` against the dev database when needed (see below).

## Deploying dev

Dev is deployed with the CLI, from a checkout of `dev`:

```
git checkout dev && git pull
scripts/deploy-dev.sh
```

The script refuses to run on any other branch or with uncommitted changes,
makes a **Preview** deployment (`vercel deploy --target=preview`, never
`--prod`), and points `jetline-machines-dev.vercel.app` at it. A push to
`dev` does not deploy by itself: this project's deployments are made by the
CLI.

## Variables

Dev's variables are Vercel **Preview** variables scoped to the git branch
`dev`. Names only; values are never written here or anywhere in git.

| Name | Scope | What it is |
|---|---|---|
| `DATABASE_URL` | Preview, branch `dev` | The pooled address of the Neon branch `dev` |
| `AUTH_SECRET` | Preview, branch `dev` | next-auth's signing secret, dev's own (a production session is not valid on dev) |
| `CRON_SECRET` | Preview, branch `dev` | Dev's own |

Production's `DATABASE_URL` is a Production-only variable, so a Preview
deployment of any other branch has no database address at all and fails
rather than reaching production data.

To add or change one (the value is typed at the prompt or piped in, never put
on the command line):

```
vercel env add NAME preview dev --sensitive
```

Never `vercel env add … production`, never `vercel env rm` on anything that
includes Production.

Variables that came with the Neon and Blob integrations (`POSTGRES_*`,
`PG*`, `DATABASE_URL_UNPOOLED`, `BLOB_STORE_ID` and others) are set for
Preview and Production together and point at production. The code reads none
of the database ones (it reads only `DATABASE_URL`). The photo store is the
exception: see "What dev may not do".

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
accounts disappear with the reset; make them again.

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

To make or reset the dev-only admin (the script creates the account, or
leaves an existing one's password alone):

```
SEED_ADMIN_EMAIL=dev-admin@jetline.local SEED_ADMIN_NAME="Dev Admin" SEED_ADMIN_PASSWORD='<a new password>' npx tsx scripts/seed-users.ts
```

## What dev may not do

- **Photos are read-only on dev.** Dev reaches the same private photo store
  as production, and its database copy holds the same photo addresses. The
  upload and delete routes refuse on any Vercel deployment that is not
  Production (`src/app/api/equipment/items/[id]/photos/route.ts`), so a click
  on dev cannot remove a photo production shows. Photos still display.
- **BMS sync does nothing on dev.** The BMS databases are on the stores'
  private network, which Vercel cannot reach. The sync button fails; that is
  expected.
- Machines sends no email or SMS, so there is nothing else to switch off.

## From dev to production

Production is Alwyn's call, each time:

1. The change is on `dev`, `npm run gate` passes, and it has been looked at on
   the dev address.
2. Alwyn says to release.
3. `dev` is merged into the branch production is deployed from
   (`flatten-to-root`) and that branch is deployed to Production by hand.

An agent does steps 1 only.

## Known gaps (10 November 2026)

- Vercel's own "production branch" setting for this project is `main`, which
  is far behind what production actually runs (`flatten-to-root`, deployed by
  the CLI). A push to `main` could deploy old code to production if the git
  integration is ever switched on. Decide which branch is production and make
  the setting agree.
- `src/lib/bms/connection.ts` has a default database user and password
  written in the code. They should come from variables only.
- Archon's register lists Machines' database as `postgres17` on the box. It
  is Neon. The box still has a `jetline_machines` database and the repository
  still has `deploy.sh` and `ecosystem.config.cjs` from the time Machines ran
  there; nothing runs from them.
- The completeness badge on a store and the rows of the completeness
  leaderboard link to `/stores/<store>/completeness`, a page that does not
  exist. It did not exist before the UI work either.
