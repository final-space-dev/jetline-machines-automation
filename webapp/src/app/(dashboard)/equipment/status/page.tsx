"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Search, X, ChevronRight } from "lucide-react";
import Link from "next/link";
import { classifyCondition, CONDITION_CONFIG, STATUS_CONFIG, EQUIPMENT_STATUSES, type EquipmentStatus, type ConditionBucket } from "@/lib/equipment-utils";

interface EquipmentItem {
  id: number;
  store: string;
  machine_type: string;
  make_model: string | null;
  serial: string | null;
  condition: string | null;
  located_at: string | null;
  status: EquipmentStatus;
  updated_at: string;
}

const S: Record<string, React.CSSProperties> = {
  page: { fontFamily: "var(--jl-font)", background: "var(--jl-canvas)", minHeight: "100%", padding: "32px 40px" },
  th: {
    padding: "9px 14px", textAlign: "left" as const, fontSize: 11, fontWeight: 800,
    letterSpacing: "0.07em", textTransform: "uppercase" as const, color: "var(--jl-ink-400)",
    borderBottom: "1.5px solid var(--jl-ink-100)", whiteSpace: "nowrap" as const,
    background: "var(--jl-surface-sunken)",
  } as React.CSSProperties,
  td: { padding: "11px 14px", fontSize: 13, color: "var(--jl-ink-800)", borderBottom: "1px solid var(--jl-ink-50)" } as React.CSSProperties,
  input: {
    height: 36, padding: "0 12px 0 34px", borderRadius: "var(--jl-r-sm)",
    border: "1.5px solid var(--jl-ink-200)", fontSize: 13, fontFamily: "var(--jl-font)",
    color: "var(--jl-ink-900)", background: "var(--jl-surface)", outline: "none", width: "100%",
  } as React.CSSProperties,
  select: {
    height: 36, padding: "0 10px", borderRadius: "var(--jl-r-sm)",
    border: "1.5px solid var(--jl-ink-200)", fontSize: 13, fontFamily: "var(--jl-font)",
    color: "var(--jl-ink-700)", background: "var(--jl-surface)", outline: "none",
  } as React.CSSProperties,
};

const PAGE_SIZE = 100;

export default function EquipmentStatusPage() {
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeBucket, setActiveBucket] = useState<ConditionBucket | "">("");
  const [activeStatus, setActiveStatus] = useState<EquipmentStatus | "">("");
  const [activeStore, setActiveStore] = useState("");
  const [sortKey, setSortKey] = useState<"store" | "type" | "condition" | "status">("store");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch("/api/equipment?limit=500")
      .then((r) => r.json())
      .then((d) => setItems(d.rows ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { setPage(1); }, [search, activeBucket, activeStatus, activeStore, sortKey]);

  const stores = [...new Set(items.map((i) => i.store))].sort();

  const bucketCounts: Record<ConditionBucket, number> = { good: 0, fair: 0, poor: 0, unknown: 0 };
  for (const item of items) bucketCounts[classifyCondition(item.condition)]++;

  const statusCounts: Record<EquipmentStatus, number> = { active: 0, inactive: 0, disposed: 0, transferred: 0 };
  for (const item of items) statusCounts[item.status ?? "active"]++;

  const filtered = items
    .filter((item) => {
      if (activeBucket && classifyCondition(item.condition) !== activeBucket) return false;
      if (activeStatus && (item.status ?? "active") !== activeStatus) return false;
      if (activeStore && item.store !== activeStore) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          item.store.toLowerCase().includes(q) ||
          item.machine_type.toLowerCase().includes(q) ||
          (item.make_model ?? "").toLowerCase().includes(q) ||
          (item.serial ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortKey === "store") return a.store.localeCompare(b.store);
      if (sortKey === "type") return a.machine_type.localeCompare(b.machine_type);
      if (sortKey === "condition") return classifyCondition(a.condition).localeCompare(classifyCondition(b.condition));
      if (sortKey === "status") return (a.status ?? "active").localeCompare(b.status ?? "active");
      return 0;
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const SortTh = ({ col, label }: { col: typeof sortKey; label: string }) => (
    <th
      onClick={() => setSortKey(col)}
      style={{ ...S.th, cursor: "pointer", userSelect: "none", color: sortKey === col ? "var(--jl-red-500)" : "var(--jl-ink-400)" }}
    >
      {label} {sortKey === col ? "↑" : ""}
    </th>
  );

  return (
    <AppShell>
      <div style={S.page}>

        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 18, fontSize: 12 }}>
          <Link href="/equipment" style={{ color: "var(--jl-red-500)", fontWeight: 600, textDecoration: "none" }}>Equipment CRM</Link>
          <span style={{ color: "var(--jl-ink-300)" }}>/</span>
          <span style={{ color: "var(--jl-ink-700)", fontWeight: 700 }}>Fleet Status</span>
        </div>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--jl-ink-900)", lineHeight: 1.1 }}>Fleet Status</h1>
          <p style={{ fontSize: 13, color: "var(--jl-ink-400)", marginTop: 6, fontWeight: 500 }}>
            {items.length} items across {stores.length} stores
          </p>
        </div>

        {/* Condition KPI cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          {(["good", "fair", "poor", "unknown"] as ConditionBucket[]).map((bucket) => {
            const cfg = CONDITION_CONFIG[bucket];
            const active = activeBucket === bucket;
            const count = bucketCounts[bucket];
            const pct = items.length > 0 ? Math.round((count / items.length) * 100) : 0;
            return (
              <button key={bucket} onClick={() => setActiveBucket(active ? "" : bucket)} style={{
                textAlign: "left", padding: "16px 18px",
                borderRadius: "var(--jl-r-lg)", cursor: "pointer",
                background: active ? cfg.bg : "var(--jl-surface)",
                border: `2px solid ${active ? cfg.color : "transparent"}`,
                boxShadow: active ? "none" : "var(--jl-sh-sm)",
                transition: "all var(--jl-t-fast)",
                fontFamily: "var(--jl-font)",
              }}>
                <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: active ? cfg.color : "var(--jl-ink-400)", marginBottom: 6 }}>{cfg.label}</p>
                <p style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.04em", color: active ? cfg.color : "var(--jl-ink-900)", lineHeight: 1 }}>{count}</p>
                <p style={{ fontSize: 11, color: "var(--jl-ink-400)", marginTop: 4, fontWeight: 600 }}>{pct}% of fleet</p>
              </button>
            );
          })}
        </div>

        {/* Status pills */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: "var(--jl-ink-400)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Status:</p>
          {EQUIPMENT_STATUSES.map((s) => {
            const cfg = STATUS_CONFIG[s];
            const active = activeStatus === s;
            return (
              <button key={s} onClick={() => setActiveStatus(active ? "" : s)} style={{
                padding: "4px 12px", borderRadius: "var(--jl-r-pill)", fontSize: 11, fontWeight: 700,
                cursor: "pointer", border: "1.5px solid",
                background: active ? cfg.bg : "transparent",
                color: active ? cfg.color : "var(--jl-ink-400)",
                borderColor: active ? cfg.color : "var(--jl-ink-200)",
                fontFamily: "var(--jl-font)",
                transition: "all var(--jl-t-fast)",
              }}>
                {cfg.label} ({statusCounts[s]})
              </button>
            );
          })}
        </div>

        {/* Toolbar */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 320 }}>
            <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--jl-ink-300)" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by store, type, model, serial…" style={S.input} />
            {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--jl-ink-300)", cursor: "pointer", border: "none", background: "none" }}><X size={12} /></button>}
          </div>
          <select value={activeStore} onChange={(e) => setActiveStore(e.target.value)} style={S.select}>
            <option value="">All Stores</option>
            {stores.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {(activeBucket || activeStatus || activeStore || search) && (
            <button onClick={() => { setActiveBucket(""); setActiveStatus(""); setActiveStore(""); setSearch(""); }}
              style={{ fontSize: 12, fontWeight: 700, color: "var(--jl-red-500)", cursor: "pointer", border: "none", background: "none", fontFamily: "var(--jl-font)" }}>
              Clear filters
            </button>
          )}
          <p style={{ marginLeft: "auto", fontSize: 12, color: "var(--jl-ink-400)", fontWeight: 600 }}>{filtered.length} items</p>
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                disabled={safePage === 1}
                onClick={() => setPage((p) => p - 1)}
                style={{ height: 32, padding: "0 12px", borderRadius: "var(--jl-r-sm)", border: "1.5px solid var(--jl-ink-200)", background: "var(--jl-surface)", cursor: safePage === 1 ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 700, color: safePage === 1 ? "var(--jl-ink-300)" : "var(--jl-ink-700)", fontFamily: "var(--jl-font)" }}
              >←</button>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--jl-ink-500)", whiteSpace: "nowrap" }}>
                {safePage} / {totalPages}
              </span>
              <button
                disabled={safePage === totalPages}
                onClick={() => setPage((p) => p + 1)}
                style={{ height: 32, padding: "0 12px", borderRadius: "var(--jl-r-sm)", border: "1.5px solid var(--jl-ink-200)", background: "var(--jl-surface)", cursor: safePage === totalPages ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 700, color: safePage === totalPages ? "var(--jl-ink-300)" : "var(--jl-ink-700)", fontFamily: "var(--jl-font)" }}
              >→</button>
            </div>
          )}
        </div>

        {/* Table */}
        <div style={{ background: "var(--jl-surface)", borderRadius: "var(--jl-r-lg)", boxShadow: "var(--jl-sh-sm)", overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--jl-ink-300)", fontSize: 13 }}>Loading…</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <SortTh col="store" label="Store" />
                    <SortTh col="type" label="Type" />
                    <th style={S.th}>Make / Model</th>
                    <th style={S.th}>Serial</th>
                    <SortTh col="condition" label="Condition" />
                    <SortTh col="status" label="Status" />
                    <th style={S.th}>Located At</th>
                    <th style={{ ...S.th, width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((item) => {
                    const bucket = classifyCondition(item.condition);
                    const condCfg = CONDITION_CONFIG[bucket];
                    const statCfg = STATUS_CONFIG[item.status ?? "active"];
                    return (
                      <tr key={item.id}
                        onClick={() => window.location.href = `/equipment/items/${item.id}`}
                        style={{ cursor: "pointer", transition: "background var(--jl-t-fast)" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "var(--jl-ink-50)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                      >
                        <td style={S.td}>
                          <Link href={`/equipment/stores/${encodeURIComponent(item.store)}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{ color: "var(--jl-red-500)", fontWeight: 700, fontSize: 12, textDecoration: "none" }}>
                            {item.store}
                          </Link>
                        </td>
                        <td style={{ ...S.td, fontWeight: 600, fontSize: 12 }}>{item.machine_type}</td>
                        <td style={{ ...S.td, color: item.make_model ? "var(--jl-ink-700)" : "var(--jl-ink-300)", fontStyle: item.make_model ? "normal" : "italic" }}>
                          {item.make_model ?? "—"}
                        </td>
                        <td style={S.td}>
                          <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--jl-ink-500)" }}>{item.serial ?? "—"}</span>
                        </td>
                        <td style={S.td}>
                          <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "var(--jl-r-pill)", fontSize: 11, fontWeight: 700, background: condCfg.bg, color: condCfg.color }}>
                            {condCfg.label}
                          </span>
                        </td>
                        <td style={S.td}>
                          <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "var(--jl-r-pill)", fontSize: 11, fontWeight: 700, background: statCfg.bg, color: statCfg.color }}>
                            {statCfg.label}
                          </span>
                        </td>
                        <td style={{ ...S.td, fontSize: 12, color: "var(--jl-ink-500)" }}>{item.located_at ?? "—"}</td>
                        <td style={{ ...S.td, textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                          <Link href={`/equipment/items/${item.id}`}
                            style={{ width: 28, height: 28, borderRadius: "var(--jl-r-sm)", background: "var(--jl-ink-50)", color: "var(--jl-ink-500)", display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
                            <ChevronRight size={13} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div style={{ padding: 40, textAlign: "center", color: "var(--jl-ink-400)", fontSize: 13 }}>No items match your filters</div>
              )}
            </div>
          )}
          {/* Bottom pagination */}
          {totalPages > 1 && (
            <div style={{ padding: "12px 16px", borderTop: "1px solid var(--jl-ink-100)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: "var(--jl-ink-400)", fontWeight: 600 }}>
                Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button disabled={safePage === 1} onClick={() => setPage(1)} style={{ height: 30, padding: "0 10px", borderRadius: "var(--jl-r-sm)", border: "1.5px solid var(--jl-ink-200)", background: "var(--jl-surface)", cursor: safePage === 1 ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700, color: safePage === 1 ? "var(--jl-ink-300)" : "var(--jl-ink-700)", fontFamily: "var(--jl-font)" }}>First</button>
                <button disabled={safePage === 1} onClick={() => setPage((p) => p - 1)} style={{ height: 30, padding: "0 10px", borderRadius: "var(--jl-r-sm)", border: "1.5px solid var(--jl-ink-200)", background: "var(--jl-surface)", cursor: safePage === 1 ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700, color: safePage === 1 ? "var(--jl-ink-300)" : "var(--jl-ink-700)", fontFamily: "var(--jl-font)" }}>Prev</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = Math.max(1, Math.min(totalPages - 4, safePage - 2)) + i;
                  return (
                    <button key={p} onClick={() => setPage(p)} style={{ height: 30, width: 30, borderRadius: "var(--jl-r-sm)", border: "1.5px solid", background: p === safePage ? "var(--jl-red-500)" : "var(--jl-surface)", borderColor: p === safePage ? "var(--jl-red-500)" : "var(--jl-ink-200)", cursor: "pointer", fontSize: 11, fontWeight: 700, color: p === safePage ? "#fff" : "var(--jl-ink-700)", fontFamily: "var(--jl-font)" }}>{p}</button>
                  );
                })}
                <button disabled={safePage === totalPages} onClick={() => setPage((p) => p + 1)} style={{ height: 30, padding: "0 10px", borderRadius: "var(--jl-r-sm)", border: "1.5px solid var(--jl-ink-200)", background: "var(--jl-surface)", cursor: safePage === totalPages ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700, color: safePage === totalPages ? "var(--jl-ink-300)" : "var(--jl-ink-700)", fontFamily: "var(--jl-font)" }}>Next</button>
                <button disabled={safePage === totalPages} onClick={() => setPage(totalPages)} style={{ height: 30, padding: "0 10px", borderRadius: "var(--jl-r-sm)", border: "1.5px solid var(--jl-ink-200)", background: "var(--jl-surface)", cursor: safePage === totalPages ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700, color: safePage === totalPages ? "var(--jl-ink-300)" : "var(--jl-ink-700)", fontFamily: "var(--jl-font)" }}>Last</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
