import { redirect } from "next/navigation";

// Settings has been retired. Its content moved into the Setup section:
// BMS connections -> Setup > Connections tab.
export default function SettingsPage() {
  redirect("/setup?tab=connections");
}
