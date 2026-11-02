# Security upgrade: Next.js, October 2026

For the Claude Code session in this folder. Written by Archon, the security control centre, on 2026-10-26. Do exactly this, fill in **Result** at the bottom, and stop.

## Why

On 22 October 2026 Next.js published two **critical, unauthenticated remote-code-execution** flaws — in `use cache` (GHSA-673q-mjm6-r5xr) and in Image Optimization with SVGs (GHSA-2464-fhr4-w9xw) — and a high-severity Server Actions denial of service (GHSA-p3m5-59mp-jv5r). Every Next.js from 16.0.0 to 16.4.0, and every 15.x before 15.5.28, is affected; the September and October advisories before them (AVIF image RCE, next/og RCE, image SSRF, cache poisoning) are fixed in the same releases. There is no workaround: only the upgrade.

## This project

| | |
|---|---|
| Folder | `live/jetline-machines-automation` |
| System | Machines Automation (fleet) · https://fleet.jetline.co.za |
| Runs on | Vercel |
| Next.js now | 16.0.10 |
| Target | **next 16.4.3** · react, react-dom 19.2.9 · eslint-config-next 16.4.3 |
| Package manager | npm |
| Branch when written | `flatten-to-root` |
| Uncommitted files when written | 3 — not yours |

This repo is on branch `flatten-to-root` and also has a box deploy.sh; production is the Vercel project. Put the upgrade on the branch production was built from (step 1 finds it).

## Rules

- Change only `package.json`, `package-lock.json` and this file. Every other uncommitted change in this repo is someone else's work: never stash, discard, commit or deploy it.
- If `package.json`, `package-lock.json` already have uncommitted changes you did not make, stop: status `blocked`, and say which.
- No other upgrades and no code changes, unless the build or checks fail *because of* this upgrade — then the smallest fix, named in Result.
- No `--force`, and no `--legacy-peer-deps` unless this repo's `.npmrc` already sets it.
- Never print a secret.

## Steps

1. `git status` and `git log -1 --oneline`: note the branch and the commit you start from.
   Then what production runs now: `vercel ls jetline-machines --prod` and `vercel inspect <the newest Ready production URL>`. If it was built from a git branch other than the one checked out, the upgrade belongs on that branch: switch to it now (only if your switch disturbs no uncommitted work — otherwise status `blocked`), and say so in Result.
2. **Upgrade**:
   ```
   npm install --save-exact next@16.4.3 react@19.2.9 react-dom@19.2.9
   npm install --save-dev --save-exact eslint-config-next@16.4.3
   ```
   If this repo has another package.json that depends on `next` (a workspace), upgrade it to the same versions too.
3. **Prove it**:
   ```
   npm ls next react react-dom
   npm run lint
   npm run test
   npm run build
   npm audit --omit=dev
   ```
   The first must show next 16.4.3 everywhere it appears. The checks and the build must pass. The audit must not name `next` or `react`; anything else it rates critical or high is listed in Result, not fixed here.
4. **Commit and push**:
   ```
   git add package.json package-lock.json security-upgrade.md && git commit -m "Next.js 16.4.3: the October 2026 security release"
   git push origin HEAD
   ```
5. **Deploy to Vercel**, project `jetline-machines` (team finalspace-alwyn's projects), production https://fleet.jetline.co.za. The Vercel CLI is signed in as finalspace-alwyn.
   - If the project builds from GitHub, your push in step 4 may already have started a production build: if `vercel ls jetline-machines --prod` shows a new deployment for your commit, wait for it instead of deploying twice.
   - Otherwise deploy the committed code: `vercel deploy --prod`.
   This repo had 3 uncommitted files that are not yours, so deploy from a clean copy of your commit, never from this folder:
   ```
   git worktree add ../jetline-machines-automation-security HEAD
   cp -R .vercel ../jetline-machines-automation-security/
   ```
   …deploy from `../jetline-machines-automation-security` (the repo root of the copy), then `git worktree remove --force ../jetline-machines-automation-security`.
6. **Verify**: `vercel ls jetline-machines --prod` shows your deployment **Ready** and newest; `curl -s -o /dev/null -w "%{http_code}" https://fleet.jetline.co.za` answers 200 or a redirect. Put the deployment URL in Result.
7. **Record**: fill in Result below, then `git add security-upgrade.md && git commit -m "Security upgrade recorded" && git push origin HEAD`. Stop.

## Result

- status: done
- next: 16.4.3
- react: 19.2.9 (react-dom 19.2.9; eslint-config-next 16.4.3)
- commit: 1a53f3f on flatten-to-root (started from 294c64d, same branch)
- pushed: yes — origin/flatten-to-root
- deployed: Vercel production via `vercel deploy --prod` from a clean worktree of 1a53f3f: https://jetline-machines-91b37f8cm-finalspace-alwyns-projects.vercel.app (dpl_5DXNSqbu3zU6tnWFAQWZCZEgRwcr), aliased to https://fleet.jetline.co.za
- verified: `vercel ls jetline-machines --prod` shows 91b37f8cm newest and Ready; https://fleet.jetline.co.za answers 307 to /login, /login answers 200; the deployment's package.json (read via the deployments files API) declares next 16.4.3, react 19.2.9
- audit: `npm audit --omit=dev` names neither next nor react. Critical: @auth/core <=0.41.2 (GHSA-7rqj-j65f-68wh, GHSA-xmf8-cvqr-rfgj, GHSA-x445-f3h2-j279). High: mysql2 <=3.23.0 (GHSA-3f6p-5ww8-9rcr, GHSA-rgwj-5xj2-c3m3); source-map-js 1.0.0–1.2.1 (GHSA-68fv-2mgg-jv7q); undici <=6.29.0 (11 advisories); xlsx (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9, no fix available); zod <4.6.6 (GHSA-mrhx-c7xc-m3w5, fix needs @vercel/blob 2.4.0 breaking change). Not fixed here.
- notes: Branch check: production (rg4wx7864, 2026-08-18) was built by CLI from flatten-to-root commit 294c64d, confirmed via the deployment's githubCommitRef/Sha meta, so no branch switch was needed. The Vercel project's Git integration has productionBranch=main, so the push did not trigger a build; deployed with the CLI as instructed. npm ls: next 16.4.3 everywhere; react 19.2.9 is flagged "invalid" only because @imc-trading/react-pivottable (wants 18.2.0) and react-day-picker 8 (wants <=18) are pre-existing React-19 peer mismatches already covered by .npmrc legacy-peer-deps=true (react was 19.2.1 before). `npm run test`: 47/47 pass. `npm run build`: passes. `npm run lint` FAILS both before and after the upgrade: a clean worktree of 294c64d lints with 6 errors/30 warnings; after the upgrade 32 errors/30 warnings. The 26 new errors are new rules in eslint-config-next 16.4.3 (react-hooks/set-state-in-effect, "Cannot call impure function during render", "Cannot access variable before it is declared", @typescript-eslint/no-require-imports), i.e. stricter linting, not changed runtime behaviour. No code was changed: lint was already red before this upgrade, is not part of the Next 16 build, and did not gate the previous production deploy. The build rewrote next-env.d.ts; I restored it with git checkout so only the three permitted files changed. The deployment meta has no git sha because the worktree was a detached HEAD; the deployed package.json was checked directly instead. Uncommitted files not mine (JETLINE_AGED.xlsx, _analyze.cjs, docs/) were left untouched. Vercel CLI 59.11.2 was used.
- at: 2026-11-02T12:24:05Z
