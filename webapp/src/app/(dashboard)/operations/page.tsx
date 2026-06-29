"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, Clock, Wifi, WifiOff, GitMerge, Printer, Activity } from "lucide-react";

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
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-ZA", { dateStyle: "short", timeStyle: "short" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, color = "default", icon: Icon,
}: {
  label: string;
  value: number | string;
  sub?: string;
  color?: "default" | "green" | "amber" | "red" | "blue";
  icon: React.ElementType;
}) {
  const colors = {
    default: "bg-card border",
    green:   "bg-emerald-50 border-emerald-200",
    amber:   "bg-amber-50 border-amber-200",
    red:     "bg-red-50 border-red-200",
    blue:    "bg-blue-50 border-blue-200",
  };
  const iconColors = {
    default: "text-muted-foreground",
    green:   "text-emerald-600",
    amber:   "text-amber-600",
    red:     "text-red-600",
    blue:    "text-blue-600",
  };
  return (
    <div className={cn("rounded-lg border p-4 flex gap-3 items-start", colors[color])}>
      <div className={cn("mt-0.5 shrink-0", iconColors[color])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-2xl font-bold leading-none mt-1">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function AlertRow({ alert }: { alert: OpsData["alerts"][0] }) {
  const severity = alert.type === "critical" ? "red" : alert.type === "never_reported" ? "red" : "amber";
  const label = alert.type === "critical" ? "Critical" : alert.type === "never_reported" ? "Never" : "Stale";
  return (
    <div className="flex items-center gap-3 py-2.5 border-b last:border-0">
      <div className="shrink-0">
        {severity === "red"
          ? <XCircle className="h-4 w-4 text-red-500" />
          : <AlertTriangle className="h-4 w-4 text-amber-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs">{alert.serial_number}</span>
          {alert.store && <span className="text-xs text-muted-foreground">· {alert.store}</span>}
        </div>
        <p className="text-xs text-muted-foreground truncate">{alert.detail}</p>
      </div>
      <Badge className={cn(
        "shrink-0 text-[10px] border-0 font-medium",
        severity === "red" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
      )}>
        {label}
      </Badge>
    </div>
  );
}

function SyncRow({ sync }: { sync: OpsData["sync"]["recentSyncs"][0] }) {
  const ok = sync.status === "success";
  const failed = sync.status === "failed";
  return (
    <div className="flex items-center gap-3 py-2 border-b last:border-0 text-xs">
      <div className="shrink-0">
        {ok
          ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
          : failed
            ? <XCircle className="h-3.5 w-3.5 text-red-500" />
            : <Clock className="h-3.5 w-3.5 text-amber-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <span className="font-medium">{sync.company_id ?? "All companies"}</span>
        {sync.triggered_by && <span className="text-muted-foreground ml-1">· {sync.triggered_by}</span>}
        {failed && sync.error_detail && (
          <p className="text-red-600 truncate mt-0.5" title={sync.error_detail}>
            {sync.error_detail.slice(0, 80)}{sync.error_detail.length > 80 ? "…" : ""}
          </p>
        )}
        {ok && sync.machines_synced != null && (
          <p className="text-muted-foreground">{sync.machines_synced} machines synced</p>
        )}
      </div>
      <span className="text-muted-foreground shrink-0">{formatTime(sync.started_at)}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OperationsPage() {
  const [data, setData] = useState<OpsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/operations");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
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
        <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">Loading…</div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell>
        <div className="m-6 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error ?? "No data"}
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

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Operations</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Fleet health, sync status, and machine alerts — auto-refreshes every 5 minutes
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchData(true)} disabled={refreshing} className="h-8 gap-1.5 text-xs">
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {/* ── Top KPI row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Total Fleet" value={totalMachines}
            sub={`${fleet.present} on Xerox · ${fleet.missing} missing`}
            icon={Printer} color="blue"
          />
          <StatCard
            label="Reporting OK" value={`${reportingPct}%`}
            sub={`${reportingOk} of ${totalMachines} machines ≤14d`}
            icon={Activity}
            color={reportingPct >= 80 ? "green" : reportingPct >= 60 ? "amber" : "red"}
          />
          <StatCard
            label="Unmapped" value={mapping.unmapped}
            sub="No store or group assigned"
            icon={GitMerge}
            color={mapping.unmapped === 0 ? "green" : mapping.unmapped < 10 ? "amber" : "red"}
          />
          <StatCard
            label="Not in BMS" value={crossRef.notInBms}
            sub="Present on Xerox, missing from BMS"
            icon={WifiOff}
            color={crossRef.notInBms === 0 ? "green" : "amber"}
          />
        </div>

        {/* ── Data pipeline + Sync health ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Xerox Pipeline */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between mb-4">
              <SectionHeader
                title="Xerox Data Pipeline"
                sub="Last file ingested by Dagster"
              />
              <div className={cn(
                "flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full",
                pipelineOk ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
              )}>
                {pipelineOk ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {pipelineOk ? "Live" : "Stale"}
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground text-xs">Last ingestion</span>
                <span className="text-xs font-medium">{formatTime(pipeline.lastIngested)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-xs">Days since last file</span>
                <span className={cn("text-xs font-medium", pipelineOk ? "text-emerald-700" : "text-red-600")}>
                  {pipelineDays === null ? "Unknown" : pipelineDays === 0 ? "Today" : `${pipelineDays} days`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-xs">Machines in Xerox DB</span>
                <span className="text-xs font-medium">{fleet.total}</span>
              </div>
            </div>
          </div>

          {/* BMS Sync */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between mb-4">
              <SectionHeader
                title="BMS Sync"
                sub="Last machine registry sync"
              />
              <div className={cn(
                "flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full",
                syncOk ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
              )}>
                {syncOk ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                {syncOk ? "Current" : "Check needed"}
              </div>
            </div>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground text-xs">Last successful full sync</span>
                <span className="text-xs font-medium">{timeAgo(sync.lastSuccess)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-xs">Last sync time</span>
                <span className="text-xs font-medium">{formatTime(sync.lastSuccess)}</span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide mb-2">Recent runs</p>
            <div>
              {sync.recentSyncs.slice(0, 5).map((s) => <SyncRow key={s.id} sync={s} />)}
            </div>
          </div>
        </div>

        {/* ── Reading health + Alert feed ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Reading health */}
          <div className="rounded-lg border bg-card p-4">
            <SectionHeader title="Reading Health" sub="How recently machines sent data to Xerox" />
            <div className="space-y-2">
              {[
                { label: "Fresh (≤3 days)", value: staleness.fresh, color: "bg-emerald-500", total: totalMachines },
                { label: "OK (4–14 days)",  value: staleness.ok,    color: "bg-blue-400",    total: totalMachines },
                { label: "Stale (15–30d)",  value: staleness.stale, color: "bg-amber-400",   total: totalMachines },
                { label: "Critical (>30d)", value: staleness.critical, color: "bg-red-500",  total: totalMachines },
                { label: "Never",           value: staleness.never, color: "bg-slate-300",   total: totalMachines },
              ].map(({ label, value, color, total }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-32 shrink-0">{label}</span>
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className={cn("h-2 rounded-full transition-all", color)}
                      style={{ width: total > 0 ? `${(value / total) * 100}%` : "0%" }}
                    />
                  </div>
                  <span className="text-xs font-semibold w-8 text-right shrink-0">{value}</span>
                </div>
              ))}
            </div>

            {/* Mapping health */}
            <div className="mt-5 pt-4 border-t">
              <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide mb-3">Mapping</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-emerald-700">{mapping.mapped}</p>
                  <p className="text-[10px] text-muted-foreground">Mapped</p>
                </div>
                <div>
                  <p className={cn("text-lg font-bold", mapping.unmapped > 0 ? "text-amber-600" : "text-emerald-700")}>{mapping.unmapped}</p>
                  <p className="text-[10px] text-muted-foreground">Unmapped</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-500">{mapping.reportingOff}</p>
                  <p className="text-[10px] text-muted-foreground">Reporting Off</p>
                </div>
              </div>
            </div>
          </div>

          {/* Alert feed */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <SectionHeader
                title="Alert Feed"
                sub={`${alerts.length} machines need attention`}
              />
              {alerts.length > 0 && (
                <Badge className="bg-red-100 text-red-700 border-0 text-[10px]">
                  {alerts.length} alerts
                </Badge>
              )}
            </div>
            {alerts.length === 0 ? (
              <div className="flex items-center gap-2 py-6 justify-center text-sm text-emerald-700">
                <CheckCircle className="h-4 w-4" />
                All machines reporting on time
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                {alerts.map((a, i) => <AlertRow key={`${a.serial_number}-${i}`} alert={a} />)}
              </div>
            )}
          </div>
        </div>

        {/* ── Xerox fleet breakdown ── */}
        <div className="rounded-lg border bg-card p-4">
          <SectionHeader title="Xerox Fleet Breakdown" sub="Status of all machines in the Xerox database" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-700">{fleet.present}</p>
              <p className="text-xs text-muted-foreground">Present on Xerox</p>
              <p className="text-[10px] text-muted-foreground">(seen last 7 days)</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{fleet.missing}</p>
              <p className="text-xs text-muted-foreground">Missing from Xerox</p>
              <p className="text-[10px] text-muted-foreground">(not in latest file)</p>
            </div>
            <div className="text-center">
              <p className={cn("text-2xl font-bold", mapping.unmapped > 0 ? "text-amber-600" : "text-emerald-700")}>
                {mapping.unmapped}
              </p>
              <p className="text-xs text-muted-foreground">Unmapped machines</p>
              <p className="text-[10px] text-muted-foreground">(no store assigned)</p>
            </div>
            <div className="text-center">
              <p className={cn("text-2xl font-bold", crossRef.notInBms > 0 ? "text-amber-600" : "text-emerald-700")}>
                {crossRef.notInBms}
              </p>
              <p className="text-xs text-muted-foreground">Present, not in BMS</p>
              <p className="text-[10px] text-muted-foreground">(needs BMS entry)</p>
            </div>
          </div>
        </div>

      </div>
    </AppShell>
  );
}
