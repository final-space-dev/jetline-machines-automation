import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canSeeConfig, firstAllowedPath } from "@/lib/permissions";
import { SetupShell } from "./setup-shell";

// ?tab= selects the active setup tab; defaults to Stores inside the shell.
export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  // Config is for admins and custom users holding at least one config section.
  // Store staff never see it; bounce them to their store.
  const user = await getSessionUser();
  if (user && user.role === "store_staff") {
    redirect(user.store ? `/equipment/stores/${encodeURIComponent(user.store)}` : "/");
  }
  if (user && user.role === "custom" && !canSeeConfig(user.role, user.permissions)) {
    redirect(firstAllowedPath(user.permissions));
  }
  const { tab } = await searchParams;
  return <SetupShell active={tab} />;
}
