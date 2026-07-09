import { AppShell } from "@/components/layout/app-shell";
import { EquipmentItemSkeleton } from "@/components/equipment/skeleton";

export default function Loading() {
  return (
    <AppShell>
      <EquipmentItemSkeleton />
    </AppShell>
  );
}
