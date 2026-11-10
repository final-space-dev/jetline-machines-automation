import { SetupShell } from "../setup-shell";

// Legacy deep link — renders the consolidated Setup page on the Store groups tab.
export default function StoreGroupsPage() {
  return <SetupShell active="store-groups" />;
}
