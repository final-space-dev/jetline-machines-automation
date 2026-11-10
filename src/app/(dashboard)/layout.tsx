import { SessionProvider } from "next-auth/react";
import { MachinesShell } from "@/components/machines/machines-shell";
import { auth } from "@/lib/auth";
import { isDevCopy } from "@/lib/environment";

/**
 * The console's one frame. The session is resolved on the server and handed to
 * the provider, so the first paint already knows the role and the menu never
 * flashes. The Shell lives here, once, and persists across navigations.
 *
 * `dev` is true everywhere except production (lib/environment): it puts the
 * DEV mark beside the name so a dev copy is never mistaken for the live one.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const dev = isDevCopy();
  return (
    <SessionProvider session={session}>
      <MachinesShell dev={dev}>{children}</MachinesShell>
    </SessionProvider>
  );
}
