import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

/**
 * Edge-safe NextAuth instance for the MIDDLEWARE only. Built from the base
 * config (no providers/bcrypt/prisma), so it runs on the Edge runtime and just
 * reads the JWT session cookie. Sign-in itself happens via the full Node config
 * in src/lib/auth.ts. Exposes `auth` as the middleware wrapper.
 */
export const { auth } = NextAuth(authConfig);
