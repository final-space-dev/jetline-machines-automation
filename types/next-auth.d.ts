// This file MUST be a module (top-level import/export) so that the
// `declare module` blocks below are treated as AUGMENTATIONS that merge with
// next-auth's own types, not as ambient module REPLACEMENTS (which would strip
// the default `NextAuth` export and break `NextAuth({...})`).
import type { DefaultSession } from "next-auth";
import type { Role, Permissions } from "@/lib/permissions";

// NOTE ON `id` TYPING:
// next-auth's DefaultUser/DefaultSession type `id` as `string`. To avoid a
// `string & number = never` interface-merge collision, we keep `id` as a
// STRING at the next-auth type layer (token + session). The app-facing
// `SessionUser` (in src/lib/auth.ts) exposes `id: number` — getSessionUser()
// converts. This keeps the augmentation friction-free.

declare module "next-auth" {
  interface Session {
    user: {
      role: Role;
      store: string | null;
      // Capability grant for role="custom". See src/lib/permissions.ts.
      permissions: Permissions;
      // True when the account was deleted after the token was issued.
      disabled?: boolean;
    } & DefaultSession["user"];
  }

  // The object returned by the credentials provider's authorize() callback.
  interface User {
    role: Role;
    store: string | null;
    permissions?: Permissions;
  }
}

// The JWT interface lives in @auth/core/jwt; next-auth/jwt re-exports it.
// Augment both so `token.*` is typed regardless of the import path resolved.
declare module "next-auth/jwt" {
  interface JWT {
    role: Role;
    store: string | null;
    permissions?: Permissions;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role: Role;
    store: string | null;
    permissions?: Permissions;
  }
}
