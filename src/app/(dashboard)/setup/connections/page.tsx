import { SetupShell } from "../setup-shell";

// Legacy deep link — renders the consolidated Setup page on the Connections tab.
export default function ConnectionsPage() {
  return <SetupShell active="connections" />;
}
