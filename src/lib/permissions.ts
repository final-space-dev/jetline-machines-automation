/**
 * RBAC capability model (Phase — Custom access).
 *
 * Three roles exist:
 *   - "admin"       → full access. Capabilities are IGNORED (always allowed).
 *   - "store_staff" → single-store tenant. Own store + Activity only (unchanged).
 *   - "custom"      → access is driven ENTIRELY by the `permissions` grant below.
 *
 * A custom user's grant is stored on `users.permissions` (JSONB) as:
 *   { "nav": ["machine-reports", ...], "config": ["machine-mapping", ...] }
 *
 * This module is framework-agnostic (no server-only imports) so both the client
 * UI (checkboxes, sidebar filtering) and the server guards import the SAME
 * source of truth for capability keys.
 */

export type Role = "admin" | "store_staff" | "custom";

/** Grant shape persisted on the user row. */
export interface Permissions {
  nav: string[];
  config: string[];
}

export const EMPTY_PERMISSIONS: Permissions = { nav: [], config: [] };

/** Top-level menu destinations that a Custom user can be granted. */
export const NAV_CAPS: { key: string; label: string; href: string }[] = [
  { key: "all-stores", label: "All Stores", href: "/equipment" },
  { key: "fleet", label: "Fleet Health", href: "/equipment/fleet" },
  { key: "operations", label: "Dashboard", href: "/operations" },
  { key: "machine-reports", label: "Machine Reports", href: "/machine-reports" },
  { key: "replacements", label: "Replacement Requests", href: "/reports/replacements" },
  { key: "activity", label: "Activity", href: "/activity" },
];

/**
 * Config (Setup) sections a Custom user can be granted. "Users" is deliberately
 * NOT grantable — managing accounts stays admin-only.
 */
export const CONFIG_CAPS: { key: string; label: string }[] = [
  { key: "stores", label: "Stores" },
  { key: "machine-mapping", label: "Machine Mapping" },
  { key: "import", label: "Import" },
  { key: "models", label: "Models" },
  { key: "suppliers", label: "Suppliers" },
  { key: "equipment-types", label: "Equipment Types" },
  { key: "conditions", label: "Conditions" },
  { key: "recently-deleted", label: "Recently Deleted" },
];

const NAV_KEYS = new Set(NAV_CAPS.map((c) => c.key));
const CONFIG_KEYS = new Set(CONFIG_CAPS.map((c) => c.key));

/**
 * Coerce an arbitrary value (DB JSON, request body) into a clean Permissions
 * object, dropping anything not in the known catalog. Never throws.
 */
export function normalisePermissions(value: unknown): Permissions {
  const v = (value ?? {}) as { nav?: unknown; config?: unknown };
  const nav = Array.isArray(v.nav)
    ? [...new Set(v.nav.filter((x): x is string => typeof x === "string" && NAV_KEYS.has(x)))]
    : [];
  const config = Array.isArray(v.config)
    ? [...new Set(v.config.filter((x): x is string => typeof x === "string" && CONFIG_KEYS.has(x)))]
    : [];
  return { nav, config };
}

/** True if the (role, permissions) pair grants the given nav capability. */
export function canNav(role: Role | null, permissions: Permissions | null, key: string): boolean {
  if (role === "admin") return true;
  if (role === "custom") return !!permissions?.nav.includes(key);
  return false;
}

/** True if the (role, permissions) pair grants the given config-section capability. */
export function canConfig(role: Role | null, permissions: Permissions | null, key: string): boolean {
  if (role === "admin") return true;
  if (role === "custom") return !!permissions?.config.includes(key);
  return false;
}

/** A custom user may see the Config menu item if they hold ANY config section. */
export function canSeeConfig(role: Role | null, permissions: Permissions | null): boolean {
  if (role === "admin") return true;
  if (role === "custom") return (permissions?.config.length ?? 0) > 0;
  return false;
}

/**
 * The landing path for a custom user: their first granted nav destination, else
 * Config if they only hold config sections, else a safe fallback.
 */
export function firstAllowedPath(permissions: Permissions | null): string {
  const nav = NAV_CAPS.find((c) => permissions?.nav.includes(c.key));
  if (nav) return nav.href;
  if ((permissions?.config.length ?? 0) > 0) return "/setup";
  return "/no-access";
}
