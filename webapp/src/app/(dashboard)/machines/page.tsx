"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { DataTable } from "@/components/data-table/data-table";
import { createMachineColumns, type StoreOption } from "@/components/data-table/columns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoading } from "@/components/ui/page-loading";
import { formatNumber, cn } from "@/lib/utils";
import { AlertTriangle, TrendingDown, CheckCircle, Zap, Target } from "lucide-react";
import type { MachineWithRelations, MachineUtilization, MachineWithUtilization, MachineRate } from "@/types";

interface FilterOptions {
  companies: { value: string; label: string }[];
  categories: { value: string; label: string }[];
  statuses: { value: string; label: string }[];
  utilizationStatuses: { value: string; label: string }[];
}

interface UtilizationSummary {
  total: number;
  critical: number;
  low: number;
  optimal: number;
  high: number;
  overworked: number;
  liftCandidates: number;
}

function MachinesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeFilter = searchParams.get("store");

  const [machines, setMachines] = useState<MachineWithUtilization[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [utilizationSummary, setUtilizationSummary] = useState<UtilizationSummary | null>(null);
  const [liftRefreshKey, setLiftRefreshKey] = useState(0);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    companies: [],
    categories: [],
    statuses: [
      { value: "ACTIVE", label: "Active" },
      { value: "INACTIVE", label: "Inactive" },
      { value: "MAINTENANCE", label: "Maintenance" },
      { value: "DECOMMISSIONED", label: "Decommissioned" },
    ],
    utilizationStatuses: [
      { value: "critical", label: "Critical (<20%)" },
      { value: "low", label: "Low (20-40%)" },
      { value: "optimal", label: "Optimal (40-80%)" },
      { value: "high", label: "High (80-100%)" },
      { value: "overworked", label: "Overworked (>100%)" },
    ],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [storeFilter]);

  const fetchData = async () => {
    try {
      const machineUrl = storeFilter
        ? `/api/machines?companyId=${storeFilter}&limit=10000&includeRates=true`
        : "/api/machines?limit=10000&includeRates=true";
      const utilizationUrl = storeFilter
        ? `/api/machines/utilization?companyId=${storeFilter}`
        : "/api/machines/utilization";

      const [machinesRes, utilizationRes, companiesRes, categoriesRes] = await Promise.all([
        fetch(machineUrl),
        fetch(utilizationUrl),
        fetch("/api/companies"),
        fetch("/api/categories"),
      ]);

      const machinesData = await machinesRes.json();
      const utilizationData = await utilizationRes.json();
      const companiesData = await companiesRes.json();
      const categoriesData = await categoriesRes.json();

      // Handle API error responses
      const companiesArray = Array.isArray(companiesData) ? companiesData : [];
      const categoriesArray = Array.isArray(categoriesData) ? categoriesData : [];
      const machinesArray: (MachineWithRelations & { rates?: MachineRate[] })[] = Array.isArray(machinesData?.data) ? machinesData.data : [];
      const utilizationArray: MachineUtilization[] = utilizationData?.machines || [];

      // Create a map of machine utilization by machineId
      const utilizationMap = new Map<string, MachineUtilization>();
      utilizationArray.forEach((u) => utilizationMap.set(u.machineId, u));

      // Merge utilization and rate data with machines
      const machinesWithUtilization: MachineWithUtilization[] = machinesArray.map((machine) => ({
        ...machine,
        utilization: utilizationMap.get(machine.id),
        currentRate: machine.rates?.[0], // Latest rate (already sorted by ratesFrom desc)
      }));

      setMachines(machinesWithUtilization);
      setUtilizationSummary(utilizationData?.summary || null);
      setStores(companiesArray.map((c: { id: string; name: string }) => ({
        id: c.id,
        name: c.name,
      })));
      setFilterOptions({
        companies: companiesArray.map((c: { id: string; name: string }) => ({
          value: c.name,
          label: c.name,
        })),
        categories: categoriesArray.map((c: { id: string; name: string }) => ({
          value: c.name,
          label: c.name,
        })),
        statuses: [
          { value: "ACTIVE", label: "Active" },
          { value: "INACTIVE", label: "Inactive" },
          { value: "MAINTENANCE", label: "Maintenance" },
          { value: "DECOMMISSIONED", label: "Decommissioned" },
        ],
        utilizationStatuses: [
          { value: "critical", label: "Critical (<20%)" },
          { value: "low", label: "Low (20-40%)" },
          { value: "optimal", label: "Optimal (40-80%)" },
          { value: "high", label: "High (80-100%)" },
          { value: "overworked", label: "Overworked (>100%)" },
        ],
      });
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRowClick = (machine: MachineWithUtilization) => {
    router.push(`/machines/${machine.id}`);
  };

  // Handle lift change - trigger re-render to update UI
  const handleLiftChange = (machineId: string, toStoreId: string | null) => {
    setLiftRefreshKey((k) => k + 1);
  };

  // Create columns with stores for inline lift dropdown
  const columns = useMemo(
    () => createMachineColumns(stores, handleLiftChange),
    [stores, liftRefreshKey]
  );

  // Calculate summary stats
  const totalMachines = machines.length;
  const activeMachines = machines.filter((m) => m.status === "ACTIVE").length;
  const totalBalance = machines.reduce((sum, m) => sum + m.currentBalance, 0);
  const uniqueStores = new Set(machines.map((m) => m.company.id)).size;

  if (isLoading) {
    return (
      <AppShell>
        <PageLoading variant="table" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          title="Machines"
          description={`${totalMachines} total · ${activeMachines} active · ${uniqueStores} stores${storeFilter ? " · Filtered" : ""}`}
        />

        {/* Utilization Summary Badges */}
        {utilizationSummary && (
          <div className="flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className={cn(
                "text-xs px-2 py-1 gap-1.5",
                utilizationSummary.critical > 0
                  ? "bg-red-50 text-red-700 border-red-200"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <AlertTriangle className="h-3 w-3" />
              {utilizationSummary.critical} Critical
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "text-xs px-2 py-1 gap-1.5",
                utilizationSummary.low > 0
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <TrendingDown className="h-3 w-3" />
              {utilizationSummary.low} Low
            </Badge>
            <Badge
              variant="outline"
              className="text-xs px-2 py-1 gap-1.5 bg-emerald-50 text-emerald-700 border-emerald-200"
            >
              <CheckCircle className="h-3 w-3" />
              {utilizationSummary.optimal} Optimal
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "text-xs px-2 py-1 gap-1.5",
                utilizationSummary.overworked > 0
                  ? "bg-purple-50 text-purple-700 border-purple-200"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Zap className="h-3 w-3" />
              {utilizationSummary.overworked} Overworked
            </Badge>
            {utilizationSummary.liftCandidates > 0 && (
              <Badge
                variant="outline"
                className="text-xs px-2 py-1 gap-1.5 bg-orange-50 text-orange-700 border-orange-200"
              >
                <Target className="h-3 w-3" />
                {utilizationSummary.liftCandidates} Lift Candidates
              </Badge>
            )}
          </div>
        )}

        {/* Summary Stats (inline) */}
        <div className="flex gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Total:</span>
            <span className="font-mono font-bold">{formatNumber(totalMachines)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-green-600">Active:</span>
            <span className="font-mono font-bold text-green-600">{formatNumber(activeMachines)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-yellow-600">Inactive:</span>
            <span className="font-mono font-bold text-yellow-600">{formatNumber(totalMachines - activeMachines)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Balance:</span>
            <span className="font-mono font-bold">{formatNumber(totalBalance)}</span>
          </div>
        </div>

        {/* Data Table */}
        <Card>
          <CardContent className="p-3">
            <DataTable
              columns={columns}
              data={machines}
              tableId="machines"
              searchPlaceholder="Search serial, model, store..."
              filterColumns={[
                {
                  key: "companyName",
                  label: "Store",
                  options: filterOptions.companies,
                },
                {
                  key: "categoryName",
                  label: "Category",
                  options: filterOptions.categories,
                },
                {
                  key: "utilizationPercent",
                  label: "Utilization",
                  options: filterOptions.utilizationStatuses,
                },
                {
                  key: "status",
                  label: "Status",
                  options: filterOptions.statuses,
                },
              ]}
              exportFileName="jetline-machines"
              pageSize={50}
              onRowClick={handleRowClick}
            />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function MachinesPageLoading() {
  return (
    <AppShell>
      <PageLoading variant="table" />
    </AppShell>
  );
}

export default function MachinesPage() {
  return (
    <Suspense fallback={<MachinesPageLoading />}>
      <MachinesPageContent />
    </Suspense>
  );
}
