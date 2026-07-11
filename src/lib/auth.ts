import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isLoginLocked, recordLoginFailure, clearLoginFailures } from "@/lib/rate-limit";

/**
 * Phase 09 — Authentication & Roles (NextAuth v5 / Auth.js).
 *
 * Credentials provider validates email + password against
 * `jetline_machines.users` (Prisma) with a bcrypt compare.
 * Session strategy is JWT (stateless — no DB session table).
 *
 * The JWT carries the user id (in `token.sub`), name, email (NextAuth defaults)
 * plus our custom `role` and `store` claims. These are exposed on
 * `session.user` via the augmentation in `types/next-auth.d.ts`.
 *
 * Requires `AUTH_SECRET` in the environment (dev + prod). NextAuth reads it
 * lazily, so a missing secret will not crash at import time.
 */

export type Role = "admin" | "store_staff";

export type SessionUser = {
  id: number;
  email: string;
  name: string;
  role: Role;
  store: string | null;
};

function normaliseRole(role: string): Role {
  return role === "admin" ? "admin" : "store_staff";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Self-hosted behind a reverse proxy (PM2, not Vercel) — trust the incoming
  // Host header so NextAuth v5 does not reject auth callbacks as UntrustedHost.
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string"
            ? credentials.email.trim().toLowerCase()
            : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";

        if (!email || !password) return null;

        // Lockout: after too many recent failures for this email, refuse to even
        // check the password until the window passes (brute-force protection).
        if (await isLoginLocked(email)) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          await recordLoginFailure(email);
          return null;
        }

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) {
          await recordLoginFailure(email);
          return null;
        }

        // Success — clear the failure history for this account.
        await clearLoginFailures(email);

        // Returned object shape must be compatible with the `User`
        // augmentation. `id` is a string here (NextAuth default).
        return {
          id: String(user.id),
          email: user.email,
          name: user.name,
          role: normaliseRole(user.role),
          store: user.store ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // `user` is only present on initial sign-in.
      if (user) {
        token.role = user.role;
        token.store = user.store;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        // token.sub holds the user id string; expose it as user.id.
        if (token.sub) session.user.id = token.sub;
        session.user.role = token.role;
        session.user.store = token.store;
      }
      return session;
    },
  },
});

/**
 * Server helper: returns the current authenticated user or null.
 * Use in Server Components, Route Handlers, and Server Actions.
 * Exposes `id` as a number (the DB primary key).
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const u = session?.user;
  if (!u?.email) return null;

  return {
    id: Number(u.id),
    email: u.email,
    name: u.name ?? "",
    role: u.role,
    store: u.store ?? null,
  };
}

/**
 * Sentinel error thrown by `requireUser` / `requireAdmin`.
 * API routes can catch it and translate `status` into an HTTP response.
 */
export class AuthError extends Error {
  status: 401 | 403;
  constructor(status: 401 | 403, message: string) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

/**
 * Require any authenticated user. Throws AuthError(401) if not signed in.
 *
 * Usage in a route handler:
 *   try {
 *     const user = await requireUser();
 *   } catch (e) {
 *     if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
 *     throw e;
 *   }
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError(401, "Unauthorized");
  return user;
}

/**
 * Require an admin user. Throws AuthError(401) if not signed in,
 * AuthError(403) if signed in but not an admin.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError(401, "Unauthorized");
  if (user.role !== "admin") throw new AuthError(403, "Forbidden");
  return user;
}
