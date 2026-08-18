import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe base NextAuth config. Contains ONLY what the middleware needs to
 * read/validate the JWT session — pages, session strategy, and the jwt/session
 * callbacks. It has NO providers (no Credentials, bcrypt, or Prisma), so it can
 * run on the Edge/middleware runtime without pulling in Node-only modules.
 *
 * The full server config (src/lib/auth.ts) spreads this and adds the Credentials
 * provider for actual sign-in on the Node runtime.
 */
export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [], // populated in src/lib/auth.ts (Node runtime only)
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.store = user.store;
        token.permissions = user.permissions;
      }
      return token;
    },
    async session({ session, token }) {
      // Edge/middleware only — pure token passthrough, no DB. The Node config in
      // src/lib/auth.ts does the authoritative DB refresh.
      if (session.user) {
        if (token.sub) session.user.id = token.sub;
        session.user.role = token.role;
        session.user.store = token.store ?? null;
        session.user.permissions = token.permissions ?? { nav: [], config: [] };
      }
      return session;
    },
  },
};
