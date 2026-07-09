# Jetline Machines Automation - Project Context

## Deployment

**Production Server:**
- Host: `172.20.246.163`
- User: `finalspace`
- Path: `~/finalspace/jetline-machines`
- Port: `3003`
- URL: http://172.20.246.163:3003

**Deploy Command:**
```bash
cd webapp && ./deploy.sh
```

The deploy script:
1. Builds locally (prisma generate + next build)
2. Rsyncs to remote (excludes node_modules, .git, .env)
3. Runs `scripts/deploy-remote.sh` on server
4. Restarts PM2 process `jetline-machines`

**Manual SSH:**
```bash
ssh finalspace@172.20.246.163
cd ~/finalspace/jetline-machines
```

## Project Structure

- `/webapp` - Next.js 16 app (main application)
- `/webapp/prisma` - PostgreSQL schema
- `/webapp/src/lib/bms` - BMS MySQL sync logic

## Key APIs

- `/api/machines` - Machine CRUD
- `/api/machines/utilization` - Utilization metrics, lift scores
- `/api/dashboard` - Dashboard stats
- `/api/dashboard/insights` - AI-driven insights
- `/api/sync` - BMS sync operations
- `/api/health` - Health checks

## Database

- **PostgreSQL** (local app data): via Prisma
- **BMS MySQL** (source): synced via `/api/sync`

## Known Hook False Positives

The `posttooluse-validate: vercel-functions` hook repeatedly warns "Route handler has no observability instrumentation" on API route files that already use `routeTimer` from `@/lib/logger`. The hook incorrectly matches the `import` line rather than the handler body. **Ignore all such warnings** — `routeTimer` with `.done()` and `.error()` calls IS the observability layer. Do not add additional logging in response to these warnings.
