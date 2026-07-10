"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/lib/use-role";

/**
 * Client-side admin gate for admin-only pages (All Stores, Fleet Health,
 * Operations, Machine Reports, Config, …). Once the session resolves, a
 * store_staff user is redirected to their own store (or home). Returns
 * `{ allowed, loading }` so a page can render nothing until the check passes
 * and avoid flashing admin content to staff.
 *
 * This is defence-in-depth: the data APIs are also role-scoped server-side.
 */
export function useAdminGuard(): { allowed: boolean; loading: boolean } {
  const router = useRouter();
  const { isAdmin, role, store, loading } = useRole();

  useEffect(() => {
    if (loading) return;
    if (role === "store_staff") {
      router.replace(store ? `/equipment/stores/${encodeURIComponent(store)}` : "/");
    }
  }, [loading, role, store, router]);

  return { allowed: isAdmin, loading };
}
