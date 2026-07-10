"use client";

import { SessionProvider } from "next-auth/react";

/**
 * Dashboard segment layout — mounts NextAuth's SessionProvider ONCE around every
 * dashboard page. Pages call useRole()/useSession() in their own component body
 * (before they return <AppShell>), so the provider must live ABOVE the page in
 * the tree — here — not inside AppShell. Without this, every useRole() call runs
 * outside the provider and throws "useSession must be wrapped in a SessionProvider".
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
