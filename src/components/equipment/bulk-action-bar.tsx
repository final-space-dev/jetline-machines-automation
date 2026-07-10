"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Trash2, X } from "lucide-react";
import { JlSelect } from "@/components/ui/jl-select";
import { EQUIPMENT_STATUSES, STATUS_CONFIG } from "@/lib/equipment-utils";

interface BulkActionBarProps {
  selectedIds: number[];
  stores: string[];
  onApplied: () => void;
  onClear: () => void;
}

type PanelKey = "status" | "condition" | "store" | "delete" | null;

const CONDITION_OPTIONS = [
  { value: "Good", label: "Good" },
  { value: "Fair", label: "Fair" },
  { value: "Poor", label: "Poor" },
];

const STATUS_OPTIONS = EQUIPMENT_STATUSES.map((s) => ({
  value: s,
  label: STATUS_CONFIG[s].label,
}));

const barBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 34,
  padding: "0 12px",
  borderRadius: "var(--jl-r-sm)",
  background: "var(--jl-surface)",
  color: "var(--jl-ink-700)",
  fontSize: 12,
  fontWeight: 700,
  fontFamily: "var(--jl-font)",
  cursor: "pointer",
  border: "1.5px solid var(--jl-ink-200)",
  whiteSpace: "nowrap",
};

const popover: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 8px)",
  left: 0,
  zIndex: 60,
  width: 240,
  padding: 14,
  background: "var(--jl-surface)",
  boxShadow: "var(--jl-sh-lg)",
  borderRadius: "var(--jl-r-md)",
  border: "1px solid var(--jl-ink-100)",
};

const popLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--jl-ink-400)",
  marginBottom: 8,
  display: "block",
};

export function BulkActionBar({ selectedIds, stores, onApplied, onClear }: BulkActionBarProps) {
  const [panel, setPanel] = useState<PanelKey>(null);
  const [statusVal, setStatusVal] = useState("");
  const [conditionVal, setConditionVal] = useState("");
  const [storeVal, setStoreVal] = useState("");
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const count = selectedIds.length;

  // Click-outside closes any open popover.
  useEffect(() => {
    if (!panel) return;
    const handle = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setPanel(null);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [panel]);

  const toggle = (key: Exclude<PanelKey, null>) => {
    setPanel((p) => (p === key ? null : key));
  };

  async function apply(field: string, value: string) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/equipment/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, field, value }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || "Bulk update failed");
      }
      const j = (await res.json()) as { updated: number };
      toast.success(`${j.updated} item${j.updated !== 1 ? "s" : ""} updated`);
      setPanel(null);
      setStatusVal("");
      setConditionVal("");
      setStoreVal("");
      onApplied();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk update failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/equipment/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, field: "__delete__", value: "" }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || "Bulk delete failed");
      }
      const j = (await res.json()) as { updated: number };
      toast.success(`${j.updated} item${j.updated !== 1 ? "s" : ""} deleted`);
      setPanel(null);
      onApplied();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk delete failed");
    } finally {
      setBusy(false);
    }
  }

  const applyBtn: React.CSSProperties = {
    width: "100%",
    height: 34,
    marginTop: 12,
    borderRadius: "var(--jl-r-sm)",
    background: "var(--jl-red-500)",
    color: "#fff",
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "var(--jl-font)",
    border: "none",
    boxShadow: "var(--jl-sh-red)",
    cursor: busy ? "default" : "pointer",
    opacity: busy ? 0.7 : 1,
  };

  return (
    <div
      ref={rootRef}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 16px",
        marginBottom: 12,
        borderRadius: "var(--jl-r-md)",
        background: "var(--jl-red-tint)",
        border: "1.5px solid var(--jl-red-300)",
        boxShadow: "var(--jl-sh-sm)",
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 800, color: "var(--jl-red-700)", whiteSpace: "nowrap" }}>
        {count} item{count !== 1 ? "s" : ""} selected
      </span>

      {/* Change Status */}
      <div style={{ position: "relative" }}>
        <button type="button" style={barBtn} onClick={() => toggle("status")}>
          Change Status <ChevronDown size={13} />
        </button>
        {panel === "status" && (
          <div style={popover}>
            <label style={popLabel}>New status</label>
            <JlSelect value={statusVal} onChange={setStatusVal} placeholder="Select status" options={STATUS_OPTIONS} />
            <button
              type="button"
              disabled={busy || !statusVal}
              style={{ ...applyBtn, opacity: busy || !statusVal ? 0.5 : 1, cursor: busy || !statusVal ? "default" : "pointer" }}
              onClick={() => statusVal && apply("status", statusVal)}
            >
              Apply to {count}
            </button>
          </div>
        )}
      </div>

      {/* Change Condition */}
      <div style={{ position: "relative" }}>
        <button type="button" style={barBtn} onClick={() => toggle("condition")}>
          Change Condition <ChevronDown size={13} />
        </button>
        {panel === "condition" && (
          <div style={popover}>
            <label style={popLabel}>New condition</label>
            <JlSelect value={conditionVal} onChange={setConditionVal} placeholder="Select condition" options={CONDITION_OPTIONS} />
            <button
              type="button"
              disabled={busy || !conditionVal}
              style={{ ...applyBtn, opacity: busy || !conditionVal ? 0.5 : 1, cursor: busy || !conditionVal ? "default" : "pointer" }}
              onClick={() => conditionVal && apply("condition", conditionVal)}
            >
              Apply to {count}
            </button>
          </div>
        )}
      </div>

      {/* Reassign Store */}
      <div style={{ position: "relative" }}>
        <button type="button" style={barBtn} onClick={() => toggle("store")}>
          Reassign Store <ChevronDown size={13} />
        </button>
        {panel === "store" && (
          <div style={{ ...popover, width: 260 }}>
            <label style={popLabel}>Move to store</label>
            <JlSelect
              value={storeVal}
              onChange={setStoreVal}
              placeholder="Select store"
              options={stores.map((s) => ({ value: s, label: s }))}
            />
            <button
              type="button"
              disabled={busy || !storeVal}
              style={{ ...applyBtn, opacity: busy || !storeVal ? 0.5 : 1, cursor: busy || !storeVal ? "default" : "pointer" }}
              onClick={() => storeVal && apply("store", storeVal)}
            >
              Reassign {count}
            </button>
          </div>
        )}
      </div>

      {/* Delete */}
      <div style={{ position: "relative" }}>
        <button
          type="button"
          style={{ ...barBtn, color: "var(--jl-red-500)", borderColor: "var(--jl-red-300)" }}
          onClick={() => toggle("delete")}
        >
          <Trash2 size={13} /> Delete
        </button>
        {panel === "delete" && (
          <div style={popover}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--jl-ink-900)", marginBottom: 4 }}>
              Delete {count} item{count !== 1 ? "s" : ""}?
            </div>
            <div style={{ fontSize: 12, color: "var(--jl-ink-500)", lineHeight: 1.5 }}>
              This permanently removes the selected equipment. This cannot be undone.
            </div>
            <button
              type="button"
              disabled={busy}
              style={{
                width: "100%",
                height: 34,
                marginTop: 12,
                borderRadius: "var(--jl-r-sm)",
                background: "var(--jl-red-500)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "var(--jl-font)",
                border: "none",
                boxShadow: "var(--jl-sh-red)",
                cursor: busy ? "default" : "pointer",
                opacity: busy ? 0.7 : 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
              onClick={remove}
            >
              <Trash2 size={13} /> Delete {count}
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        style={{ ...barBtn, marginLeft: "auto", border: "none", background: "transparent", color: "var(--jl-red-700)" }}
        onClick={onClear}
      >
        <X size={13} /> Clear
      </button>
    </div>
  );
}
