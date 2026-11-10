import { MachineMappingPanel } from "./panel";

// Standalone /machine-mapping route: the panel as its own page. The Config →
// Machine Mapping tab renders <MachineMappingPanel embedded /> inline.
export default function MachineMappingPage() {
  return <MachineMappingPanel />;
}
