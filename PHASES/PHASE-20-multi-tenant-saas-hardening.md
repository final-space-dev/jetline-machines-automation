# Phase 20 — Multi-Tenant SaaS Hardening

## Goal
The system is hardened into a proper SaaS platform that could be white-labelled or sold to another Jetline-like operation. Multi-tenancy is introduced so the platform can serve multiple independent company hierarchies. Performance, security, and observability are production-grade.

## Problems being solved
- All data is in a single schema with no tenant isolation
- API routes have no rate limiting — a runaway client could DoS the DB
- No structured logging beyond routeTimer — no request tracing across services
- No automated backup verification
- Health check only pings DBs — doesn't verify data integrity
- No way to white-label for another franchise group

## Multi-tenancy model
**Schema-per-tenant** in PostgreSQL:
- Current setup: `equipment.*` schema = Jetline tenant
- New tenant: `equipment_tenant2.*` schema
- Tenant resolved from JWT claim `tenant_id` → maps to schema name
- All queries use `SET search_path = equipment_{tenantId}` per connection

## Deliverables

### Tenant resolver middleware
`src/lib/tenant.ts`:
- `getTenantSchema(req)` reads JWT → returns schema name
- All equipment DB queries wrap with `SET search_path`
- Admin super-tenant can query all schemas

### Tenant onboarding script
`scripts/create-tenant.ts`:
- Creates new schema with all tables (runs DDL)
- Creates admin user for tenant
- Seeds equipment_types and conditions with defaults

### Rate limiting
`src/middleware.ts` — add rate limiter using in-memory sliding window (no Redis dependency):
- Per-IP: 200 requests/minute
- Per-user: 500 requests/minute
- Returns 429 with `Retry-After` header

### Structured request tracing
Extend `routeTimer` in `src/lib/logger.ts`:
- Add `traceId` (UUID per request, set in middleware)
- Add `tenantId`, `userId` to every log line
- Output format: JSON in production (already done), with `traceId` field

### Automated health verification
`/api/health` extended:
- Checks DB connectivity (already done)
- Checks equipment.items count > 0 (data integrity)
- Checks last BMS sync was < 24 hours ago
- Checks last Xerox billing import was < 30 days ago
- Returns `{ status: "healthy"|"degraded"|"critical", checks: {...} }`

### White-label config (`src/lib/brand.ts`)
- `BRAND_NAME`, `BRAND_COLOR`, `BRAND_LOGO_URL` from environment variables
- Sidebar logo, page titles, and email templates read from brand config
- Default: "JetlineFleet" / `#e6121f` / JL logo

### Performance hardening
- DB connection pool limits set explicitly: `max: 10` on bmsPool, `max: 5` on xeroxPool
- Slow query logging: any query > 500ms logged at WARN level
- Next.js `unstable_cache` on expensive read routes (`/api/analytics/*`, `/api/reports/*`) with 5-minute TTL
- `Content-Security-Policy` header on all responses

### Backup verification cron
`scripts/verify-backup.sh`:
- Runs daily via PM2
- Restores latest backup to a temp schema, counts rows, drops it
- Logs result to `jetline_machines.backup_log`

## Files to change
- `webapp/src/lib/tenant.ts` — NEW
- `webapp/src/middleware.ts` — extend with rate limiting + traceId
- `webapp/src/lib/logger.ts` — extend routeTimer with traceId + tenantId
- `webapp/src/lib/brand.ts` — NEW
- `webapp/src/app/api/health/route.ts` — extend checks
- `webapp/src/components/layout/sidebar.tsx` — read brand config
- All equipment API routes — wrap queries with tenant schema
- `scripts/create-tenant.ts` — NEW
- `scripts/verify-backup.sh` — NEW
- `package.json` — no new deps (keep it lean)

## Verification
1. Add `BRAND_NAME=AcmePrint` to `.env` → sidebar shows "AcmePrint" instead of "JetlineFleet"
2. Send 201 requests in a minute from one IP → 202nd gets 429
3. Every API log line has `traceId` field
4. `/api/health` returns all checks including data integrity and sync recency
5. `create-tenant.ts` script runs without error and creates working schema
6. Slow query (artificially delayed) logged at WARN level with duration
