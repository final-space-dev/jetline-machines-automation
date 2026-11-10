"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { TabStrip } from "@/components/machines/tab-strip";
import { DataTable, type Column } from "@/components/machines/data-table";
import { Empty } from "@/components/machines/empty";
import { Loading } from "@/components/machines/loading";
import { ConditionBar } from "@/components/machines/mix-bar";
import { Page } from "@/components/machines/page";
import { Muted, Panel } from "@/components/machines/panel";
import { CompletenessBadge } from "@/components/machines/status-badge";
import { TextLink } from "@/components/machines/text-link";
import { Tile, TileRow } from "@/components/machines/tile";
import { GRID, TYPE } from "@/lib/ui/ui-tokens";
import { cn } from "@/lib/ui/utils";
import { useAdminGuard } from "@/lib/use-admin-guard";
import { formatDate } from "@/lib/utils";

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

function fmtDate(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return formatDate(d);
}

const time = (v: string | null | undefined) => (v ? new Date(v).getTime() || 0 : 0);

/** Traffic-light status for a 0 to 1 store score. */
function scoreStatus(score: number): "danger" | "warning" | "success" {
  if (score < 0.6) return "danger";
  if (score < 0.85) return "warning";
  return "success";
}

// ─── Attention columns ───────────────────────────────────────────────────────

const equipmentColumns = (last: Column<EquipmentAttention>): Column<EquipmentAttention>[] => [
  { key: "store", label: "Store", sortValue: (r) => r.store, cell: (r) => <TextLink href={`/equipment/stores/${encodeURIComponent(r.store)}`}>{r.store}</TextLink> },
  { key: "machine_type", label: "Type", sortValue: (r) => r.machine_type ?? "", cell: (r) => <TextLink quiet href={`/equipment/items/${r.id}`}>{r.machine_type ?? "Equipment"}</TextLink> },
  { key: "make_model", label: "Model", hideBelow: "md", sortValue: (r) => r.make_model ?? "", cell: (r) => r.make_model ?? "" },
  { key: "condition", label: "Condition", hideBelow: "sm", sortValue: (r) => r.condition ?? "", cell: (r) => r.condition ?? "" },
  last,
];

const POOR_COLUMNS = equipmentColumns({
  key: "updated_at", label: "Updated", align: "right", hideBelow: "sm",
  sortValue: (r) => time(r.updated_at), cell: (r) => fmtDate(r.updated_at),
});

const OVERDUE_COLUMNS = equipmentColumns({
  key: "next_service_due", label: "Due", align: "right",
  sortValue: (r) => time(r.next_service_due), cell: (r) => <span className="font-semibold text-deficit">{fmtDate(r.next_service_due)}</span>,
});

const REPLACE_COLUMNS: Column<ReplaceRow>[] = [
  {
    key: "ref", label: "Item",
    sortValue: (r) => (r.kind === "printer" ? r.serial : r.machine_type ?? ""),
    cell: (r) =>
      r.kind === "printer" ? (
        <TextLink href={`/equipment/printers/${encodeURIComponent(r.serial)}`}>{r.serial}</TextLink>
      ) : (
        <TextLink href={`/equipment/items/${r.id}`}>{r.machine_type ?? "Equipment"}</TextLink>
      ),
  },
  { key: "kind", label: "Kind", hideBelow: "sm", sortValue: (r) => r.kind, cell: (r) => (r.kind === "printer" ? "Printer" : "Equipment") },
  {
    key: "store", label: "Store",
    sortValue: (r) => r.store ?? "",
    cell: (r) => (r.store ? <TextLink quiet href={`/equipment/stores/${encodeURIComponent(r.store)}`}>{r.store}</TextLink> : ""),
  },
  { key: "detail", label: "Detail", hideBelow: "md", cell: (r) => (r.kind === "printer" ? r.model ?? "" : r.make_model ?? "") },
];

const CONTRACT_COLUMNS: Column<PrinterAttention>[] = [
  { key: "serial", label: "Serial", sortValue: (r) => r.serial, cell: (r) => <TextLink href={`/equipment/printers/${encodeURIComponent(r.serial)}`}>{r.serial}</TextLink> },
  { key: "store", label: "Store", sortValue: (r) => r.store ?? "", cell: (r) => (r.store ? <TextLink quiet href={`/equipment/stores/${encodeURIComponent(r.store)}`}>{r.store}</TextLink> : "") },
  { key: "model", label: "Model", hideBelow: "md", sortValue: (r) => r.model ?? "", cell: (r) => r.model ?? "" },
  { key: "contract_end", label: "Contract end", hideBelow: "sm", sortValue: (r) => time(r.contract_end), cell: (r) => fmtDate(r.contract_end) },
  {
    key: "days_remaining", label: "Days left", align: "right",
    sortValue: (r) => r.days_remaining ?? 9999,
    cell: (r) => {
      const d = r.days_remaining ?? 0;
      return <span className={cn(GRID.num, "font-semibold", d <= 7 ? "text-deficit" : d <= 30 ? "text-foreground" : "text-muted-foreground")}>{d}</span>;
    },
  },
];

const STORE_COLUMNS: Column<StoreHealthRow>[] = [
  { key: "store", label: "Store", sortValue: (r) => r.store, cell: (r) => <TextLink href={`/equipment/stores/${encodeURIComponent(r.store)}`}>{r.store}</TextLink> },
  { key: "group", label: "Group", hideBelow: "md", sortValue: (r) => r.group ?? "", cell: (r) => <Muted>{r.group ?? ""}</Muted> },
  { key: "equipment", label: "Equipment", align: "right", hideBelow: "sm", sortValue: (r) => r.equipment, cell: (r) => <span className={cn(GRID.num, "font-medium")}>{r.equipment}</span> },
  { key: "poor", label: "Poor", align: "right", sortValue: (r) => r.poor, cell: (r) => <span className={cn(GRID.num, r.poor > 0 ? "font-semibold text-deficit" : "text-faint")}>{r.poor}</span> },
  { key: "printers", label: "Printers", align: "right", hideBelow: "sm", sortValue: (r) => r.printers, cell: (r) => <span className={GRID.num}>{r.printers}</span> },
  { key: "replace", label: "Replace", align: "right", hideBelow: "sm", sortValue: (r) => r.replace, cell: (r) => <span className={cn(GRID.num, r.replace > 0 ? "font-semibold" : "text-faint")}>{r.replace}</span> },
  { key: "score", label: "Score", align: "right", sortValue: (r) => r.score, cell: (r) => <Badge status={scoreStatus(r.score)}>{Math.round(r.score * 100)}%</Badge> },
  { key: "lastActivity", label: "Last activity", align: "right", hideBelow: "lg", sortValue: (r) => time(r.lastActivity), cell: (r) => <Muted>{fmtDate(r.lastActivity)}</Muted> },
];

const NOTHING = "Nothing needs attention here right now";

// ─── Completeness leaderboard (P19) ────────────────────────────────────────────

function LeaderRow({ rank, row }: { rank: number; row: DataQualityRow }) {
  return (
    <Link
      // The store's own page is the one that shows its completeness.
      href={`/equipment/stores/${encodeURIComponent(row.store)}`}
      className="flex items-center gap-3 rounded-lg px-2.5 py-2 outline-none hover:bg-muted focus-visible:bg-muted"
    >
      <span className={cn(TYPE.micro, "w-4 shrink-0 text-right font-semibold text-muted-foreground tabular-nums")}>{rank}</span>
      <span className={cn(TYPE.data, "min-w-0 flex-1 truncate font-medium")}>{row.store}</span>
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

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Panel caption="Most complete">
        {top5.map((r, i) => <LeaderRow key={r.store} rank={i + 1} row={r} />)}
      </Panel>
      <Panel caption="Least complete">
        {bottom5.map((r, i) => <LeaderRow key={r.store} rank={i + 1} row={r} />)}
      </Panel>
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
    // Only fetch once we've confirmed admin: the API 403s staff and the error
    // body would crash the breakdown render.
    if (!allowed) return;
    fetch("/api/equipment/fleet-health")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [allowed]);

  // P19 leaderboard source: single call, already sorted worst-first.
  useEffect(() => {
    let alive = true;
    fetch("/api/reports/data-quality")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: DataQualityRow[]) => { if (alive) setQuality(Array.isArray(d) ? d : []); })
      .catch(() => { /* leaderboard optional */ });
    return () => { alive = false; };
  }, []);

  // Block non-admins from the fleet render path entirely (they're being redirected).
  if (guardLoading || !allowed || loading) {
    return (
      <Page title="Fleet health">
        <Loading label={guardLoading || !allowed ? "Loading" : "Loading fleet health"} />
      </Page>
    );
  }

  if (!data) {
    return (
      <Page title="Fleet health">
        <Empty title="Could not load fleet health data" />
      </Page>
    );
  }

  const ai = data.attentionItems;
  const c = data.conditionBreakdown;
  const legend: [string, string, number][] = [
    ["bg-proven", "Good", c.good],
    ["bg-pending", "Fair", c.fair],
    ["bg-deficit", "Poor", c.poor],
    ["bg-track", "Unassessed", c.unknown],
  ];

  return (
    <Page title="Fleet health">
      <TileRow>
        <Tile label="Total equipment" value={data.kpi.total} />
        <Tile label="Poor condition" value={data.kpi.poor} tone={data.kpi.poor > 0 ? "danger" : "default"} />
        <Tile label="Service overdue" value={data.kpi.serviceOverdue} tone={data.kpi.serviceOverdue > 0 ? "danger" : "default"} />
        <Tile label="Replace flagged" value={data.kpi.replaceFlagged} tone={data.kpi.replaceFlagged > 0 ? "danger" : "default"} />
        <Tile label="Contracts expiring" value={data.kpi.contractsExpiring30d} tone={data.kpi.contractsExpiring30d > 0 ? "danger" : "default"} />
      </TileRow>

      <Panel caption="Condition breakdown" bodyClassName="flex flex-col gap-3">
        <ConditionBar good={c.good} fair={c.fair} poor={c.poor} unknown={c.unknown} className="h-3" />
        <div className="flex flex-wrap gap-x-5 gap-y-1.5">
          {legend.map(([swatch, label, n]) => (
            <span key={label} className={cn(TYPE.data, "inline-flex items-center gap-1.5")}>
              <span className={cn("size-2.5 rounded-sm", swatch)} />
              <span className="text-muted-foreground">{label}</span>
              <span className="font-semibold tabular-nums">{n}</span>
            </span>
          ))}
        </div>
      </Panel>

      <CompletenessLeaderboard rows={quality} />

      <Panel caption="Needs attention">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabStrip>
            <TabsTrigger value="poorCondition">Poor condition <Badge variant="secondary">{ai.poorCondition.length}</Badge></TabsTrigger>
            <TabsTrigger value="serviceOverdue">Service overdue <Badge variant="secondary">{ai.serviceOverdue.length}</Badge></TabsTrigger>
            <TabsTrigger value="replaceFlagged">Replace flagged <Badge variant="secondary">{ai.replaceFlagged.length}</Badge></TabsTrigger>
            <TabsTrigger value="contractsExpiring">Contracts expiring <Badge variant="secondary">{ai.contractsExpiring.length}</Badge></TabsTrigger>
          </TabStrip>
          <TabsContent value="poorCondition" className="pt-3">
            <DataTable columns={POOR_COLUMNS} rows={ai.poorCondition} rowKey={(r) => `eq-${r.id}`} empty={NOTHING} pageSize={25} card={false} />
          </TabsContent>
          <TabsContent value="serviceOverdue" className="pt-3">
            <DataTable columns={OVERDUE_COLUMNS} rows={ai.serviceOverdue} rowKey={(r) => `sv-${r.id}`} empty={NOTHING} pageSize={25} card={false} />
          </TabsContent>
          <TabsContent value="replaceFlagged" className="pt-3">
            <DataTable columns={REPLACE_COLUMNS} rows={ai.replaceFlagged} rowKey={(r) => (r.kind === "printer" ? `p-${r.serial}` : `e-${r.id}`)} empty={NOTHING} pageSize={25} card={false} />
          </TabsContent>
          <TabsContent value="contractsExpiring" className="pt-3">
            <DataTable columns={CONTRACT_COLUMNS} rows={ai.contractsExpiring} rowKey={(r) => `c-${r.serial}`} empty={NOTHING} pageSize={25} card={false} />
          </TabsContent>
        </Tabs>
      </Panel>

      <Panel caption="Store health">
        <DataTable columns={STORE_COLUMNS} rows={data.storeHealth} rowKey={(r) => r.store} card={false} />
      </Panel>
    </Page>
  );
}
