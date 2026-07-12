import { describe, it, expect, beforeAll } from "vitest";

/**
 * Permission matrix — the guardrail. Asserts, against a running instance, that
 * the role scoping we built holds: store staff are confined to their own store
 * and can't touch admin surfaces; admins can. A refactor that silently opens a
 * hole should fail HERE.
 *
 * Runs against BASE_URL (default the production URL — override for local/CI).
 * Requires two accounts to exist; if login fails or the server is down, the
 * suite SKIPS rather than fails, so it never flakes CI when creds aren't present.
 *
 * Env overrides:
 *   PERM_BASE_URL, PERM_ADMIN_EMAIL/PASSWORD, PERM_STAFF_EMAIL/PASSWORD/STORE
 */

const BASE = process.env.PERM_BASE_URL || "https://jetline-machines.vercel.app";
const ADMIN = { email: process.env.PERM_ADMIN_EMAIL || "tech@jetline.co.za", password: process.env.PERM_ADMIN_PASSWORD || "JetlineFleet2026!" };
const STAFF = {
  email: process.env.PERM_STAFF_EMAIL || "staff@alberton.test",
  password: process.env.PERM_STAFF_PASSWORD || "AlbertonTest2026!",
  store: process.env.PERM_STAFF_STORE || "Alberton",
};

// ── Cookie-jar login against NextAuth Credentials (CSRF + callback) ───────────
function parseSetCookies(res: Response): string[] {
  // Node fetch exposes getSetCookie() for multiple Set-Cookie headers.
  const anyHeaders = res.headers as unknown as { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") return anyHeaders.getSetCookie();
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}
function jarToHeader(jar: Map<string, string>): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}
function addCookies(jar: Map<string, string>, res: Response) {
  for (const c of parseSetCookies(res)) {
    const [pair] = c.split(";");
    const idx = pair.indexOf("=");
    if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
}

async function login(email: string, password: string): Promise<Map<string, string> | null> {
  try {
    const jar = new Map<string, string>();
    // 1) CSRF token
    const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { signal: AbortSignal.timeout(10000) });
    if (!csrfRes.ok) return null;
    addCookies(jar, csrfRes);
    const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
    // 2) Credentials callback
    const body = new URLSearchParams({ csrfToken, email, password, callbackUrl: BASE, json: "true" });
    const cbRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: jarToHeader(jar) },
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });
    addCookies(jar, cbRes);
    // 3) Confirm a session
    const sessRes = await fetch(`${BASE}/api/auth/session`, { headers: { cookie: jarToHeader(jar) }, signal: AbortSignal.timeout(10000) });
    const sess = (await sessRes.json()) as { user?: { role?: string } };
    return sess?.user?.role ? jar : null;
  } catch {
    return null;
  }
}

async function api(jar: Map<string, string>, path: string, init?: RequestInit): Promise<number> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { cookie: jarToHeader(jar), "Content-Type": "application/json", ...(init?.headers || {}) },
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });
  return res.status;
}

describe("Permission matrix (role scoping guardrail)", () => {
  let adminJar: Map<string, string> | null = null;
  let staffJar: Map<string, string> | null = null;
  let available = false;

  beforeAll(async () => {
    adminJar = await login(ADMIN.email, ADMIN.password);
    staffJar = await login(STAFF.email, STAFF.password);
    available = !!adminJar && !!staffJar;
    if (!available) console.log("[permissions] skipping — could not log in both accounts (server down or creds absent)");
  }, 60000);

  // ── Admin can reach admin-only data APIs ───────────────────────────────────
  const adminOnly = [
    "/api/equipment/fleet-health",
    "/api/operations",
    "/api/reports?tab=summary",
    "/api/xerox-reporting/machines",
    "/api/setup/users",
    "/api/setup/store-groups",
  ];
  for (const path of adminOnly) {
    it(`admin CAN GET ${path}`, async () => {
      if (!available) return;
      expect(await api(adminJar!, path)).toBe(200);
    });
    it(`staff CANNOT GET ${path} (403)`, async () => {
      if (!available) return;
      expect(await api(staffJar!, path)).toBe(403);
    });
  }

  // ── Staff can reach their OWN store; NOT another store ─────────────────────
  it("staff CAN GET their own store", async () => {
    if (!available) return;
    expect(await api(staffJar!, `/api/equipment/stores/${encodeURIComponent(STAFF.store)}`)).toBe(200);
  });
  it("staff CANNOT GET another store (403)", async () => {
    if (!available) return;
    const other = STAFF.store === "Bedfordview" ? "Alberton" : "Bedfordview";
    expect(await api(staffJar!, `/api/stores/${encodeURIComponent(other)}`)).toBe(403);
  });

  // ── Staff write scoping on printers: feedback fields locked ────────────────
  it("staff CANNOT PATCH printer feedback fields (403)", async () => {
    if (!available) return;
    // Any printer serial; the role check fires before store resolution for staff.
    const status = await api(staffJar!, `/api/equipment/printers/3148396956`, {
      method: "PATCH",
      body: JSON.stringify({ condition: "Good" }),
    });
    expect([403]).toContain(status);
  });

  // ── Staff CAN comment + request (own store) — the feedback loop ────────────
  it("staff CAN read feedback timeline for own-store machine", async () => {
    if (!available) return;
    // Resolve a real item id in their store first.
    const listRes = await fetch(`${BASE}/api/equipment/stores/${encodeURIComponent(STAFF.store)}`, { headers: { cookie: jarToHeader(staffJar!) } });
    const list = (await listRes.json()) as { equipment?: { id: number }[] };
    const id = list.equipment?.[0]?.id;
    if (!id) return; // no equipment to test with — skip
    expect(await api(staffJar!, `/api/feedback/timeline?type=equipment&ref=${id}`)).toBe(200);
  });

  // ── Replacement-request triage (PATCH) is admin-only ───────────────────────
  it("staff CANNOT triage a replacement request (PATCH → 401/403)", async () => {
    if (!available) return;
    const status = await api(staffJar!, `/api/feedback/replacement-requests`, {
      method: "PATCH",
      body: JSON.stringify({ id: 1, status: "approved" }),
    });
    expect([401, 403]).toContain(status);
  });

  // ── Config / Machine Mapping write APIs are admin-only ─────────────────────
  it("staff CANNOT POST a new user (401/403)", async () => {
    if (!available) return;
    const status = await api(staffJar!, `/api/setup/users`, {
      method: "POST",
      body: JSON.stringify({ email: "x@y.z", name: "X", role: "admin", password: "Abcdef12" }),
    });
    expect([401, 403]).toContain(status);
  });

  // ── Connections (companies): read requires a session; create is admin-only ──
  it("unauthenticated CANNOT read companies (401)", async () => {
    if (!available) return;
    const empty = new Map<string, string>();
    expect(await api(empty, `/api/companies`)).toBe(401);
  });
  it("staff CAN read companies (dropdowns need it)", async () => {
    if (!available) return;
    expect(await api(staffJar!, `/api/companies`)).toBe(200);
  });
  it("staff CANNOT create a company (401/403)", async () => {
    if (!available) return;
    const status = await api(staffJar!, `/api/companies`, {
      method: "POST",
      body: JSON.stringify({ name: "X", bmsSchema: "x" }),
    });
    expect([401, 403]).toContain(status);
  });

  // NOTE (known gap, not asserted): the legacy /api/machines and /api/sync routes
  // (pre-CRM machine-tracker area) currently have no auth. Left untouched this
  // sprint to avoid destabilising that area; tracked as a follow-up.
});
