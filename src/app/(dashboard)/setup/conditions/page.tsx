import { SetupShell } from "../setup-shell";

// Legacy deep link — renders the consolidated Setup page on the Conditions tab.
export default function ConditionsPage() {
  return <SetupShell active="conditions" />;
}
