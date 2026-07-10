"use client";

/**
 * Phase 18 — Print Volumes section for the store detail page.
 * Renders a recharts stacked bar (last 6 months: Black / Colour / A3 / A3 Colour),
 * this-month-vs-last-month % change, top printer, a BMS sync badge, and a
 * billing reconciliation chip (Xerox billed vs BMS reported, variance > 5% highlighted).
 *
 * Data comes from GET /api/stores/[store]/print-report. If that route 404s during
 * dev (backend built concurrently) the section renders a neutral empty state.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Printer, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LabelList,
} from "recharts";

// ─── API shape ────────────────────────────────────────────────────────────────

interface PrintMonth {
  month: string;
  black: number;
  colour: number;
  a3: number;
  a3colour: number;
  total: number;
}

interface PrintReport {
  store: string;
  serial: string | null;
  serials: { serial: string; model: string }[];
  months: PrintMonth[];
  thisMonthTotal: number;
  lastMonthTotal: number;
  pctChange: number;
  topPrinter: { serial: string; model: string; volume: number } | null;
  printers: { active: number; replaceFlagged: number };
  lastSync: string | null;
  billing: { xeroxVolume: number; bmsVolume: number; variancePct: number } | null;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  surface: { background: "var(--jl-surface)", boxShadow: "var(--jl-sh-sm)", borderRadius: "var(--jl-r-lg)", overflow: "hidden" },
  section: { fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--jl-ink-900)" },
  label: { fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--jl-ink-400)" },
  statNum: { fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--jl-ink-900)", lineHeight: 1 },
  chip: {
    display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px",
    borderRadius: "var(--jl-r-pill)", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
  },
};

const SERIES = [
  { key: "black", label: "Black", color: "var(--jl-blue-500)" },
  { key: "colour", label: "Colour", color: "var(--jl-red-500)" },
  { key: "a3", label: "A3", color: "var(--jl-ink-400)" },
  { key: "a3colour", label: "A3 Colour", color: "var(--jl-amber-500)" },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** 23400 -> "23.4k", 980 -> "980". */
export function formatK(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 1000) {
    const v = n / 1000;
    return `${v >= 100 ? Math.round(v) : v.toFixed(1)}k`;
  }
  return `${Math.round(n)}`;
}

/** Format a month key like "2026-06" or ISO date to "Jun". */
function shortMonth(m: string): string {
  const d = new Date(m.length === 7 ? `${m}-01` : m);
  if (Number.isNaN(d.getTime())) return m;
  return d.toLocaleDateString("en-ZA", { month: "short" });
}

/** Derive a sync badge from lastSync: green if within 24h, amber < 7d, red otherwise. */
function syncBadge(lastSync: string | null): { label: string; color: string; bg: string } {
  if (!lastSync) return { label: "Never synced", color: "var(--jl-ink-400)", bg: "var(--jl-ink-50)" };
  const d = new Date(lastSync).getTime();
  if (Number.isNaN(d)) return { label: "Never synced", color: "var(--jl-ink-400)", bg: "var(--jl-ink-50)" };
  const diff = Date.now() - d;
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  let rel: string;
  if (hours < 1) rel = "just now";
  else if (hours < 24) rel = `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  else rel = `${days} day${days !== 1 ? "s" : ""} ago`;

  if (days >= 3) return { label: `Sync failed ${rel}`, color: "var(--jl-red-600)", bg: "var(--jl-red-tint)" };
  if (days >= 1) return { label: `Synced ${rel}`, color: "var(--jl-amber-700)", bg: "var(--jl-amber-tint)" };
  return { label: `Synced ${rel}`, color: "var(--jl-green-700)", bg: "var(--jl-green-tint)" };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PrintSection({
  store,
  reconHref,
}: {
  store: string;
  /** Optional link to this store's recon report; omit the link when undefined. */
  reconHref?: string;
}) {
  const [data, setData] = useState<PrintReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  // "" = All printers (whole store). Any other value filters to that serial.
  const [selectedSerial, setSelectedSerial] = useState("");
  // Printer list persists across filter changes (it's store-wide, not per-filter),
  // so the dropdown never empties while a filtered fetch is in flight.
  const [serials, setSerials] = useState<{ serial: string; model: string }[]>([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setUnavailable(false);
    const qs = selectedSerial ? `?serial=${encodeURIComponent(selectedSerial)}` : "";
    fetch(`/api/stores/${encodeURIComponent(store)}/print-report${qs}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: PrintReport) => {
        if (!alive) return;
        setData(d);
        if (Array.isArray(d.serials) && d.serials.length) setSerials(d.serials);
      })
      .catch(() => { if (alive) setUnavailable(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [store, selectedSerial]);

  const chartData =
    data?.months.map((m) => ({
      month: shortMonth(m.month),
      black: m.black,
      colour: m.colour,
      a3: m.a3,
      a3colour: m.a3colour,
      // total drives the value label above each stacked bar (#3).
      total: m.total,
    })) ?? [];

  const pct = data?.pctChange ?? 0;
  const up = pct >= 0;
  const sync = syncBadge(data?.lastSync ?? null);

  // Index of the last stacked series (top of the bar) that is non-zero across the
  // whole dataset — the rounded top corners + total label attach to it. Falls back
  // to the last series so a single-printer B&W machine (only "black") still rounds.
  const seriesTotals = SERIES.map((s) =>
    chartData.reduce((sum, d) => sum + (Number((d as unknown as Record<string, number>)[s.key]) || 0), 0)
  );
  let topSeriesIdx = SERIES.length - 1;
  for (let i = SERIES.length - 1; i >= 0; i--) {
    if (seriesTotals[i] > 0) { topSeriesIdx = i; break; }
  }

  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ ...S.section, marginBottom: 14 }}>Print Volumes</h2>

      <div style={S.surface}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--jl-ink-300)", fontSize: 13 }}>Loading print data</div>
        ) : unavailable || !data || data.months.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--jl-ink-400)", fontSize: 13 }}>
            {unavailable ? "Print data is not available for this store yet" : "No print volume recorded in the last 6 months"}
          </div>
        ) : (
          <div style={{ padding: 22 }}>
            {/* Stat row */}
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <p style={{ ...S.label, marginBottom: 6 }}>This Month</p>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={S.statNum}>{formatK(data.thisMonthTotal)}</span>
                  <span
                    title={`vs last month (${formatK(data.lastMonthTotal)})`}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 800,
                      color: up ? "var(--jl-green-700)" : "var(--jl-red-600)",
                    }}
                  >
                    {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                    {up ? "+" : ""}{pct.toFixed(1)}%
                  </span>
                </div>
              </div>

              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
                {/* Printer filter — "All printers" (whole store) or one serial (#4). */}
                {serials.length > 0 && (
                  <select
                    value={selectedSerial}
                    onChange={(e) => setSelectedSerial(e.target.value)}
                    aria-label="Filter by printer"
                    className="jl-select"
                    style={{ width: "auto", minWidth: 150, height: 34, fontSize: 12, fontWeight: 700 }}
                  >
                    <option value="">All printers</option>
                    {serials.map((p) => (
                      <option key={p.serial} value={p.serial}>
                        {p.serial}{p.model ? ` · ${p.model}` : ""}
                      </option>
                    ))}
                  </select>
                )}
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--jl-ink-500)", whiteSpace: "nowrap" }}>
                  {data.printers.active} active
                  {data.printers.replaceFlagged > 0 && (
                    <span style={{ color: "var(--jl-red-600)" }}>{" · "}{data.printers.replaceFlagged} replace</span>
                  )}
                </span>
              </div>
            </div>

            {/* Stacked bar */}
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 24, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--jl-ink-100)" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fontWeight: 700, fill: "var(--jl-ink-500)" }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--jl-ink-100)" }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--jl-ink-400)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => formatK(v)}
                    width={44}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--jl-ink-50)" }}
                    contentStyle={{ borderRadius: 8, border: "1px solid var(--jl-ink-200)", fontSize: 12, fontFamily: "var(--jl-font)" }}
                    formatter={(v, name) => [formatK(Number(v) || 0), String(name)]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--jl-font)" }}
                    iconType="circle"
                  />
                  {SERIES.map((s, i) => (
                    <Bar
                      key={s.key}
                      dataKey={s.key}
                      stackId="v"
                      name={s.label}
                      fill={s.color}
                      // Rounded top corners on the topmost non-zero series (#3).
                      radius={i === topSeriesIdx ? [5, 5, 0, 0] : undefined}
                    >
                      {/* Monthly total label above each bar — attached to the top
                          series so it sits at the very top of the stack (#3). */}
                      {i === topSeriesIdx && (
                        <LabelList
                          dataKey="total"
                          position="top"
                          offset={8}
                          formatter={(v: React.ReactNode) => {
                            const n = Number(v);
                            return n > 0 ? formatK(n) : "";
                          }}
                          style={{ fontSize: 11, fontWeight: 800, fill: "var(--jl-ink-700)" }}
                        />
                      )}
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
