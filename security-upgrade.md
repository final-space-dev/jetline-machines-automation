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

- status: <!-- done | blocked | awaiting-network -->
- next: <!-- the version installed -->
- react: <!-- the version installed -->
- commit: <!-- the upgrade commit's short sha and branch -->
- pushed: <!-- yes / no -->
- deployed: <!-- where and how, the deployment URL or the deploy script's last line; or "not deployed" and why -->
- verified: <!-- the evidence, one line -->
- audit: <!-- other critical/high findings, or none -->
- notes: <!-- anything Archon should know -->
- at: <!-- ISO time -->
