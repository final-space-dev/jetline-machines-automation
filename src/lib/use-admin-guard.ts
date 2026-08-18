"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/lib/use-role";
import { canNav, canConfig, firstAllowedPath } from "@/lib/permissions";

type Capability = `nav:${string}` | `config:${string}`;

/**
 * Client-side page gate (defence-in-depth; the data APIs are the real boundary).
 *
 * Pass no capability for an admin-only page. Pass a capability to also admit a
 * "custom" user who holds that grant. Once the session resolves:
 *   - store_staff        → redirected to their own store.
 *   - custom (no grant)  → redirected to their first allowed page.
 *   - admin / granted    → allowed.
 *
 * Returns `{ allowed, loading }` so a page renders nothing until the check
 * passes and never flashes protected content.
 */
export function useAdminGuard(required?: Capability): { allowed: boolean; loading: boolean } {
  const router = useRouter();
  const { role, store, permissions, loading } = useRole();

  const granted =
    role === "admin" ||
    (role === "custom" &&
      !!required &&
      (required.startsWith("nav:")
        ? canNav(role, permissions, required.slice(4))
        : canConfig(role, permissions, required.slice(7))));

  useEffect(() => {
    if (loading) return;
    if (role === "store_staff") {
      router.replace(store ? `/equipment/stores/${encodeURIComponent(store)}` : "/");
    } else if (role === "custom" && !granted) {
      router.replace(firstAllowedPath(permissions));
    }
  }, [loading, role, store, granted, permissions, router]);

  return { allowed: granted, loading };
}
