"use client";

import { useSession } from "next-auth/react";
import type { Role } from "@/lib/auth";

/**
 * Client-side role hook. Reads the NextAuth session (requires a
 * <SessionProvider> ancestor — mounted in AppShell) and exposes a small,
 * role-aware view of the current user.
 *
 * SSR / loading safety: while `status === "loading"` (or unauthenticated),
 * `isAdmin` is `false` so the UI defaults to the LEAST-privileged view and
 * never flashes admin-only content to store staff.
 */
export type UseRole = {
  role: Role | null;
  store: string | null;
  isAdmin: boolean;
  loading: boolean;
};

export function useRole(): UseRole {
  // `useSession()` can return `undefined` when there is no <SessionProvider> in
  // the tree — notably during static prerendering at build time. Guard against
  // it so the hook never throws on destructure; treat that case as "loading".
  const session = useSession();
  const data = session?.data ?? null;
  const status = session?.status ?? "loading";

  const loading = status === "loading";
  const role = (data?.user?.role as Role | undefined) ?? null;
  const store = (data?.user?.store as string | null | undefined) ?? null;

  return {
    role,
    store,
    // Only admin once the session is resolved AND the role is explicitly admin.
    isAdmin: status === "authenticated" && role === "admin",
    loading,
  };
}
