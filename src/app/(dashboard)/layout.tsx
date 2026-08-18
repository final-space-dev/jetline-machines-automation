import { SessionProvider } from "next-auth/react";
import { auth } from "@/lib/auth";

/**
 * Dashboard segment layout — mounts NextAuth's SessionProvider ONCE around every
 * dashboard page, and PERSISTS across navigations (so useSession never re-enters
 * "loading" when you click between pages — that flash showed the full menu before
 * a restricted role resolved).
 *
 * This is a SERVER component: it resolves the session with auth() and hands it to
 * the provider as the initial value, so the client is authenticated on the FIRST
 * paint — the sidebar renders the correct (role-aware) menu immediately, with no
 * flicker. Pages call useRole()/useSession() below this provider.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
