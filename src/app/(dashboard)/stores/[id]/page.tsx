"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { KeyValueList } from "@/components/ui/key-value-list";
import { Progress } from "@/components/ui/progress";
import { Tooltip } from "@/components/ui/tooltip";
import { DataTable, type Column } from "@/components/machines/data-table";
import { Empty } from "@/components/machines/empty";
import { LinkButton } from "@/components/machines/link-button";
import { Loading } from "@/components/machines/loading";
import { Page } from "@/components/machines/page";
import { Muted, Panel } from "@/components/machines/panel";
import { ReadField } from "@/components/machines/read-field";
import { UTILIZATION, UtilizationBadge, type UtilizationStatus } from "@/components/machines/status-badge";
import { GRID } from "@/lib/ui/ui-tokens";
import { formatDate, formatNumber } from "@/lib/utils";
import type { MachineUtilization, MachineWithRelations } from "@/types";

interface MachineWithUtil extends MachineWithRelations {
  utilization?: MachineUtilization;
}

interface StoreDetail {
  id: string;
  name: string;
  region: string | null;
  bmsSchema: string;
  bmsHost: string | null;
  isActive: boolean;
  createdAt: string;
  machines: MachineWithUtil[];
}

interface UtilizationSummary {
  total: number;
  critical: number;
  low: number;
  optimal: number;
  high: number;
  overworked: number;
  liftCandidates: number;
  avgUtilization: number;
}

const MACHINE_STATUS: Record<string, "success" | "neutral" | "info" | "danger"> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  MAINTENANCE: "info",
  DECOMMISSIONED: "danger",
};

const TREND = { up: "rising", down: "falling", stable: "steady" } as const;

const MACHINE_COLUMNS: Column<MachineWithUtil>[] = [
  { key: "serial", label: "Serial", sortValue: (m) => m.serialNumber, cell: (m) => <span className="tabular-nums">{m.serialNumber}</span> },
  { key: "model", label: "Model", hideBelow: "sm", sortValue: (m) => m.modelName ?? "", cell: (m) => m.modelName || "-" },
  {
    key: "utilization",
    label: "Utilization",
    sortValue: (m) => m.utilization?.utilizationPercent ?? -1,
    cell: (m) => {
      const util = m.utilization;
      if (!util) return <Muted>—</Muted>;
      return (
        <span className="inline-flex items-center gap-2" title={`Avg ${formatNumber(util.avgMonthlyVolume)} a month · Duty ${formatNumber(util.dutyCycle)} · ${TREND[util.trendDirection as keyof typeof TREND] ?? ""}`}>
          <UtilizationBadge percent={util.utilizationPercent} status={util.utilizationStatus as UtilizationStatus} />
        </span>
      );
    },
  },
  {
    key: "lift",
    label: "Lift",
    hideBelow: "md",
    sortValue: (m) => m.utilization?.liftScore ?? -1,
    cell: (m) => {
      const util = m.utilization;
      if (!util || util.liftScore < 60) return <Muted>—</Muted>;
      return (
        <Tooltip content={[`Lift score ${util.liftScore} of 100`, ...util.insights.slice(0, 2)].join(". ")}>
          <Badge status={util.liftScore >= 80 ? "danger" : "warning"}>
            <Target /> {util.liftScore}
          </Badge>
        </Tooltip>
      );
    },
  },
  { key: "balance", label: "Balance", align: "right", hideBelow: "sm", sortValue: (m) => m.currentBalance || 0, cell: (m) => <span className={GRID.num}>{formatNumber(m.currentBalance)}</span> },
  { key: "status", label: "Status", sortValue: (m) => m.status, cell: (m) => <Badge status={MACHINE_STATUS[m.status] ?? "neutral"}>{m.status}</Badge> },
];

export default function StoreDetailPage() {
  const params = useParams();
  const storeId = params.id as string;

  const [store, setStore] = useState<StoreDetail | null>(null);
  const [utilizationSummary, setUtilizationSummary] = useState<UtilizationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStoreData();
  }, [storeId]);

  const fetchStoreData = async () => {
    try {
      const [companyRes, machinesRes, utilizationRes] = await Promise.all([
        fetch(`/api/companies/${storeId}`),
        fetch(`/api/machines?companyId=${storeId}&limit=10000`),
        fetch(`/api/machines/utilization?companyId=${storeId}`),
      ]);

      const companyData = await companyRes.json();
      const machinesData = await machinesRes.json();
      const utilizationData = await utilizationRes.json();

      // Handle API error responses
      const machinesArray: MachineWithRelations[] = Array.isArray(machinesData?.data) ? machinesData.data : [];
      const utilizationArray: MachineUtilization[] = utilizationData?.machines || [];

      // Create a map of machine utilization by machineId
      const utilizationMap = new Map<string, MachineUtilization>();
      utilizationArray.forEach((u) => utilizationMap.set(u.machineId, u));

      // Merge utilization data with machines
      const machinesWithUtil: MachineWithUtil[] = machinesArray.map((machine) => ({
        ...machine,
        utilization: utilizationMap.get(machine.id),
      }));

      if (companyData?.id) {
        setStore({
          id: companyData.id,
          name: companyData.name,
          region: companyData.region,
          bmsSchema: companyData.bmsSchema,
          bmsHost: companyData.bmsHost,
          isActive: companyData.isActive,
          createdAt: companyData.createdAt,
          machines: machinesWithUtil,
        });

        // Calculate utilization summary
        const machinesWithUtilData = machinesWithUtil.filter((m) => m.utilization);
        if (machinesWithUtilData.length > 0) {
          const critical = machinesWithUtilData.filter((m) => m.utilization?.utilizationStatus === "critical").length;
          const low = machinesWithUtilData.filter((m) => m.utilization?.utilizationStatus === "low").length;
          const optimal = machinesWithUtilData.filter((m) => m.utilization?.utilizationStatus === "optimal").length;
          const high = machinesWithUtilData.filter((m) => m.utilization?.utilizationStatus === "high").length;
          const overworked = machinesWithUtilData.filter((m) => m.utilization?.utilizationStatus === "overworked").length;
          const liftCandidates = machinesWithUtilData.filter((m) => m.utilization && m.utilization.liftScore >= 70).length;
          const avgUtilization = Math.round(
            machinesWithUtilData.reduce((sum, m) => sum + (m.utilization?.utilizationPercent || 0), 0) / machinesWithUtilData.length
          );

          setUtilizationSummary({
            total: machinesWithUtilData.length,
            critical,
            low,
            optimal,
            high,
            overworked,
            liftCandidates,
            avgUtilization,
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch store data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return <Loading />;

  if (!store) {
    return (
      <Page title="Store not found">
        <Empty title="This store does not exist or has been removed" />
        <div className="flex justify-center">
          <LinkButton href="/stores">Back to Stores</LinkButton>
        </div>
      </Page>
    );
  }

  const activeMachines = store.machines.filter((m) => m.status === "ACTIVE").length;
  const totalBalance = store.machines.reduce((sum, m) => sum + (m.currentBalance || 0), 0);
  const byCategory = Object.entries(
    store.machines.reduce((acc, m) => {
      const cat = m.category?.name || "Uncategorized";
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  );
  const avg = utilizationSummary?.avgUtilization ?? 0;

  return (
    <Page
      title={store.name}
      titleExtra={
        <>
          <Badge status={store.isActive ? "success" : "neutral"}>{store.isActive ? "Active" : "Inactive"}</Badge>
          {utilizationSummary && <Badge status={avg < 40 ? "warning" : avg <= 80 ? "success" : "info"}>{avg}% Avg Util</Badge>}
        </>
      }
      subtitle={`${store.machines.length} machines · ${activeMachines} active · ${formatNumber(totalBalance)} total balance`}
      crumbs={[{ label: "Stores", href: "/stores" }, { label: store.name }]}
    >
      {utilizationSummary && (
        <div className="flex flex-wrap gap-2">
          {utilizationSummary.critical > 0 && <Badge status="danger">{utilizationSummary.critical} Critical</Badge>}
          {utilizationSummary.low > 0 && <Badge status="warning">{utilizationSummary.low} Low</Badge>}
          <Badge status="success">{utilizationSummary.optimal} Optimal</Badge>
          {utilizationSummary.overworked > 0 && <Badge status="elim">{utilizationSummary.overworked} Overworked</Badge>}
          {utilizationSummary.liftCandidates > 0 && (
            <Badge status="warning">
              <Target /> {utilizationSummary.liftCandidates} Lift Candidates
            </Badge>
          )}
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
          <Panel caption="Store information">
            <div className="grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-3">
              <ReadField label="Store Name" value={store.name} />
              <ReadField label="Region" value={store.region || "-"} />
              <ReadField label="BMS Schema" value={store.bmsSchema} />
              <ReadField label="BMS Host" value={store.bmsHost || "default"} />
              <ReadField label="Status" value={store.isActive ? "Active" : "Inactive"} />
              <ReadField label="Created" value={formatDate(store.createdAt)} />
            </div>
          </Panel>

          <Panel caption={`Machines (${store.machines.length})`}>
            <DataTable
              columns={MACHINE_COLUMNS}
              rows={store.machines}
              rowKey={(m) => m.id}
              rowClassName={(m) => (m.utilization?.utilizationStatus === "critical" || (m.utilization && m.utilization.liftScore >= 80) ? "bg-muted" : undefined)}
              empty="No machines in this store"
              pageSize={50}
              card={false}
            />
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Panel caption="Summary">
            <KeyValueList
              items={[
                { label: "Total Machines", value: store.machines.length },
                { label: "Active", value: activeMachines, tone: "good" },
                { label: "Inactive", value: store.machines.length - activeMachines },
                { label: "Total Balance", value: formatNumber(totalBalance) },
              ]}
            />
          </Panel>

          {utilizationSummary && (
            <Panel caption="Utilization overview" bodyClassName="flex flex-col gap-3">
              <Progress label="Avg Utilization" value={Math.min(avg, 100)} valueLabel={`${avg}%`} tone={avg < 40 ? "warning" : avg <= 80 ? "success" : "accent"} />
              <KeyValueList
                items={[
                  ...(["critical", "low", "optimal", "high", "overworked"] as const).map((band) => ({
                    label: UTILIZATION[band].label,
                    value: utilizationSummary[band],
                    tone: band === "critical" && utilizationSummary.critical > 0 ? ("bad" as const) : undefined,
                  })),
                  ...(utilizationSummary.liftCandidates > 0 ? [{ label: "Lift Candidates", value: utilizationSummary.liftCandidates }] : []),
                ]}
              />
            </Panel>
          )}

          <Panel caption="By category">
            <KeyValueList items={byCategory.map(([category, count]) => ({ label: category, value: count }))} />
          </Panel>
        </div>
      </div>
    </Page>
  );
}
