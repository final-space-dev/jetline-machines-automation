# Phase 09 — Authentication & Role-Based Access

## Goal
Add a proper authentication layer so store staff see only their store and can only edit the fields meant for them. Admins see everything. The system currently has zero auth — any route is accessible to anyone.

## Problems being solved
- No login — anyone on the network can access any store's data
- No role separation — store staff can delete equipment, change purchase prices, edit group assignments
- Store staff should only see their own store, not the full 48-store grid
- Admin functions (Setup section) must be gated

## Authentication approach
**NextAuth.js v5 (Auth.js)** with credentials provider:
- Username + password stored in `jetline_machines.users` table (bcrypt hashed)
- JWT session (no DB session — keeps it stateless)
- Roles: `admin` | `store_staff`
- Store staff have a `store` field on their user record

No OAuth, no email magic links — this is an internal tool on a closed network.

## Data model

```sql
-- In jetline_machines Prisma DB (via prisma/schema.prisma):
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  password  String   -- bcrypt hash
  name      String
  role      String   -- "admin" | "store_staff"
  store     String?  -- only set for store_staff
  createdAt DateTime @default(now())
}
```

## Deliverables

### Login page (`/login`)
- Full-page centered card (not inside AppShell)
- JetlineFleet logo at top
- Email + password inputs (JL styled)
- "Sign in" button
- Error state: "Invalid email or password"

### Middleware (`middleware.ts`)
- Redirect unauthenticated users to `/login`
- Redirect store_staff to `/stores/[their-store]` directly
- Block store_staff from all `/setup/*` routes
- Block store_staff from other stores' pages

### Role-aware store grid
- Admins see all 48 stores
- Store staff are redirected to their single store page immediately

### API route auth guards
- All `/api/setup/*` routes check for admin role → 403 otherwise
- Equipment PATCH routes check: admin can patch any field; store_staff can only patch `condition`, `notes`, `replace_flag`

### Seed script (`scripts/seed-users.ts`)
Creates initial admin account so the system isn't locked out on first deploy.

## Files to change
- `webapp/prisma/schema.prisma` — add User model
- `webapp/src/app/login/page.tsx` — NEW
- `webapp/src/app/api/auth/[...nextauth]/route.ts` — NEW
- `webapp/middleware.ts` — NEW
- `webapp/src/lib/auth.ts` — NEW (session helpers)
- All `/api/setup/*` routes — add role check
- `webapp/src/app/(dashboard)/equipment/items/[id]/page.tsx` — conditional field visibility
- `webapp/src/app/(dashboard)/equipment/printers/[serial]/page.tsx` — conditional field visibility
- `webapp/scripts/seed-users.ts` — NEW
- `package.json` — add `next-auth@beta`, `bcryptjs`

## Verification
1. Visit `/equipment` without session → redirect to `/login`
2. Login as admin → see all 48 stores, Setup section in sidebar
3. Login as store_staff (Alberton) → redirect to `/stores/Alberton`
4. Store staff visits `/stores/Bedfordview` → redirect back to their store
5. Store staff visits `/setup/equipment-types` → 403
6. Store staff on item page: procurement section hidden, condition is toggle only
