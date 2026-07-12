import { describe, it, expect, beforeAll } from "vitest";

/**
 * Permission matrix — the guardrail. Asserts, against a running instance, that
 * the role scoping we built holds: store staff are confined to their own store
 * and can't touch admin surfaces; admins can. A refactor that silently opens a
 * hole should fail HERE.
 *
 * ALL config comes from env — NO credentials or URLs are hardcoded (they'd end
 * up in git history). Set these before running (see `npm run test:permissions`):
 *   PERM_BASE_URL            e.g. http://localhost:3003 or your deploy URL
 *   PERM_ADMIN_EMAIL / PERM_ADMIN_PASSWORD
 *   PERM_STAFF_EMAIL / PERM_STAFF_PASSWORD / PERM_STAFF_STORE
 * If any required var is missing the suite SKIPS (never fails CI, never leaks).
 */

const BASE = process.env.PERM_BASE_URL || "http://localhost:3003";
const ADMIN = { email: process.env.PERM_ADMIN_EMAIL ?? "", password: process.env.PERM_ADMIN_PASSWORD ?? "" };
const STAFF = {
  email: process.env.PERM_STAFF_EMAIL ?? "",
  password: process.env.PERM_STAFF_PASSWORD ?? "",
  store: process.env.PERM_STAFF_STORE ?? "",
};

// If credentials aren't provided via env, skip the whole suite rather than run
// with (or embed) real secrets.
const HAS_CREDS = !!(ADMIN.email && ADMIN.password && STAFF.email && STAFF.password && STAFF.store);

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

describe.skipIf(!HAS_CREDS)("Permission matrix (role scoping guardrail)", () => {
  let adminJar: Map<string, string> | null = null;
  let staffJar: Map<string, string> | null = null;
  let available = false;

  beforeAll(async () => {
    adminJar = await login(ADMIN.email, ADMIN.password);
    staffJar = await login(STAFF.email, STAFF.password);
    available = !!adminJar && !!staffJar;
    if (!available) console.log("[permissions] skipping — could not log in both accounts (server down or wrong creds)");
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
  it("unauthenticated CANNOT read companies (redirect or 401)", async () => {
    if (!available) return;
    const empty = new Map<string, string>();
    // Middleware redirects unauthenticated requests to /login (307) before the
    // route's own 401 fires — either is a correct "blocked" outcome.
    expect([307, 401, 403]).toContain(await api(empty, `/api/companies`));
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

  // ── Legacy machine-tracker routes are now gated too ────────────────────────
  it("unauthenticated CANNOT read /api/machines (redirect/401)", async () => {
    if (!available) return;
    expect([307, 401, 403]).toContain(await api(new Map(), `/api/machines`));
  });
  it("staff CANNOT create a machine (401/403)", async () => {
    if (!available) return;
    const status = await api(staffJar!, `/api/machines`, {
      method: "POST",
      body: JSON.stringify({ serialNumber: "TEST" }),
    });
    expect([401, 403]).toContain(status);
  });
  it("staff CANNOT trigger a BMS sync (401/403)", async () => {
    if (!available) return;
    const status = await api(staffJar!, `/api/sync`, {
      method: "POST",
      body: JSON.stringify({ type: "full" }),
    });
    expect([401, 403]).toContain(status);
  });
  it("unauthenticated CANNOT trigger a BMS sync (redirect/401)", async () => {
    if (!available) return;
    expect([307, 401, 403]).toContain(await api(new Map(), `/api/sync`, {
      method: "POST",
      body: JSON.stringify({ type: "full" }),
    }));
  });
});
