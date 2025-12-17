"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { DataTable } from "@/components/data-table/data-table";
import { machineColumns } from "@/components/data-table/columns";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/utils";
import type { MachineWithRelations } from "@/types";

interface FilterOptions {
  companies: { value: string; label: string }[];
  categories: { value: string; label: string }[];
  statuses: { value: string; label: string }[];
}

function MachinesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeFilter = searchParams.get("store");

  const [machines, setMachines] = useState<MachineWithRelations[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    companies: [],
    categories: [],
    statuses: [
      { value: "ACTIVE", label: "Active" },
      { value: "INACTIVE", label: "Inactive" },
      { value: "MAINTENANCE", label: "Maintenance" },
      { value: "DECOMMISSIONED", label: "Decommissioned" },
    ],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [storeFilter]);

  const fetchData = async () => {
    try {
      const url = storeFilter
        ? `/api/machines?companyId=${storeFilter}`
        : "/api/machines";

      const [machinesRes, companiesRes, categoriesRes] = await Promise.all([
        fetch(url),
        fetch("/api/companies"),
        fetch("/api/categories"),
      ]);

      const machinesData = await machinesRes.json();
      const companiesData = await companiesRes.json();
      const categoriesData = await categoriesRes.json();

      setMachines(machinesData.data || []);
      setFilterOptions({
        companies: companiesData.map((c: { id: string; name: string }) => ({
          value: c.name,
          label: c.name,
        })),
        categories: categoriesData.map((c: { id: string; name: string }) => ({
          value: c.name,
          label: c.name,
        })),
        statuses: [
          { value: "ACTIVE", label: "Active" },
          { value: "INACTIVE", label: "Inactive" },
          { value: "MAINTENANCE", label: "Maintenance" },
          { value: "DECOMMISSIONED", label: "Decommissioned" },
        ],
      });
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRowClick = (machine: MachineWithRelations) => {
    router.push(`/machines/${machine.id}`);
  };

  // Calculate summary stats
  const totalMachines = machines.length;
  const activeMachines = machines.filter((m) => m.status === "ACTIVE").length;
  const totalBalance = machines.reduce((sum, m) => sum + m.currentBalance, 0);
  const uniqueStores = new Set(machines.map((m) => m.company.id)).size;

  if (isLoading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Machines</h1>
            <p className="text-xs text-muted-foreground">
              {totalMachines} total · {activeMachines} active · {uniqueStores} stores
              {storeFilter && " · Filtered"}
            </p>
          </div>
        </div>

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
              columns={machineColumns}
              data={machines}
              searchPlaceholder="Search serial, model, store..."
              filterColumns={[
                {
                  key: "company.name",
                  label: "Store",
                  options: filterOptions.companies,
                },
                {
                  key: "category.name",
                  label: "Category",
                  options: filterOptions.categories,
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
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
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
