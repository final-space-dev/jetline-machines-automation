"use client";

import { useState } from "react";
import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { Confirm } from "@/components/machines/confirm";
import { Pick } from "@/components/machines/pick";
import { EQUIPMENT_STATUS_LABEL } from "@/components/machines/status-badge";
import { EQUIPMENT_STATUSES } from "@/lib/equipment-utils";
import { toast } from "@/lib/toast";

interface BulkActionBarProps {
  selectedIds: number[];
  stores: string[];
  onApplied: () => void;
  onClear: () => void;
}

const CONDITION_OPTIONS = [
  { value: "Good", label: "Good" },
  { value: "Fair", label: "Fair" },
  { value: "Poor", label: "Poor" },
];

const STATUS_OPTIONS = EQUIPMENT_STATUSES.map((s) => ({ value: s, label: EQUIPMENT_STATUS_LABEL[s] }));

// What is about to be applied: a field and its new value, or the delete.
type Pending = { field: "status" | "condition" | "store"; value: string; words: string } | { field: "__delete__" };

/** The bar that appears while equipment is selected: change status or condition, move store, or delete, each confirmed first. */
export function BulkActionBar({ selectedIds, stores, onApplied, onClear }: BulkActionBarProps) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);

  const count = selectedIds.length;
  const items = `${count} item${count !== 1 ? "s" : ""}`;

  async function run() {
    if (busy || !pending) return;
    const deleting = pending.field === "__delete__";
    setBusy(true);
    try {
      const res = await fetch("/api/equipment/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, field: pending.field, value: deleting ? "" : pending.value }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || (deleting ? "Bulk delete failed" : "Bulk update failed"));
      }
      const j = (await res.json()) as { updated: number };
      toast.success(`${j.updated} item${j.updated !== 1 ? "s" : ""} ${deleting ? "deleted" : "updated"}`);
      setPending(null);
      onApplied();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : deleting ? "Bulk delete failed" : "Bulk update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <StickyActionBar sticky={false} summary={<><b>{count}</b> item{count !== 1 ? "s" : ""} selected</>} className="[&>div:last-child]:flex-wrap">
        <Pick
          aria-label="Change status"
          size="sm"
          className="w-40"
          value=""
          placeholder="Change status"
          options={STATUS_OPTIONS}
          onChange={(v) => v && setPending({ field: "status", value: v, words: `Set status to ${EQUIPMENT_STATUS_LABEL[v as keyof typeof EQUIPMENT_STATUS_LABEL] ?? v}` })}
        />
        <Pick
          aria-label="Change condition"
          size="sm"
          className="w-44"
          value=""
          placeholder="Change condition"
          options={CONDITION_OPTIONS}
          onChange={(v) => v && setPending({ field: "condition", value: v, words: `Set condition to ${v}` })}
        />
        <Pick
          aria-label="Reassign store"
          size="sm"
          className="w-44"
          value=""
          placeholder="Reassign store"
          options={stores.map((s) => ({ value: s, label: s }))}
          onChange={(v) => v && setPending({ field: "store", value: v, words: `Move to ${v}` })}
        />
        <Button variant="destructive" size="sm" onClick={() => setPending({ field: "__delete__" })}>
          <Trash2 /> Delete
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X /> Clear
        </Button>
      </StickyActionBar>
      <Confirm
        open={pending !== null}
        onOpenChange={(o) => { if (!o && !busy) setPending(null); }}
        title={pending?.field === "__delete__" ? `Delete ${items}?` : `${pending && "words" in pending ? pending.words : ""} for ${items}?`}
        detail={pending?.field === "__delete__" ? "This permanently removes the selected equipment. This cannot be undone." : undefined}
        action={pending?.field === "__delete__" ? `Delete ${count}` : `Apply to ${count}`}
        destructive={pending?.field === "__delete__"}
        pending={busy}
        onConfirm={run}
      />
    </>
  );
}
