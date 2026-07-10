/**
 * Phase 20 — Multi-tenant resolver (schema-per-tenant).
 *
 * MODEL
 * -----
 * Each tenant lives in its own PostgreSQL schema in the `bms` database:
 *   - Base / default tenant (Jetline)  → schema `equipment`
 *   - Additional tenant `<id>`         → schema `equipment_<id>`
 *
 * The tenant is resolved from the JWT claim `tenant_id`. The app is
 * SINGLE-TENANT today: no `tenant_id` claim exists on sessions yet, so the
 * resolver ALWAYS returns the base `equipment` schema. That is intentional.
 *
 * IMPORTANT — no bulk route rewrite.
 * The 25+ existing equipment API routes hard-code `equipment.*` in their SQL and
 * are NOT rewritten by this phase. This module provides the primitives so that
 * NEW tenant-aware routes can opt in via `withTenantSearchPath(client, schema)`.
 * When real multi-tenancy is switched on, routes migrate to unqualified table
 * names + a `SET search_path` per checked-out connection. Until then the base
 * schema and the hard-coded `equipment.` prefix are equivalent.
 */

import type { PoolClient } from "pg";
import type { SessionUser } from "@/lib/auth";

/** Base schema used when no tenant claim is present (single-tenant today). */
export const BASE_TENANT_SCHEMA = "equipment";

/** Valid Postgres schema identifier: lower snake_case, prevents SQL injection. */
const SCHEMA_RE = /^[a-z0-9_]+$/;

/**
 * Minimal shape needed to resolve a tenant. Accepts a NextAuth session, a raw
 * JWT-like object, or a request whose `auth` carries the user. `tenant_id` is
 * optional and forward-looking — it is not on `SessionUser` yet.
 */
type TenantClaim = { tenant_id?: string | null };

type ResolvableSession =
  | { user?: (Partial<SessionUser> & TenantClaim) | null }
  | (Partial<SessionUser> & TenantClaim)
  | null
  | undefined;

function readTenantId(input: ResolvableSession): string | null {
  if (!input || typeof input !== "object") return null;
  // Session shape: { user: { tenant_id } }
  if ("user" in input && input.user && typeof input.user === "object") {
    const t = (input.user as TenantClaim).tenant_id;
    if (typeof t === "string" && t.trim()) return t.trim();
  }
  // Flat claim shape: { tenant_id }
  const flat = (input as TenantClaim).tenant_id;
  if (typeof flat === "string" && flat.trim()) return flat.trim();
  return null;
}

/**
 * Validate + normalise a raw tenant id into a safe schema name.
 * Returns the base schema for empty/invalid input rather than throwing, so
 * callers cannot accidentally build an injectable identifier.
 */
export function tenantIdToSchema(tenantId: string | null | undefined): string {
  if (!tenantId) return BASE_TENANT_SCHEMA;
  const id = tenantId.trim().toLowerCase();
  // A bare, well-formed id maps to equipment_<id>. Reject anything else.
  if (id === BASE_TENANT_SCHEMA) return BASE_TENANT_SCHEMA;
  const schema = `${BASE_TENANT_SCHEMA}_${id}`;
  return SCHEMA_RE.test(schema) ? schema : BASE_TENANT_SCHEMA;
}

/**
 * Resolve the schema name for the current request/session.
 * Defaults to the base `equipment` schema when no `tenant_id` claim exists.
 */
export function getTenantSchema(session: ResolvableSession): string {
  return tenantIdToSchema(readTenantId(session));
}

/**
 * Set the connection's search_path to a tenant schema (falling back to
 * `public` for shared objects). The schema name is validated against
 * `^[a-z0-9_]+$` before interpolation to prevent SQL injection — pg cannot
 * parameterise identifiers in `SET search_path`, so validation is mandatory.
 *
 * NEW tenant-aware routes should call this immediately after checking out a
 * client (e.g. inside `withClient`) and then use UNqualified table names.
 */
export async function withTenantSearchPath(client: PoolClient, schema: string): Promise<void> {
  if (!SCHEMA_RE.test(schema)) {
    throw new Error(`Invalid tenant schema name: ${JSON.stringify(schema)}`);
  }
  await client.query(`SET search_path = ${schema}, public`);
}
