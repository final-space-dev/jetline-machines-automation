import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { SetupShell } from "./setup-shell";

// ?tab= selects the active setup tab; defaults to Stores inside the shell.
export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  // Config is admin-only. Store staff never see it; bounce them to their store.
  const user = await getSessionUser();
  if (user && user.role !== "admin") {
    redirect(user.store ? `/equipment/stores/${encodeURIComponent(user.store)}` : "/");
  }
  const { tab } = await searchParams;
  return <SetupShell active={tab} />;
}
