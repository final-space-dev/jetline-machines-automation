// This file MUST be a module (top-level import/export) so that the
// `declare module` blocks below are treated as AUGMENTATIONS that merge with
// next-auth's own types, not as ambient module REPLACEMENTS (which would strip
// the default `NextAuth` export and break `NextAuth({...})`).
import type { DefaultSession } from "next-auth";

// NOTE ON `id` TYPING:
// next-auth's DefaultUser/DefaultSession type `id` as `string`. To avoid a
// `string & number = never` interface-merge collision, we keep `id` as a
// STRING at the next-auth type layer (token + session). The app-facing
// `SessionUser` (in src/lib/auth.ts) exposes `id: number` — getSessionUser()
// converts. This keeps the augmentation friction-free.

declare module "next-auth" {
  interface Session {
    user: {
      role: "admin" | "store_staff";
      store: string | null;
    } & DefaultSession["user"];
  }

  // The object returned by the credentials provider's authorize() callback.
  interface User {
    role: "admin" | "store_staff";
    store: string | null;
  }
}

// The JWT interface lives in @auth/core/jwt; next-auth/jwt re-exports it.
// Augment both so `token.*` is typed regardless of the import path resolved.
declare module "next-auth/jwt" {
  interface JWT {
    role: "admin" | "store_staff";
    store: string | null;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role: "admin" | "store_staff";
    store: string | null;
  }
}
