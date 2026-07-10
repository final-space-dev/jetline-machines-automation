import { AppShell } from "@/components/layout/app-shell";
import { PrinterPageSkeleton } from "@/components/equipment/skeleton";

export default function Loading() {
  return (
    <AppShell>
      <PrinterPageSkeleton />
    </AppShell>
  );
}
