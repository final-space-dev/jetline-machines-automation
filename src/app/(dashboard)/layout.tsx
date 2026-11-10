import { SessionProvider } from "next-auth/react";
import { MachinesShell } from "@/components/machines/machines-shell";
import { auth } from "@/lib/auth";

/**
 * The console's one frame. The session is resolved on the server and handed to
 * the provider, so the first paint already knows the role and the menu never
 * flashes. The Shell lives here, once, and persists across navigations.
 *
 * `dev` is true everywhere except Vercel's Production environment: it puts the
 * DEV mark beside the name so a dev copy is never mistaken for the live one.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const dev = process.env.VERCEL_ENV !== "production";
  return (
    <SessionProvider session={session}>
      <MachinesShell dev={dev}>{children}</MachinesShell>
    </SessionProvider>
  );
}
