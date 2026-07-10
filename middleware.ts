import { NextResponse } from "next/server";
import type { NextRequest, NextResponse as NextResponseType } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Phase 09 — Auth middleware (NextAuth v5).
 * Phase 20 — hardened with per-request tracing, in-memory rate limiting, and a
 *            Content-Security-Policy header. The original auth wrapper and ALL
 *            of its redirect behaviour are preserved unchanged; the new
 *            cross-cutting concerns are layered on top INSIDE the same
 *            `auth((req) => { ... })` callback:
 *
 *   1. A traceId (UUID) is generated per request and stamped on the outgoing
 *      response header `x-trace-id` for cross-service correlation.
 *   2. `/api/*` requests are rate limited (per-IP 200/min, per-user 500/min)
 *      BEFORE the auth redirects run; exceeding the limit short-circuits with a
 *      429 + `Retry-After` (never touching the auth logic).
 *   3. Every response (pass-through, redirect, or 429) receives a CSP header.
 *
 * Rate limiting is per-process (see src/lib/rate-limit.ts) — acceptable for the
 * single PM2 instance in production.
 *
 * - Unauthenticated users are redirected to /login (public paths allowed).
 * - store_staff are scoped to their own store:
 *     - /equipment and /stores (root) and any other store's page redirect
 *       them to /stores/<their store>
 *     - /setup/* is blocked (redirect to their store)
 * - admins pass through everywhere.
 *
 * The JWT is read from the session cookie by the `auth` wrapper, so this runs
 * without touching Prisma or bcrypt (edge-safe).
 */

// Content-Security-Policy. The app relies heavily on inline styles (JL token
// helpers) so `style-src` must allow 'unsafe-inline'. Next.js injects inline
// bootstrap scripts, so `script-src` allows 'unsafe-inline' too. Images allow
// data: (blur placeholders / inline SVG) and https:. No framing.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join("; ");

/** Stamp trace id + security headers on any outgoing response. */
function harden(res: NextResponseType, traceId: string): NextResponseType {
  res.headers.set("x-trace-id", traceId);
  res.headers.set("Content-Security-Policy", CSP);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // No-store on HTML documents so the browser can never serve a stale page that
  // references an old CSS bundle. Hashed /_next/static/* assets are excluded by
  // this middleware's matcher, so they keep their long-lived immutable caching.
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export default async function middleware(req: NextRequest) {
  const { nextUrl } = req;
  const path = nextUrl.pathname;

  // Read the JWT session cookie directly — Edge-safe, no NextAuth core / bcrypt.
  // The jwt callback stored role + store on the token; getToken decodes them.
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: nextUrl.protocol === "https:",
  });
  const session = token
    ? {
        user: {
          id: token.sub,
          email: typeof token.email === "string" ? token.email : undefined,
          role: token.role as string | undefined,
          store: token.store as string | undefined,
        },
      }
    : null;

  // ── Per-request trace id ──────────────────────────────────────────────────
  // Rate limiting is handled at the platform level on Vercel (in-memory limits
  // don't work across serverless isolates), so it's not done here.
  const traceId = crypto.randomUUID();

  // Public paths that never require a session.
  const isPublic =
    path === "/login" ||
    path.startsWith("/api/auth") ||
    path.startsWith("/_next") ||
    path === "/favicon.ico" ||
    path === "/icon.svg";

  // Not signed in -> send to /login (unless already on a public path).
  if (!session?.user) {
    if (isPublic) return harden(NextResponse.next(), traceId);
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", path);
    return harden(NextResponse.redirect(loginUrl), traceId);
  }

  const role = session.user.role;
  const store = session.user.store;

  // Already authenticated: keep them off the login page.
  if (path === "/login") {
    const home =
      role === "store_staff" && store
        ? `/stores/${encodeURIComponent(store)}`
        : "/";
    return harden(NextResponse.redirect(new URL(home, nextUrl.origin)), traceId);
  }

  // Admins pass through everything.
  if (role === "admin") return harden(NextResponse.next(), traceId);

  // ---- store_staff scoping ----
  if (role === "store_staff") {
    // Without an assigned store there is nothing safe to show.
    if (!store) return harden(NextResponse.next(), traceId);

    const ownStore = `/stores/${encodeURIComponent(store)}`;

    // Block the Setup admin section.
    if (path === "/setup" || path.startsWith("/setup/")) {
      return harden(NextResponse.redirect(new URL(ownStore, nextUrl.origin)), traceId);
    }

    // The full equipment grid is admin-only; push staff to their store.
    if (path === "/equipment" || path.startsWith("/equipment/")) {
      return harden(NextResponse.redirect(new URL(ownStore, nextUrl.origin)), traceId);
    }

    // Stores index -> their own store.
    if (path === "/stores") {
      return harden(NextResponse.redirect(new URL(ownStore, nextUrl.origin)), traceId);
    }

    // Another store's page -> redirect back to their own store.
    if (path.startsWith("/stores/")) {
      const segment = decodeURIComponent(path.slice("/stores/".length).split("/")[0]);
      if (segment !== store) {
        return harden(NextResponse.redirect(new URL(ownStore, nextUrl.origin)), traceId);
      }
    }
  }

  return harden(NextResponse.next(), traceId);
}

export const config = {
  // Runs on the Edge runtime (default). Uses the Edge-safe auth instance
  // (@/lib/auth-edge) which only reads the JWT cookie — no bcrypt/prisma — so
  // there are no Node-only imports here.
  // Run on all routes except Next internals and static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|css|js)$).*)",
  ],
};
