"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2, RotateCcw } from "lucide-react";
import { useRole } from "@/lib/use-role";

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
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) +
      " · " + d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
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

  if (loading) {
    return (
      <div className="jl-card jl-card--pad-lg" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="jl-spinner jl-spinner--sm" />
        <span className="jl-sm jl-muted">Loading recently deleted</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <p className="jl-sm jl-muted">
        Equipment deleted in the last 90 days. Deletes are recoverable — restore any item to bring it back exactly as it was.
      </p>

      {items.length === 0 ? (
        <div className="jl-card jl-card--pad-lg" style={{ textAlign: "center" }}>
          <span className="jl-sm jl-muted">Nothing deleted recently.</span>
        </div>
      ) : (
        <div className="jl-table-wrap">
          <div style={{ overflowX: "auto" }}>
            <table className="jl-table" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Make / Model</th>
                  <th>Serial</th>
                  <th>Store</th>
                  <th>Deleted</th>
                  {isAdmin && <th style={{ width: 110 }} />}
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td className="cell-strong">
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <Trash2 size={14} style={{ color: "var(--ink-400)" }} /> {it.machine_type ?? "—"}
                      </span>
                    </td>
                    <td style={{ color: "var(--ink-600)" }}>{it.make_model ?? <span className="jl-muted">Not set</span>}</td>
                    <td><span className="jl-mono" style={{ color: "var(--ink-600)" }}>{it.serial ?? "—"}</span></td>
                    <td style={{ color: "var(--ink-600)" }}>{it.store ?? "—"}</td>
                    <td className="jl-faint" style={{ whiteSpace: "nowrap" }}>{fmt(it.deleted_at)}</td>
                    {isAdmin && (
                      <td>
                        <button type="button" className="jl-btn jl-btn--soft jl-btn--sm" disabled={busyId === it.id} onClick={() => restore(it.id)}>
                          <RotateCcw size={14} /> Restore
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
