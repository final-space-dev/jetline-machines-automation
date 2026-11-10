"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/machines/data-table";
import { Loading } from "@/components/machines/loading";
import { Muted } from "@/components/machines/panel";
import { useRole } from "@/lib/use-role";
import { formatDateTime } from "@/lib/utils";

/**
 * Recently deleted equipment — admin recovery for soft-deleted items. Lists the
 * last 90 days of deletions and restores one with a click. Completes the
 * soft-delete feature (self-service undo instead of a manual SQL fix).
 */

interface DeletedItem {
  id: number;
  store: string | null;
  machine_type: string | null;
  make_model: string | null;
  serial: string | null;
  condition: string | null;
  deleted_at: string;
}

function fmt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : formatDateTime(d);
}

export function RecentlyDeletedPanel() {
  const { isAdmin } = useRole();
  const [items, setItems] = useState<DeletedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/equipment/deleted");
      if (res.ok) { const d = await res.json(); setItems(Array.isArray(d.items) ? d.items : []); }
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const restore = useCallback(async (id: number) => {
    setBusyId(id);
    try {
      const res = await fetch("/api/equipment/deleted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
    } finally {
      setBusyId(null);
    }
  }, []);

  if (loading) return <Loading label="Loading recently deleted" />;

  const columns: Column<DeletedItem>[] = [
    { key: "type", label: "Type", sortValue: (it) => it.machine_type ?? "", cell: (it) => <span className="font-medium">{it.machine_type ?? "—"}</span> },
    { key: "model", label: "Make / model", hideBelow: "sm", sortValue: (it) => it.make_model ?? "", cell: (it) => it.make_model ?? <Muted>Not set</Muted> },
    { key: "serial", label: "Serial", hideBelow: "md", cell: (it) => <span className="tabular-nums">{it.serial ?? "—"}</span> },
    { key: "store", label: "Store", sortValue: (it) => it.store ?? "", cell: (it) => it.store ?? "—" },
    { key: "deleted", label: "Deleted", hideBelow: "sm", sortValue: (it) => new Date(it.deleted_at).getTime() || 0, cell: (it) => <Muted className="whitespace-nowrap">{fmt(it.deleted_at)}</Muted> },
    ...(isAdmin
      ? [{
          key: "actions",
          label: "",
          align: "right",
          cell: (it: DeletedItem) => (
            <Button variant="outline" size="sm" disabled={busyId === it.id} onClick={() => restore(it.id)}>
              <RotateCcw /> Restore
            </Button>
          ),
        } satisfies Column<DeletedItem>]
      : []),
  ];

  // Equipment deleted in the last 90 days; restoring brings an item back exactly as it was.
  return (
    <div className="flex w-full max-w-5xl flex-col gap-4">
      <DataTable columns={columns} rows={items} rowKey={(it) => it.id} empty="Nothing deleted in the last 90 days" />
    </div>
  );
}
