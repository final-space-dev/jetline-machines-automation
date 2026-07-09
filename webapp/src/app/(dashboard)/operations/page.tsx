"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useRole } from "@/lib/use-role";
import {
  RefreshCw, AlertTriangle, CheckCircle, XCircle, Clock,
  Wifi, WifiOff,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OpsData {
  fleet: { total: number; present: number; missing: number; neverSeen: number };
  mapping: { mapped: number; unmapped: number; reportingOff: number };
  staleness: { fresh: number; ok: number; stale: number; critical: number; never: number };
  alerts: Array<{
    type: string;
    serial_number: string;
    store: string | null;
    model: string;
    detail: string;
    days_since: number | null;
  }>;
  sync: {
    lastSuccess: string | null;
    lastFailed: string | null;
    recentSyncs: Array<{
      id: number;
      started_at: string;
      completed_at: string | null;
      status: string;
      company_id: string | null;
      triggered_by: string | null;
      machines_synced: number | null;
      error_detail: string | null;
    }>;
  };
  pipeline: { lastIngested: string | null; daysSinceIngestion: number | null };
  crossRef: { notInBms: number };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const d = daysSince(iso);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  return `${d}d ago`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "Not available";
  return new Date(iso).toLocaleString("en-ZA", { dateStyle: "short", timeStyle: "short" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ ok, okText, warnText, tone = "amber" }: {
  ok: boolean; okText: string; warnText: string; tone?: "amber" | "red";
}) {
  const cls = ok ? "jl-badge jl-badge--green" : `jl-badge jl-badge--${tone}`;
  return (
    <span className={cls}>
      {ok ? <Wifi /> : <WifiOff />}
      {ok ? okText : warnText}
    </span>
  );
}

function DetailRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--s-4)" }}>
      <span className="jl-sm jl-muted">{label}</span>
      <span className={`jl-sm ${valueClass ?? ""}`} style={{ fontWeight: "var(--fw-semibold)", textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

function AlertRow({ alert }: { alert: OpsData["alerts"][0] }) {
  const critical = alert.type === "critical" || alert.type === "never_reported";
  const label = alert.type === "critical" ? "Critical" : alert.type === "never_reported" ? "Never" : "Stale";
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: "var(--s-3)",
        padding: "var(--s-3) 0",
        borderBottom: "1px solid var(--ink-100)",
      }}
    >
      <span className={`jl-chip jl-chip--sm ${critical ? "" : "jl-chip--amber"}`}>
        {critical ? <XCircle /> : <AlertTriangle />}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)" }}>
          <span className="jl-mono jl-sm cell-strong" style={{ color: "var(--ink-900)", fontWeight: "var(--fw-bold)" }}>
            {alert.serial_number}
          </span>
          {alert.store && <span className="jl-xs jl-muted">{alert.store}</span>}
        </div>
        <p className="jl-xs jl-muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {alert.detail}
        </p>
      </div>
      <span className={`jl-badge ${critical ? "jl-badge--red" : "jl-badge--amber"}`}>{label}</span>
    </div>
  );
}

function SyncRow({ sync }: { sync: OpsData["sync"]["recentSyncs"][0] }) {
  const ok = sync.status === "success";
  const failed = sync.status === "failed";
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: "var(--s-3)",
        padding: "var(--s-3) 0",
        borderBottom: "1px solid var(--ink-100)",
      }}
    >
      <span className={`jl-dot ${ok ? "jl-dot--green" : failed ? "jl-dot--red" : "jl-dot--amber"}`} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="jl-sm" style={{ fontWeight: "var(--fw-semibold)" }}>
          {sync.company_id ?? "All companies"}
          {sync.triggered_by && (
            <span className="jl-muted" style={{ fontWeight: "var(--fw-regular)" }}> ({sync.triggered_by})</span>
          )}
        </div>
        {failed && sync.error_detail && (
          <p className="jl-xs" style={{ color: "var(--red-600)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={sync.error_detail}>
            {sync.error_detail.slice(0, 80)}{sync.error_detail.length > 80 ? "..." : ""}
          </p>
        )}
        {ok && sync.machines_synced != null && (
          <p className="jl-xs jl-muted">{sync.machines_synced} machines synced</p>
        )}
      </div>
      <span className="jl-xs jl-muted" style={{ whiteSpace: "nowrap" }}>{formatTime(sync.started_at)}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OperationsPage() {
  const { isAdmin } = useRole();
  const [data, setData] = useState<OpsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/operations");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const t = setInterval(() => fetchData(true), 300_000);
    return () => clearInterval(t);
  }, [fetchData]);

  if (loading) {
    return (
      <AppShell>
        <div style={{ display: "grid", placeItems: "center", height: 160 }}>
          <div className="jl-spinner jl-spinner--lg" />
        </div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell>
        <div className="jl-alert jl-alert--red">
          <span className="jl-chip"><XCircle /></span>
          <div className="jl-alert__body">
            <div className="jl-alert__title">Could not load operations data</div>
            <div className="jl-alert__text">{error ?? "No data returned from the server."}</div>
          </div>
          <button className="jl-btn jl-btn--soft jl-btn--sm" onClick={() => fetchData(false)}>
            <RefreshCw /> Retry
          </button>
        </div>
      </AppShell>
    );
  }

  const { fleet, mapping, staleness, alerts, sync, pipeline, crossRef } = data;
  const pipelineDays = pipeline.daysSinceIngestion;
  const pipelineOk = pipelineDays !== null && pipelineDays <= 1;
  const syncDays = daysSince(sync.lastSuccess);
  const syncOk = syncDays !== null && syncDays <= 1;
  const totalMachines = fleet.total;
  const reportingOk = staleness.fresh + staleness.ok;
  const reportingPct = totalMachines > 0 ? Math.round((reportingOk / totalMachines) * 100) : 0;

  const stalenessRows = [
    { label: "Fresh (3 days or less)", value: staleness.fresh, tone: "var(--green-500)" },
    { label: "OK (4 to 14 days)", value: staleness.ok, tone: "var(--blue-500)" },
    { label: "Stale (15 to 30 days)", value: staleness.stale, tone: "var(--amber-500)" },
    { label: "Critical (over 30 days)", value: staleness.critical, tone: "var(--red-500)" },
    { label: "Never", value: staleness.never, tone: "var(--ink-300)" },
  ];

  const kpis: { label: string; value: number | string; color: string }[] = [
    { label: "Total Fleet", value: totalMachines, color: "var(--ink-900)" },
    {
      label: "Reporting OK",
      value: `${reportingPct}%`,
      color: reportingPct >= 80 ? "var(--green-700)" : reportingPct >= 60 ? "var(--amber-700)" : "var(--red-600)",
    },
    {
      label: "Unmapped",
      value: mapping.unmapped,
      color: mapping.unmapped === 0 ? "var(--green-700)" : mapping.unmapped < 10 ? "var(--amber-700)" : "var(--red-600)",
    },
    {
      label: "Not in BMS",
      value: crossRef.notInBms,
      color: crossRef.notInBms === 0 ? "var(--green-700)" : "var(--amber-700)",
    },
  ];

  return (
    <AppShell>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-6)" }}>

        {/* Header */}
        <h1 className="jl-h1">Operations</h1>

        {/* ── Top KPI row ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "var(--s-4)" }}>
          {kpis.map((k) => (
            <div key={k.label} className="jl-kpi">
              <div className="jl-kpi__value" style={{ color: k.color }}>{k.value}</div>
              <div className="jl-kpi__label">{k.label}</div>
            </div>
          ))}
        </div>

        {/* ── Data pipeline + Sync health ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "var(--s-6)" }}>

          {/* Xerox Pipeline */}
          <div className="jl-card">
            <div className="jl-card__head">
              <div className="jl-card__title">Xerox Data Pipeline</div>
              <StatusPill ok={pipelineOk} okText="Live" warnText="Stale" tone="red" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
              <DetailRow label="Last ingestion" value={formatTime(pipeline.lastIngested)} />
              <DetailRow
                label="Days since last file"
                value={pipelineDays === null ? "Unknown" : pipelineDays === 0 ? "Today" : `${pipelineDays} days`}
              />
              <DetailRow label="Machines in Xerox DB" value={String(fleet.total)} />
            </div>
          </div>

          {/* BMS Sync */}
          <div className="jl-card">
            <div className="jl-card__head">
              <div className="jl-card__title">BMS Sync</div>
              <StatusPill ok={syncOk} okText="Current" warnText="Check needed" tone="amber" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)", marginBottom: "var(--s-5)" }}>
              <DetailRow label="Last successful full sync" value={timeAgo(sync.lastSuccess)} />
              <DetailRow label="Last sync time" value={formatTime(sync.lastSuccess)} />
            </div>
            <div className="jl-h3" style={{ marginBottom: "var(--s-3)" }}>Recent runs</div>
            <div>
              {sync.recentSyncs.length === 0 ? (
                <p className="jl-sm jl-muted" style={{ padding: "var(--s-3) 0" }}>No sync runs recorded yet.</p>
              ) : (
                sync.recentSyncs.slice(0, 5).map((s) => <SyncRow key={s.id} sync={s} />)
              )}
            </div>
          </div>
        </div>

        {/* ── Reading health + Alert feed ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "var(--s-6)" }}>

          {/* Reading health */}
          <div className="jl-card">
            <div className="jl-card__head">
              <div className="jl-card__title">Reading Health</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
              {stalenessRows.map(({ label, value, tone }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: "var(--s-3)" }}>
                  <span className="jl-xs jl-muted" style={{ width: 150, flex: "none" }}>{label}</span>
                  <div className="jl-progress" style={{ flex: 1 }}>
                    <div
                      className="jl-progress__bar"
                      style={{
                        width: totalMachines > 0 ? `${(value / totalMachines) * 100}%` : "0%",
                        background: tone,
                      }}
                    />
                  </div>
                  <span className="jl-sm" style={{ fontWeight: "var(--fw-bold)", width: 34, textAlign: "right", flex: "none" }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Alert feed */}
          <div className="jl-card">
            <div className="jl-card__head">
              <div className="jl-card__title">Alert Feed</div>
              {alerts.length > 0 && (
                <span className="jl-badge jl-badge--red">{alerts.length} alerts</span>
              )}
            </div>
            {alerts.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--s-2)", padding: "var(--s-6) 0" }}>
                <span className="jl-chip jl-chip--sm jl-chip--green"><CheckCircle /></span>
                <span className="jl-sm" style={{ color: "var(--green-700)", fontWeight: "var(--fw-semibold)" }}>
                  All machines reporting on time
                </span>
              </div>
            ) : (
              <div style={{ maxHeight: 320, overflowY: "auto" }}>
                {alerts.map((a, i) => <AlertRow key={`${a.serial_number}-${i}`} alert={a} />)}
              </div>
            )}
          </div>
        </div>

        {/* ── Recent sync runs table (admin only) ── */}
        {isAdmin && sync.recentSyncs.length > 0 && (
          <div>
            <h2 className="jl-h2" style={{ marginBottom: "var(--s-4)" }}>Recent Sync Runs</h2>
            <div className="jl-table-wrap" style={{ overflowX: "auto" }}>
              <table className="jl-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Status</th>
                    <th>Triggered by</th>
                    <th className="num">Machines</th>
                    <th>Started</th>
                  </tr>
                </thead>
                <tbody>
                  {sync.recentSyncs.map((s) => {
                    const ok = s.status === "success";
                    const failed = s.status === "failed";
                    return (
                      <tr key={s.id}>
                        <td className="cell-strong">{s.company_id ?? "All companies"}</td>
                        <td>
                          <span className={`jl-badge ${ok ? "jl-badge--green" : failed ? "jl-badge--red" : "jl-badge--amber"}`}>
                            {ok ? <CheckCircle /> : failed ? <XCircle /> : <Clock />}
                            {ok ? "Success" : failed ? "Failed" : "Running"}
                          </span>
                        </td>
                        <td>{s.triggered_by ?? "System"}</td>
                        <td className="num">{s.machines_synced ?? "n/a"}</td>
                        <td>{formatTime(s.started_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Xerox fleet breakdown — one stat per KPI card ── */}
        <div>
          <h2 className="jl-h2" style={{ marginBottom: "var(--s-4)" }}>Xerox Fleet Breakdown</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "var(--s-4)" }}>
            <div className="jl-kpi">
              <div className="jl-kpi__value" style={{ color: "var(--green-700)" }}>{fleet.present}</div>
              <div className="jl-kpi__label">Present on Xerox</div>
            </div>
            <div className="jl-kpi">
              <div className="jl-kpi__value" style={{ color: "var(--red-600)" }}>{fleet.missing}</div>
              <div className="jl-kpi__label">Missing from Xerox</div>
            </div>
            <div className="jl-kpi">
              <div className="jl-kpi__value" style={{ color: mapping.unmapped > 0 ? "var(--amber-700)" : "var(--green-700)" }}>
                {mapping.unmapped}
              </div>
              <div className="jl-kpi__label">Unmapped machines</div>
            </div>
            <div className="jl-kpi">
              <div className="jl-kpi__value" style={{ color: crossRef.notInBms > 0 ? "var(--amber-700)" : "var(--green-700)" }}>
                {crossRef.notInBms}
              </div>
              <div className="jl-kpi__label">Present, not in BMS</div>
            </div>
          </div>
        </div>

      </div>
    </AppShell>
  );
}
