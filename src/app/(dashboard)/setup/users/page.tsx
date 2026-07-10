import { SetupShell } from "../setup-shell";

// Legacy deep link — renders the consolidated Setup page on the Users tab.
export default function UsersPage() {
  return <SetupShell active="users" />;
}
