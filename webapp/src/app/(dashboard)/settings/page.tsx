import { redirect } from "next/navigation";

// Settings has been retired. Its content moved into the Setup section:
// BMS connections -> /setup/connections.
export default function SettingsPage() {
  redirect("/setup/connections");
}
