"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PrinterPageSkeleton } from "@/components/equipment/skeleton";
import { EquipmentErrorBoundary } from "@/components/equipment/error-boundary";
import { useHotkeys } from "@/lib/use-hotkey";
import { addRecentItem } from "@/lib/recently-viewed";
import { useRole } from "@/lib/use-role";
import { toast } from "sonner";
import {
  Save, Lock, AlertTriangle, BarChart2, Calendar, ClipboardCheck,
} from "lucide-react";
import Link from "next/link";
import { JlDate } from "@/components/ui/jl-date";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PrinterDimensions {
  serial_number: string;
  model: string | null;
  manufacturer: string | null;
  last_seen: string | null;
  color_capable: boolean | null;
  duplex_capable: boolean | null;
}

interface PrinterMapping {
  store: string | null;
  printer_type: string | null;
  model_name: string | null;
  reporting_enabled: boolean | null;
}

interface PrinterFeedback {
  condition: string | null;
  condition_notes: string | null;
  replace_flag: string | null;
  age: string | null;
  install_date: string | null;
  contract_end: string | null;
  technician_notes: string | null;
  last_visit: string | null;
}

interface MeterReading {
  report_date: string;
  total: number | null;
  black: number | null;
  colour: number | null;
  a3: number | null;
  large: number | null;
}

type CounterKey = "total" | "black" | "colour" | "a3" | "large";

const COUNTER_TYPES: { key: CounterKey; label: string }[] = [
  { key: "total", label: "Total" },
  { key: "black", label: "Black" },
  { key: "colour", label: "Colour" },
  { key: "a3", label: "A3" },
  { key: "large", label: "A3 Colour" },
];

// Condition choices - neutral segment; selected fills with its semantic colour.
const CONDITION_OPTIONS: { value: string; color: string }[] = [
  { value: "Good", color: "var(--green-500)" },
  { value: "Fair", color: "var(--amber-500)" },
  { value: "Poor", color: "var(--red-500)" },
];

// Replace recommendation - YES red / MAYBE amber / NO green.
const REPLACE_OPTIONS: { value: string; color: string; badge: string }[] = [
  { value: "YES", color: "var(--red-500)", badge: "jl-badge--red" },
  { value: "MAYBE", color: "var(--amber-500)", badge: "jl-badge--amber" },
  { value: "NO", color: "var(--green-500)", badge: "jl-badge--green" },
];

function num(v: number | null | undefined): number {
  return typeof v === "number" && isFinite(v) ? v : 0;
}

function fmtK(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
}

// ─── Read-only identity field ────────────────────────────────────────────────

function ReadField({ label, value, mono }: { label: string; value: string | null | boolean; mono?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="jl-eyebrow" style={{ fontSize: 11 }}>{label}</span>
      <span
        style={{
          fontSize: "var(--fs-sm)",
          fontWeight: 600,
          color: "var(--ink-800)",
          fontFamily: mono ? "var(--mono)" : "var(--font)",
        }}
      >
        {value === null || value === undefined || value === "" ? (
          <span className="jl-faint" style={{ fontWeight: 500, fontStyle: "italic" }}>Not set</span>
        ) : value === true ? (
          <span style={{ color: "var(--green-700)", fontWeight: 700 }}>Yes</span>
        ) : value === false ? (
          <span className="jl-muted" style={{ fontWeight: 500 }}>No</span>
        ) : (
          String(value)
        )}
      </span>
    </div>
  );
}

// ─── Section header with signature chip ──────────────────────────────────────

function SectionHead({ icon: Icon, title, neutral }: { icon: React.ElementType; title: string; neutral?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "var(--s-5)" }}>
      <span className={`jl-chip jl-chip--sm${neutral ? " jl-chip--neutral" : ""}`}>
        <Icon />
      </span>
      <span className="jl-h3">{title}</span>
    </div>
  );
}

export default function PrinterDetailPage() {
  const { serial } = useParams();
  const router = useRouter();
  const serialStr = decodeURIComponent(serial as string);

  const [dimensions, setDimensions] = useState<PrinterDimensions | null>(null);
  const [mapping, setMapping] = useState<PrinterMapping | null>(null);
  const [feedback, setFeedback] = useState<PrinterFeedback>({
    condition: null, condition_notes: null, replace_flag: null, age: null,
    install_date: null, contract_end: null, technician_notes: null, last_visit: null,
  });
  const [history, setHistory] = useState<MeterReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [counter, setCounter] = useState<CounterKey>("total");

  // Role flag from the authenticated session. While the session loads,
  // isAdmin is false so admin-only cards stay hidden (least-privileged default).
  const { isAdmin } = useRole();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/equipment/printers/${encodeURIComponent(serialStr)}`);
      if (!res.ok) { router.push("/equipment"); return; }
      const data = await res.json();
      setDimensions(data.dimensions);
      setMapping(data.mapping);
      if (data.feedback) {
        setFeedback((f) => ({ ...f, ...data.feedback }));
      }
      setHistory(data.history ?? []);
      const mn = data.mapping?.model_name ?? data.dimensions?.model ?? "Unknown Model";
      const sn2 = data.mapping?.store ?? "";
      addRecentItem({
        type: "printer",
        id: serialStr,
        label: mn,
        sub: sn2,
        href: `/equipment/printers/${encodeURIComponent(serialStr)}`,
      });
    } finally {
      setLoading(false);
    }
  }, [serialStr, router]);

  useEffect(() => { load(); }, [load]);

  const setF = (k: keyof PrinterFeedback, v: string | null) => {
    setFeedback((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/equipment/printers/${encodeURIComponent(serialStr)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feedback),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.feedback) setFeedback((f) => ({ ...f, ...data.feedback }));
      setDirty(false);
      toast.success("Printer record saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }, [serialStr, feedback]);

  // ─── Volume: per-counter monthly deltas ─────────────────────────────────────
  // history is DESC (newest first). Delta of a reading = itself minus the next
  // (older) reading for the same counter. Negative deltas (meter resets /
  // machine swaps) are clamped to zero.
  const chartData = useMemo(() => {
    const rows: { label: string; date: string; value: number }[] = [];
    for (let i = 0; i < history.length - 1; i++) {
      const curr = history[i];
      const prev = history[i + 1];
      const c = num(curr[counter]);
      const p = num(prev[counter]);
      const delta = Math.max(0, c - p);
      rows.push({
        label: new Date(curr.report_date).toLocaleDateString("en-ZA", { month: "short" }),
        date: curr.report_date,
        value: delta,
      });
    }
    // Oldest → newest for a left-to-right chart, capped to 6 months.
    return rows.slice(0, 6).reverse();
  }, [history, counter]);

  const hasCounterData = useMemo(
    () => chartData.some((d) => d.value > 0) || history.some((r) => num(r[counter]) > 0),
    [chartData, history, counter],
  );

  const contractExpired =
    !!feedback.contract_end && new Date(feedback.contract_end) < new Date();

  useHotkeys([
    { key: "s", modifiers: ["cmd"], onTrigger: () => { if (dirty) save(); } },
    { key: "Escape", onTrigger: () => {
      const store = mapping?.store;
      if (store) router.push(`/equipment/stores/${encodeURIComponent(store)}`);
      else router.push("/equipment");
    }},
  ]);

  if (loading) {
    return (
      <AppShell>
        <PrinterPageSkeleton />
      </AppShell>
    );
  }

  const storeName = mapping?.store ?? "";
  const modelName = mapping?.model_name ?? dimensions?.model ?? "Unknown Model";
  const replaceOpt = REPLACE_OPTIONS.find((o) => o.value === feedback.replace_flag);

  return (
    <AppShell>
      <EquipmentErrorBoundary>
        <div style={{ minHeight: "100vh", background: "var(--canvas)" }}>
          {/* Sticky Save bar */}
          <div
            style={{
              position: "sticky", top: 0, zIndex: 20,
              background: "var(--surface)", boxShadow: "var(--sh-sm)",
              padding: "0 var(--s-7)", height: 60,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}
          >
            <nav className="jl-breadcrumb">
              <Link href="/equipment">Stores</Link>
              {storeName && (
                <>
                  <span className="sep">/</span>
                  <Link href={`/equipment/stores/${encodeURIComponent(storeName)}`}>{storeName}</Link>
                </>
              )}
              <span className="sep">/</span>
              <span className="current jl-mono">{serialStr}</span>
              {dirty && (
                <span className="jl-badge jl-badge--amber" style={{ marginLeft: 8 }}>Unsaved changes</span>
              )}
            </nav>
            <button
              className="jl-btn jl-btn--primary"
              onClick={save}
              disabled={saving || !dirty}
              {...(saving ? { "data-loading": true } : {})}
            >
              <Save /> {saving ? "Saving" : "Save Changes"}
            </button>
          </div>

          {/* Content */}
          <div style={{ maxWidth: 980, margin: "0 auto", padding: "var(--s-7) var(--s-7) var(--s-9)", display: "grid", gap: "var(--s-6)" }}>

            {/* Hero */}
            <div>
              <h1 className="jl-h1">{modelName}</h1>
              <div style={{ display: "flex", gap: "var(--s-2)", marginTop: "var(--s-3)", flexWrap: "wrap", alignItems: "center" }}>
                <span className="jl-badge jl-badge--dark jl-mono">{serialStr}</span>
                {mapping?.printer_type && (
                  <span className="jl-badge">{mapping.printer_type}</span>
                )}
                {replaceOpt && (
                  <span className={`jl-badge ${replaceOpt.badge}`}>Replace: {replaceOpt.value}</span>
                )}
                {feedback.condition && (() => {
                  const c = CONDITION_OPTIONS.find((o) => o.value === feedback.condition);
                  const dotClass = c?.value === "Good" ? "jl-dot--green" : c?.value === "Fair" ? "jl-dot--amber" : "jl-dot--red";
                  return (
                    <span className="jl-badge">
                      <span className={`jl-dot ${dotClass}`} /> {feedback.condition}
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* Machine identity — READ ONLY, visually locked (sunken card) */}
            <section className="jl-card jl-card--pad-lg" style={{ background: "var(--surface-sunken)" }}>
              <SectionHead icon={Lock} title="Machine Identity" neutral />
              <div style={{ display: "grid", gap: "var(--s-5)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--s-5)" }}>
                  <ReadField label="Serial" value={dimensions?.serial_number ?? serialStr} mono />
                  <ReadField label="Model" value={modelName} />
                  <ReadField label="Store" value={storeName} />
                  <ReadField label="Type" value={mapping?.printer_type ?? null} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--s-5)" }}>
                  <ReadField label="Manufacturer" value={dimensions?.manufacturer ?? null} />
                  <ReadField label="Colour" value={dimensions?.color_capable ?? null} />
                  <ReadField label="Duplex" value={dimensions?.duplex_capable ?? null} />
                  <ReadField
                    label="Last Seen"
                    value={dimensions?.last_seen
                      ? new Date(dimensions.last_seen).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })
                      : null}
                  />
                </div>
              </div>
            </section>

            {/* Condition — editable, all users */}
            <section className="jl-card">
              <SectionHead icon={ClipboardCheck} title="Condition" />
              <div style={{ display: "grid", gap: "var(--s-5)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-5)" }}>
                  <div className="jl-field">
                    <label>Condition</label>
                    <div className="jl-segment">
                      {CONDITION_OPTIONS.map((opt) => {
                        const active = feedback.condition === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            aria-selected={active}
                            onClick={() => setF("condition", active ? null : opt.value)}
                            style={active ? { background: opt.color, color: "#fff", boxShadow: "var(--sh-sm)", flex: 1 } : { flex: 1 }}
                          >
                            {opt.value}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="jl-field">
                    <label>Replace Recommendation</label>
                    <div className="jl-segment">
                      {REPLACE_OPTIONS.map((opt) => {
                        const active = feedback.replace_flag === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            aria-selected={active}
                            onClick={() => setF("replace_flag", active ? null : opt.value)}
                            style={active ? { background: opt.color, color: "#fff", boxShadow: "var(--sh-sm)", flex: 1 } : { flex: 1 }}
                          >
                            {opt.value}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="jl-field">
                  <label>Notes</label>
                  <textarea
                    className="jl-textarea"
                    value={feedback.condition_notes ?? ""}
                    onChange={(e) => setF("condition_notes", e.target.value || null)}
                    placeholder="Faults, wear, paper feed issues, print quality"
                    rows={4}
                  />
                </div>
              </div>
            </section>

            {/* Contract & Lifecycle — admin only */}
            {isAdmin && (
              <section className="jl-card">
                <SectionHead icon={Calendar} title="Contract and Lifecycle" />
                <div style={{ display: "grid", gap: "var(--s-5)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--s-5)" }}>
                    <div className="jl-field">
                      <label>Install Date</label>
                      <JlDate value={feedback.install_date ?? null} onChange={(v) => setF("install_date", v)} placeholder="Select date" />
                    </div>
                    <div className="jl-field">
                      <label>Contract End</label>
                      <JlDate value={feedback.contract_end ?? null} onChange={(v) => setF("contract_end", v)} placeholder="Select date" />
                    </div>
                    <div className="jl-field">
                      <label>Last Visit</label>
                      <JlDate value={feedback.last_visit ?? null} onChange={(v) => setF("last_visit", v)} placeholder="Select date" />
                    </div>
                  </div>
                  {contractExpired && (
                    <div className="jl-alert jl-alert--amber">
                      <span className="jl-chip jl-chip--amber"><AlertTriangle /></span>
                      <div className="jl-alert__body">
                        <div className="jl-alert__title" style={{ color: "var(--amber-700)" }}>Contract expired</div>
                        <div className="jl-alert__text">
                          Ended {new Date(feedback.contract_end as string).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="jl-field">
                    <label>Technician Notes</label>
                    <textarea
                      className="jl-textarea"
                      value={feedback.technician_notes ?? ""}
                      onChange={(e) => setF("technician_notes", e.target.value || null)}
                      placeholder="Work done, parts replaced, recurring issues"
                      rows={3}
                    />
                  </div>
                </div>
              </section>
            )}

            {/* Volume History — recharts inside a card */}
            {history.length > 1 && (
              <section className="jl-card">
                <SectionHead icon={BarChart2} title="Volume History" />

                {/* Counter type selector */}
                <div className="jl-segment" style={{ marginBottom: "var(--s-5)", flexWrap: "wrap" }}>
                  {COUNTER_TYPES.map((ct) => (
                    <button
                      key={ct.key}
                      type="button"
                      aria-selected={counter === ct.key}
                      onClick={() => setCounter(ct.key)}
                    >
                      {ct.label}
                    </button>
                  ))}
                </div>

                {/* Chart */}
                {hasCounterData ? (
                  <div style={{ width: "100%", height: 220, marginBottom: "var(--s-6)" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--ink-100)" vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: "var(--ink-400)", fontFamily: "var(--font)" }}
                          axisLine={{ stroke: "var(--ink-200)" }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "var(--ink-400)", fontFamily: "var(--font)" }}
                          axisLine={false}
                          tickLine={false}
                          width={48}
                          tickFormatter={(v) => fmtK(Number(v))}
                        />
                        <Tooltip
                          cursor={{ fill: "var(--red-tint)" }}
                          formatter={(v) => [Number(v).toLocaleString(), "Prints"] as [string, string]}
                          contentStyle={{
                            background: "var(--surface)",
                            border: "none",
                            borderRadius: "var(--r-sm)",
                            boxShadow: "var(--sh-md)",
                            fontSize: 12,
                            fontFamily: "var(--font)",
                          }}
                          labelStyle={{ color: "var(--ink-500)", fontWeight: 700, fontSize: 11 }}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
                          {chartData.map((_, i) => (
                            <Cell
                              key={i}
                              fill={i === chartData.length - 1 ? "var(--red-500)" : "var(--ink-300)"}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div
                    style={{
                      height: 160, marginBottom: "var(--s-6)", display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center", gap: 8,
                      borderRadius: "var(--r-lg)", background: "var(--surface-sunken)",
                      boxShadow: "var(--sh-inset)",
                    }}
                  >
                    <BarChart2 size={22} style={{ color: "var(--ink-300)" }} />
                    <span className="jl-sm jl-muted" style={{ fontWeight: 600 }}>
                      No {COUNTER_TYPES.find((c) => c.key === counter)?.label} volume recorded
                    </span>
                  </div>
                )}

                {/* Reading table — last 8 readings, all counter columns */}
                <div className="jl-table-wrap">
                  <table className="jl-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th className="num">Total</th>
                        <th className="num">Black</th>
                        <th className="num">Colour</th>
                        <th className="num">A3</th>
                        <th className="num">A3 Colour</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.slice(0, 8).map((r, i) => (
                        <tr key={i}>
                          <td className="cell-strong">
                            {new Date(r.report_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "2-digit" })}
                          </td>
                          {[r.total, r.black, r.colour, r.a3, r.large].map((v, j) => (
                            <td key={j} className="num" style={v ? undefined : { color: "var(--ink-300)" }}>
                              {v != null ? v.toLocaleString() : "0"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        </div>
      </EquipmentErrorBoundary>
    </AppShell>
  );
}
