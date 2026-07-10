import { NextResponse } from "next/server";
import type { NextRequest, NextResponse as NextResponseType } from "next/server";

/**
 * Edge middleware — PURE Edge, zero imports beyond next/server. It only checks
 * whether a NextAuth session cookie is present, and redirects unauthenticated
 * requests to /login. It does NOT decode/verify the JWT (getToken and the
 * NextAuth core are not Edge-clean and crash on Vercel with
 * "__dirname is not defined").
 *
 * Actual authorization — verifying the session and enforcing admin vs
 * store_staff scope — happens server-side in every API route (requireUser /
 * requireAdmin) and in the dashboard pages via useRole. The middleware is just
 * the cheap "are you signed in at all?" gate plus security headers.
 */

// NextAuth v5 session cookie names (secure prefix on https).
const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

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


export default function middleware(req: NextRequest) {
  const { nextUrl } = req;
  const path = nextUrl.pathname;
  const traceId = crypto.randomUUID();

  // Signed in if ANY NextAuth session cookie is present. We don't decode it here
  // (that needs the Node runtime); the API routes + pages verify it properly.
  const hasSession = SESSION_COOKIES.some((c) => req.cookies.has(c));

  const isPublic =
    path === "/login" ||
    path.startsWith("/api/auth") ||
    path.startsWith("/_next") ||
    path === "/favicon.ico" ||
    path === "/icon.svg";

  // Not signed in -> /login (unless already on a public path).
  if (!hasSession && !isPublic) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", path);
    return harden(NextResponse.redirect(loginUrl), traceId);
  }

  // Signed in but on /login -> home.
  if (hasSession && path === "/login") {
    return harden(NextResponse.redirect(new URL("/", nextUrl.origin)), traceId);
  }

  // store_staff scoping (admin-only sections, own-store) is enforced server-side
  // in the API routes (requireAdmin/requireUser + own-store checks) and pages.
  return harden(NextResponse.next(), traceId);
}

export const config = {
  // Pure Edge middleware — no NextAuth/Node imports, so no __dirname crash.
  // Run on all routes except Next internals and static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|css|js)$).*)",
  ],
};
