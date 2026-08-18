"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { useAdminGuard } from "@/lib/use-admin-guard";
import { AttentionList, type AttentionTab } from "@/components/dashboard/attention-list";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from "recharts";
import { CompletenessBadge } from "@/components/equipment/completeness-badge";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Kpi {
  total: number;
  poor: number;
  serviceOverdue: number;
  replaceFlagged: number;
  contractsExpiring30d: number;
}

interface ConditionBreakdown {
  good: number;
  fair: number;
  poor: number;
  unknown: number;
}

interface EquipmentAttention {
  id: number;
  store: string;
  machine_type: string | null;
  make_model: string | null;
  condition: string | null;
  updated_at: string | null;
  next_service_due?: string | null;
}

interface PrinterAttention {
  serial: string;
  store: string | null;
  model: string | null;
  contract_end: string | null;
  days_remaining: number | null;
}

type ReplaceRow =
  | ({ kind: "printer" } & PrinterAttention)
  | ({ kind: "equipment" } & EquipmentAttention);

interface StoreHealthRow {
  store: string;
  group: string | null;
  equipment: number;
  poor: number;
  printers: number;
  replace: number;
  score: number;
  lastActivity: string | null;
}

interface FleetHealth {
  kpi: Kpi;
  conditionBreakdown: ConditionBreakdown;
  attentionItems: {
    poorCondition: EquipmentAttention[];
    serviceOverdue: EquipmentAttention[];
    replaceFlagged: ReplaceRow[];
    contractsExpiring: PrinterAttention[];
  };
  storeHealth: StoreHealthRow[];
}

interface DataQualityRow {
  store: string;
  group: string | null;
  overallScore: number;
  itemsCount: number;
  itemsNoSerial: number;
  itemsNoServiceDate: number;
  printersNoCondition: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Red link, used for the primary identifier in a cell. */
const linkStyle: CSSProperties = { color: "var(--red-600)", fontWeight: 700, textDecoration: "none" };
/** Neutral link, used for the secondary identifier in a cell. */
const linkMuted: CSSProperties = { color: "var(--ink-800)", fontWeight: 600, textDecoration: "none" };

const COND_COLORS = {
  good: "var(--green-500)",
  fair: "var(--amber-500)",
  poor: "var(--red-500)",
  unknown: "var(--ink-200)",
};

const CONDITION_TO_TAB: Record<string, string> = {
  poor: "poorCondition",
};

function fmtDate(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

/** Traffic-light badge variant for a 0–1 store score. */
function scoreBadgeClass(score: number): string {
  if (score < 0.6) return "jl-badge jl-badge--red";
  if (score < 0.85) return "jl-badge jl-badge--amber";
  return "jl-badge jl-badge--green";
}

// ─── Completeness leaderboard (P19) ────────────────────────────────────────────

function LeaderRow({ rank, row, tone }: { rank: number; row: DataQualityRow; tone: "top" | "bottom" }) {
  return (
    <Link
      href={`/stores/${encodeURIComponent(row.store)}/completeness`}
      style={{
        display: "flex", alignItems: "center", gap: "var(--s-3)", padding: "9px 12px",
        borderRadius: "var(--r-md)", textDecoration: "none",
        background: "var(--surface-sunken)", boxShadow: "var(--sh-inset)",
      }}
    >
      <span style={{
        width: 22, height: 22, borderRadius: "var(--r-pill)", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 800,
        color: tone === "top" ? "var(--green-700)" : "var(--red-600)",
        background: tone === "top" ? "var(--green-tint)" : "var(--red-tint)",
      }}>{rank}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: "var(--ink-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {row.store}
      </span>
      <CompletenessBadge score={row.overallScore} />
    </Link>
  );
}

function CompletenessLeaderboard({ rows }: { rows: DataQualityRow[] }) {
  // API returns worst-first. Bottom 5 = first 5; top 5 = last 5 (descending).
  const scored = useMemo(() => rows.filter((r) => Number.isFinite(r.overallScore)), [rows]);
  const bottom5 = useMemo(() => scored.slice(0, 5), [scored]);
  const top5 = useMemo(() => [...scored].slice(-5).reverse(), [scored]);

  if (scored.length === 0) return null;

  const best = top5[0];
  const worst = bottom5[0];
  const summary =
    best && worst && best.store !== worst.store
      ? `${best.store} is your most complete store (${Math.round(best.overallScore)}%). ${worst.store} needs attention (${Math.round(worst.overallScore)}%).`
      : best
        ? `${best.store} leads on data completeness (${Math.round(best.overallScore)}%).`
        : "";

  return (
    <div className="jl-card" style={{ marginBottom: "var(--s-5)" }}>
      <h2 className="jl-h2" style={{ marginBottom: "var(--s-4)" }}>Completeness Leaderboard</h2>
      {summary && (
        <p className="jl-sm jl-muted" style={{ marginBottom: "var(--s-5)" }}>{summary}</p>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "var(--s-6)" }}>
        <div>
          <p className="jl-sm" style={{ color: "var(--green-700)", fontWeight: "var(--fw-bold)", marginBottom: "var(--s-3)" }}>Most Complete</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
            {top5.map((r, i) => <LeaderRow key={r.store} rank={i + 1} row={r} tone="top" />)}
          </div>
        </div>
        <div>
          <p className="jl-sm" style={{ color: "var(--red-600)", fontWeight: "var(--fw-bold)", marginBottom: "var(--s-3)" }}>Needs Attention</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
            {bottom5.map((r, i) => <LeaderRow key={r.store} rank={i + 1} row={r} tone="bottom" />)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function FleetHealthPage() {
  // admin-only; store staff are redirected to their store. Gate rendering on it
  // so staff never hit the fleet render path (the API 403s them).
  const { allowed, loading: guardLoading } = useAdminGuard("nav:fleet");
  const [data, setData] = useState<FleetHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("poorCondition");
  const [quality, setQuality] = useState<DataQualityRow[]>([]);

  useEffect(() => {
    // Only fetch once we've confirmed admin — the API 403s staff and the error
    // body would crash the breakdown render.
    if (!allowed) return;
    fetch("/api/equipment/fleet-health")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [allowed]);

  // P19 leaderboard source — single call, already sorted worst-first.
  useEffect(() => {
    let alive = true;
    fetch("/api/reports/data-quality")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: DataQualityRow[]) => { if (alive) setQuality(Array.isArray(d) ? d : []); })
      .catch(() => { /* leaderboard optional */ });
    return () => { alive = false; };
  }, []);

  const barData = useMemo(() => {
    const c = data?.conditionBreakdown;
    if (!c) return [];
    return [{ name: "Fleet", good: c.good, fair: c.fair, poor: c.poor, unknown: c.unknown }];
  }, [data]);

  const tabs: AttentionTab[] = useMemo(() => {
    if (!data) return [];
    const ai = data.attentionItems;

    const equipCols = (extra?: { key: string; label: string; render: (r: EquipmentAttention) => React.ReactNode; align?: "left" | "right" }) => [
      {
        key: "store", label: "Store", sortable: true,
        render: (r: EquipmentAttention) => (
          <Link href={`/stores/${encodeURIComponent(r.store)}`} style={linkStyle} onClick={(e) => e.stopPropagation()}>{r.store}</Link>
        ),
      },
      {
        key: "machine_type", label: "Type", sortable: true,
        render: (r: EquipmentAttention) => (
          <Link href={`/equipment/items/${r.id}`} style={linkMuted} onClick={(e) => e.stopPropagation()}>
            {r.machine_type ?? "Equipment"}
          </Link>
        ),
      },
      { key: "make_model", label: "Model", sortable: true, render: (r: EquipmentAttention) => r.make_model ?? "" },
      { key: "condition", label: "Condition", sortable: true, render: (r: EquipmentAttention) => r.condition ?? "" },
      ...(extra ? [extra] : []),
    ];

    const printerCols = (opts: { showDays?: boolean } = {}) => [
      {
        key: "serial", label: "Serial", sortable: true,
        render: (r: PrinterAttention) => (
          <Link href={`/equipment/printers/${encodeURIComponent(r.serial)}`} style={linkStyle} onClick={(e) => e.stopPropagation()}>{r.serial}</Link>
        ),
      },
      {
        key: "store", label: "Store", sortable: true,
        render: (r: PrinterAttention) => r.store
          ? <Link href={`/stores/${encodeURIComponent(r.store)}`} style={linkMuted} onClick={(e) => e.stopPropagation()}>{r.store}</Link>
          : "",
      },
      { key: "model", label: "Model", sortable: true, render: (r: PrinterAttention) => r.model ?? "" },
      ...(opts.showDays
        ? [
            { key: "contract_end", label: "Contract End", sortable: true, render: (r: PrinterAttention) => fmtDate(r.contract_end) },
            {
              key: "days_remaining", label: "Days Left", align: "right" as const, sortable: true,
              sortValue: (r: PrinterAttention) => r.days_remaining ?? 9999,
              render: (r: PrinterAttention) => {
                const d = r.days_remaining ?? 0;
                const color = d <= 7 ? "var(--red-500)" : d <= 30 ? "var(--amber-700)" : "var(--ink-600)";
                return <span style={{ fontWeight: 800, color }}>{d}</span>;
              },
            },
          ]
        : []),
    ];

    return [
      {
        key: "poorCondition",
        label: "Poor Condition",
        rows: ai.poorCondition,
        rowKey: (r: EquipmentAttention) => `eq-${r.id}`,
        columns: equipCols({
          key: "updated_at", label: "Updated", align: "right",
          render: (r: EquipmentAttention) => fmtDate(r.updated_at),
        }),
      },
      {
        key: "serviceOverdue",
        label: "Service Overdue",
        rows: ai.serviceOverdue,
        rowKey: (r: EquipmentAttention) => `sv-${r.id}`,
        columns: equipCols({
          key: "next_service_due", label: "Due", align: "right",
          render: (r: EquipmentAttention) => (
            <span style={{ color: "var(--red-500)", fontWeight: 700 }}>{fmtDate(r.next_service_due)}</span>
          ),
        }),
      },
      {
        key: "replaceFlagged",
        label: "Replace Flagged",
        rows: ai.replaceFlagged,
        rowKey: (r: ReplaceRow) => (r.kind === "printer" ? `p-${r.serial}` : `e-${r.id}`),
        columns: [
          {
            key: "ref", label: "Item", sortable: true,
            sortValue: (r: ReplaceRow) => (r.kind === "printer" ? r.serial : r.machine_type ?? ""),
            render: (r: ReplaceRow) =>
              r.kind === "printer" ? (
                <Link href={`/equipment/printers/${encodeURIComponent(r.serial)}`} style={linkStyle} onClick={(e) => e.stopPropagation()}>{r.serial}</Link>
              ) : (
                <Link href={`/equipment/items/${r.id}`} style={linkStyle} onClick={(e) => e.stopPropagation()}>{r.machine_type ?? "Equipment"}</Link>
              ),
          },
          {
            key: "kind", label: "Kind", sortable: true,
            render: (r: ReplaceRow) => (r.kind === "printer" ? "Printer" : "Equipment"),
          },
          {
            key: "store", label: "Store", sortable: true,
            sortValue: (r: ReplaceRow) => r.store ?? "",
            render: (r: ReplaceRow) => r.store
              ? <Link href={`/stores/${encodeURIComponent(r.store)}`} style={linkMuted} onClick={(e) => e.stopPropagation()}>{r.store}</Link>
              : "",
          },
          {
            key: "detail", label: "Detail", sortable: false,
            render: (r: ReplaceRow) => (r.kind === "printer" ? r.model ?? "" : r.make_model ?? ""),
          },
        ],
      },
      {
        key: "contractsExpiring",
        label: "Contracts Expiring",
        rows: ai.contractsExpiring,
        rowKey: (r: PrinterAttention) => `c-${r.serial}`,
        columns: printerCols({ showDays: true }),
      },
    ] as AttentionTab[];
  }, [data]);

  // Block non-admins from the fleet render path entirely (they're being redirected).
  if (guardLoading || !allowed) {
    return (
      <AppShell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
          <p className="jl-sm jl-faint">Loading…</p>
        </div>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
          <p className="jl-sm jl-faint">Loading fleet health</p>
        </div>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <div>
          <h1 className="jl-h1" style={{ marginBottom: "var(--s-5)" }}>Fleet Health</h1>
          <p className="jl-sm jl-faint">Could not load fleet health data.</p>
        </div>
      </AppShell>
    );
  }

  const kpis: { key: keyof Kpi; label: string; color: string }[] = [
    { key: "total", label: "Total Equipment", color: "var(--ink-900)" },
    { key: "poor", label: "Poor Condition", color: "var(--red-500)" },
    { key: "serviceOverdue", label: "Service Overdue", color: "var(--amber-700)" },
    { key: "replaceFlagged", label: "Replace Flagged", color: "var(--red-500)" },
    { key: "contractsExpiring30d", label: "Contracts Expiring", color: "var(--amber-700)" },
  ];

  return (
    <AppShell>
      <div>
        <h1 className="jl-h1" style={{ marginBottom: "var(--s-6)" }}>Fleet Health</h1>

        {/* KPI row — value + label only, no sub-labels */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "var(--s-4)", marginBottom: "var(--s-5)" }}>
          {kpis.map((k) => (
            <div key={k.key} className="jl-kpi">
              <p className="jl-kpi__value" style={{ color: k.color }}>{data.kpi[k.key]}</p>
              <p className="jl-kpi__label">{k.label}</p>
            </div>
          ))}
        </div>

        {/* Condition breakdown — full-width horizontal stacked bar in a card */}
        <div className="jl-card" style={{ marginBottom: "var(--s-5)" }}>
          <h2 className="jl-h2" style={{ marginBottom: "var(--s-4)" }}>Condition Breakdown</h2>
          <div style={{ width: "100%", height: 88 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={barData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" hide />
                <Tooltip
                  cursor={{ fill: "var(--ink-50)" }}
                  contentStyle={{ background: "var(--surface)", borderRadius: 10, border: "none", boxShadow: "var(--sh-lg)", fontSize: 12, fontFamily: "var(--font)", color: "var(--ink-900)" }}
                />
                <Bar dataKey="good" stackId="c" name="Good" fill={COND_COLORS.good} radius={[6, 0, 0, 6]} cursor="pointer" onClick={() => setActiveTab(CONDITION_TO_TAB.poor)}>
                  <Cell fill={COND_COLORS.good} />
                </Bar>
                <Bar dataKey="fair" stackId="c" name="Fair" fill={COND_COLORS.fair} cursor="pointer" onClick={() => setActiveTab("poorCondition")}>
                  <Cell fill={COND_COLORS.fair} />
                </Bar>
                <Bar dataKey="poor" stackId="c" name="Poor" fill={COND_COLORS.poor} cursor="pointer" onClick={() => setActiveTab("poorCondition")}>
                  <Cell fill={COND_COLORS.poor} />
                </Bar>
                <Bar dataKey="unknown" stackId="c" name="Unassessed" fill={COND_COLORS.unknown} radius={[0, 6, 6, 0]} cursor="pointer" onClick={() => setActiveTab("poorCondition")}>
                  <Cell fill={COND_COLORS.unknown} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div style={{ display: "flex", gap: "var(--s-5)", marginTop: "var(--s-3)", flexWrap: "wrap" }}>
            {([
              ["good", "Good", data.conditionBreakdown.good],
              ["fair", "Fair", data.conditionBreakdown.fair],
              ["poor", "Poor", data.conditionBreakdown.poor],
              ["unknown", "Unassessed", data.conditionBreakdown.unknown],
            ] as const).map(([k, label, count]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: COND_COLORS[k], flexShrink: 0 }} />
                <span style={{ color: "var(--ink-600)", fontWeight: 600 }}>{label}</span>
                <span style={{ color: "var(--ink-900)", fontWeight: 800 }}>{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Completeness leaderboard (P19) */}
        <CompletenessLeaderboard rows={quality} />

        {/* Attention list */}
        <div className="jl-card" style={{ marginBottom: "var(--s-5)" }}>
          <h2 className="jl-h2" style={{ marginBottom: "var(--s-4)" }}>Needs Attention</h2>
          <AttentionList tabs={tabs} activeKey={activeTab} onTabChange={setActiveTab} />
        </div>

        {/* Store health table */}
        <div className="jl-card">
          <h2 className="jl-h2" style={{ marginBottom: "var(--s-4)" }}>Store Health</h2>
          <div className="jl-table-wrap" style={{ overflowX: "auto" }}>
            <table className="jl-table">
              <thead>
                <tr>
                  <th>Store</th>
                  <th>Group</th>
                  <th className="num">Equipment</th>
                  <th className="num">Poor</th>
                  <th className="num">Printers</th>
                  <th className="num">Replace</th>
                  <th className="num">Score</th>
                  <th className="num">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {data.storeHealth.map((row) => (
                  <tr key={row.store}>
                    <td>
                      <Link href={`/stores/${encodeURIComponent(row.store)}`} style={linkStyle}>{row.store}</Link>
                    </td>
                    <td style={{ color: "var(--ink-500)" }}>{row.group ?? ""}</td>
                    <td className="num cell-strong">{row.equipment}</td>
                    <td className="num" style={{ color: row.poor > 0 ? "var(--red-500)" : "var(--ink-300)", fontWeight: row.poor > 0 ? 700 : 500 }}>{row.poor}</td>
                    <td className="num" style={{ color: "var(--ink-600)" }}>{row.printers}</td>
                    <td className="num" style={{ color: row.replace > 0 ? "var(--amber-700)" : "var(--ink-300)", fontWeight: row.replace > 0 ? 700 : 500 }}>{row.replace}</td>
                    <td className="num">
                      <span className={scoreBadgeClass(row.score)}>{Math.round(row.score * 100)}%</span>
                    </td>
                    <td className="num" style={{ color: "var(--ink-400)", fontSize: 12 }}>{fmtDate(row.lastActivity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
