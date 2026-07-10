import { SetupShell } from "./setup-shell";

// ?tab= selects the active setup tab; defaults to Equipment Types inside the shell.
export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  return <SetupShell active={tab} />;
}
