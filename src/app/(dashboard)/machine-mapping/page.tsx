import { AppShell } from "@/components/layout/app-shell";
import { MachineMappingPanel } from "./panel";

// Standalone /machine-mapping route — wraps the panel in the app chrome. The
// Config → Machine Mapping tab renders <MachineMappingPanel embedded /> inline.
export default function MachineMappingPage() {
  return (
    <AppShell>
      <MachineMappingPanel />
    </AppShell>
  );
}
