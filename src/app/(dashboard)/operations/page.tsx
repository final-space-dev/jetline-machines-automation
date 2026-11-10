"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KeyValueList } from "@/components/ui/key-value-list";
import { Progress } from "@/components/ui/progress";
import { RequestsAttention } from "@/components/dashboard/requests-attention";
import { DataTable, type Column } from "@/components/machines/data-table";
import { Loading } from "@/components/machines/loading";
import { Page } from "@/components/machines/page";
import { Muted, Panel, SectionHeading } from "@/components/machines/panel";
import { Tile, TileRow } from "@/components/machines/tile";
import { GRID, TYPE } from "@/lib/ui/ui-tokens";
import { cn } from "@/lib/ui/utils";
import { useAdminGuard } from "@/lib/use-admin-guard";
import { useRole } from "@/lib/use-role";

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

type SyncRun = OpsData["sync"]["recentSyncs"][0];

function SyncBadge({ status }: { status: string }) {
  const ok = status === "success";
  const failed = status === "failed";
  return <Badge status={ok ? "success" : failed ? "danger" : "warning"}>{ok ? "Success" : failed ? "Failed" : "Running"}</Badge>;
}

function AlertRow({ alert }: { alert: OpsData["alerts"][0] }) {
  const critical = alert.type === "critical" || alert.type === "never_reported";
  const label = alert.type === "critical" ? "Critical" : alert.type === "never_reported" ? "Never" : "Stale";
  return (
    <div className="flex items-center gap-3 border-b border-border py-2.5 last:border-b-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-baseline gap-2">
          <span className={cn(TYPE.data, "font-semibold tabular-nums")}>{alert.serial_number}</span>
          {alert.store && <span className={cn(TYPE.micro, "text-muted-foreground")}>{alert.store}</span>}
        </span>
        <span className={cn(TYPE.micro, "truncate text-muted-foreground")}>{alert.detail}</span>
      </div>
      <Badge status={critical ? "danger" : "warning"}>{label}</Badge>
    </div>
  );
}

function SyncRow({ sync }: { sync: SyncRun }) {
  const ok = sync.status === "success";
  const failed = sync.status === "failed";
  return (
    <div className="flex items-center gap-3 border-b border-border py-2.5 last:border-b-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className={cn(TYPE.data, "font-medium")}>
          {sync.company_id ?? "All companies"}
          {sync.triggered_by && <span className="font-normal text-muted-foreground"> ({sync.triggered_by})</span>}
        </span>
        {failed && sync.error_detail && (
          <span className={cn(TYPE.micro, "truncate text-destructive")} title={sync.error_detail}>
            {sync.error_detail.slice(0, 80)}{sync.error_detail.length > 80 ? "..." : ""}
          </span>
        )}
        {ok && sync.machines_synced != null && <span className={cn(TYPE.micro, "text-muted-foreground")}>{sync.machines_synced} machines synced</span>}
      </div>
      <span className={cn(TYPE.micro, "whitespace-nowrap text-muted-foreground")}>{formatTime(sync.started_at)}</span>
      <SyncBadge status={sync.status} />
    </div>
  );
}

const SYNC_COLUMNS: Column<SyncRun>[] = [
  { key: "company", label: "Company", cell: (s) => <span className="font-medium">{s.company_id ?? "All companies"}</span> },
  { key: "status", label: "Status", cell: (s) => <SyncBadge status={s.status} /> },
  { key: "by", label: "Triggered by", hideBelow: "sm", cell: (s) => s.triggered_by ?? "System" },
  { key: "machines", label: "Machines", align: "right", hideBelow: "sm", cell: (s) => <span className={GRID.num}>{s.machines_synced ?? "n/a"}</span> },
  { key: "started", label: "Started", cell: (s) => formatTime(s.started_at) },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OperationsPage() {
  const { allowed, loading: guardLoading } = useAdminGuard("nav:operations");
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

  // Block non-admins from the render path (they're being redirected to their store).
  if (guardLoading || !allowed || loading) {
    return (
      <Page title="Operations">
        <Loading />
      </Page>
    );
  }

  if (error || !data) {
    return (
      <Page title="Operations">
        <Alert variant="destructive">
          <AlertTitle>Could not load operations data</AlertTitle>
          <AlertDescription>{error ?? "No data returned from the server."}</AlertDescription>
          <AlertAction>
            <Button variant="outline" size="sm" onClick={() => fetchData(false)}>
              <RefreshCw /> Retry
            </Button>
          </AlertAction>
        </Alert>
      </Page>
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

  const stalenessRows: { label: string; value: number; tone: "success" | "accent" | "warning" | "danger" }[] = [
    { label: "Fresh (3 days or less)", value: staleness.fresh, tone: "success" },
    { label: "OK (4 to 14 days)", value: staleness.ok, tone: "accent" },
    { label: "Stale (15 to 30 days)", value: staleness.stale, tone: "warning" },
    { label: "Critical (over 30 days)", value: staleness.critical, tone: "danger" },
    { label: "Never", value: staleness.never, tone: "warning" },
  ];

  return (
    <Page title="Operations">
      {/* Needs your attention: the response side of the store feedback loop.
          Renders only when there are open requests, so it never adds noise. */}
      <RequestsAttention />

      <TileRow>
        <Tile label="Total Fleet" value={totalMachines} />
        <Tile label="Reporting OK" value={`${reportingPct}%`} tone={reportingPct < 60 ? "danger" : "default"} />
        <Tile label="Unmapped" value={mapping.unmapped} tone={mapping.unmapped >= 10 ? "danger" : "default"} />
        <Tile label="Not in BMS" value={crossRef.notInBms} />
      </TileRow>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Panel caption="Xerox data pipeline" right={<Badge status={pipelineOk ? "success" : "danger"}>{pipelineOk ? "Live" : "Stale"}</Badge>}>
          <KeyValueList
            items={[
              { label: "Last ingestion", value: formatTime(pipeline.lastIngested) },
              { label: "Days since last file", value: pipelineDays === null ? "Unknown" : pipelineDays === 0 ? "Today" : `${pipelineDays} days` },
              { label: "Machines in Xerox DB", value: String(fleet.total) },
            ]}
          />
        </Panel>

        <Panel caption="BMS sync" right={<Badge status={syncOk ? "success" : "warning"}>{syncOk ? "Current" : "Check needed"}</Badge>} bodyClassName="flex flex-col gap-3">
          <KeyValueList
            items={[
              { label: "Last successful full sync", value: timeAgo(sync.lastSuccess) },
              { label: "Last sync time", value: formatTime(sync.lastSuccess) },
            ]}
          />
          <SectionHeading>Recent runs</SectionHeading>
          <div>
            {sync.recentSyncs.length === 0 ? <Muted>No sync runs recorded yet</Muted> : sync.recentSyncs.slice(0, 5).map((s) => <SyncRow key={s.id} sync={s} />)}
          </div>
        </Panel>

        <Panel caption="Reading health" bodyClassName="flex flex-col gap-3.5">
          {stalenessRows.map(({ label, value, tone }) => (
            <Progress key={label} label={label} value={value} max={Math.max(totalMachines, 1)} tone={tone} valueLabel={value} />
          ))}
        </Panel>

        <Panel caption="Alert feed" right={alerts.length > 0 && <Badge status="danger">{alerts.length} alerts</Badge>}>
          {alerts.length === 0 ? (
            <div className="flex justify-center py-6">
              <Badge status="success">All machines reporting on time</Badge>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {alerts.map((a, i) => <AlertRow key={`${a.serial_number}-${i}`} alert={a} />)}
            </div>
          )}
        </Panel>
      </div>

      {/* Recent sync runs: admin only. */}
      {isAdmin && sync.recentSyncs.length > 0 && (
        <Panel caption="Recent sync runs">
          <DataTable columns={SYNC_COLUMNS} rows={sync.recentSyncs} rowKey={(s) => s.id} card={false} />
        </Panel>
      )}

      <div className="flex flex-col gap-3">
        <SectionHeading>Xerox fleet breakdown</SectionHeading>
        <TileRow>
          <Tile label="Present on Xerox" value={fleet.present} />
          <Tile label="Missing from Xerox" value={fleet.missing} tone={fleet.missing > 0 ? "danger" : "default"} />
          <Tile label="Unmapped machines" value={mapping.unmapped} />
          <Tile label="Present, not in BMS" value={crossRef.notInBms} />
        </TileRow>
      </div>
    </Page>
  );
}
