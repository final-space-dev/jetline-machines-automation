"use client";

import { Suspense, useCallback, useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { DataTable } from "@/components/data-table/data-table";
import { createMachineColumns, type StoreOption } from "@/components/data-table/columns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoading } from "@/components/ui/page-loading";
import { formatNumber, cn } from "@/lib/utils";
import { AlertTriangle, TrendingDown, CheckCircle, Zap, Plus } from "lucide-react";
import type { MachineWithRelations, MachineUtilization, MachineWithUtilization, MachineRate } from "@/types";

interface FilterOptions {
  companies: { value: string; label: string }[];
  categories: { value: string; label: string }[];
  models: { value: string; label: string }[];
  actions: { value: string; label: string }[];
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
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [utilizationSummary, setUtilizationSummary] = useState<UtilizationSummary | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    companies: [],
    categories: [],
    models: [],
    actions: [
      { value: "NONE", label: "None" },
      { value: "TERMINATE", label: "Terminate" },
      { value: "TERMINATE_UPGRADE", label: "Terminate & Upgrade" },
      { value: "STAY", label: "Stay" },
      { value: "MOVE", label: "Move" },
    ],
  });
  const [isLoading, setIsLoading] = useState(true);

  // Add Machine dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addingMachine, setAddingMachine] = useState(false);
  const [newMachine, setNewMachine] = useState({
    serialNumber: "",
    companyId: "",
    categoryId: "",
    modelName: "",
  });

  useEffect(() => {
    fetchData();
  }, [storeFilter]);

  const fetchData = async () => {
    try {
      const machineUrl = storeFilter
        ? `/api/machines?companyId=${storeFilter}&limit=10000&includeRates=true&status=ACTIVE`
        : "/api/machines?limit=10000&includeRates=true&status=ACTIVE";
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
        currentRate: machine.rates?.[0],
      }));

      setMachines(machinesWithUtilization);
      setUtilizationSummary(utilizationData?.summary || null);
      setStores(companiesArray.map((c: { id: string; name: string }) => ({
        id: c.id,
        name: c.name,
      })));
      setCategories(categoriesArray.map((c: { id: string; name: string }) => ({
        id: c.id,
        name: c.name,
      })));

      // Build unique model list for filter
      const modelSet = new Set<string>();
      machinesArray.forEach((m) => {
        if (m.modelName) modelSet.add(m.modelName);
      });
      const modelOptions = Array.from(modelSet)
        .sort()
        .map((name) => ({ value: name, label: name }));

      setFilterOptions({
        companies: companiesArray.map((c: { id: string; name: string }) => ({
          value: c.name,
          label: c.name,
        })),
        categories: categoriesArray.map((c: { id: string; name: string }) => ({
          value: c.name,
          label: c.name,
        })),
        models: modelOptions,
        actions: [
          { value: "NONE", label: "None" },
          { value: "TERMINATE", label: "Terminate" },
          { value: "TERMINATE_UPGRADE", label: "Terminate & Upgrade" },
          { value: "STAY", label: "Stay" },
          { value: "MOVE", label: "Move" },
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

  // Handle action changes from the Action column
  const handleActionChange = useCallback(async (machineId: string, action: string, extra?: Record<string, string>) => {
    try {
      if (action === "UPDATE_FIELD") {
        // Update a specific field (upgradeTo or moveToCompanyId)
        const field = Object.keys(extra || {})[0];
        const value = extra?.[field] || "";

        await fetch("/api/machines/action", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            machineId,
            action: machines.find((m) => m.id === machineId)?.action || "NONE",
            [field]: value,
          }),
        });

        // Update local state
        setMachines((prev) =>
          prev.map((m) =>
            m.id === machineId ? { ...m, [field]: value } : m
          )
        );
      } else {
        // Update action
        await fetch("/api/machines/action", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ machineId, action }),
        });

        // Update local state
        setMachines((prev) =>
          prev.map((m) =>
            m.id === machineId
              ? {
                  ...m,
                  action: action as MachineWithUtilization["action"],
                  // Clear related fields when action changes
                  upgradeTo: action === "TERMINATE_UPGRADE" ? m.upgradeTo : null,
                  moveToCompanyId: action === "MOVE" ? m.moveToCompanyId : null,
                }
              : m
          )
        );
      }
    } catch (error) {
      console.error("Failed to update action:", error);
    }
  }, [machines]);

  // Bulk action handler
  const handleBulkAction = useCallback(async (selectedIds: string[], action: string) => {
    try {
      await fetch("/api/machines/action", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineIds: selectedIds, action }),
      });

      setMachines((prev) =>
        prev.map((m) =>
          selectedIds.includes(m.id)
            ? {
                ...m,
                action: action as MachineWithUtilization["action"],
                upgradeTo: action === "TERMINATE_UPGRADE" ? m.upgradeTo : null,
                moveToCompanyId: action === "MOVE" ? m.moveToCompanyId : null,
              }
            : m
        )
      );
    } catch (error) {
      console.error("Failed to bulk update actions:", error);
    }
  }, []);

  // Add machine handler
  const handleAddMachine = useCallback(async () => {
    if (!newMachine.companyId) return;
    setAddingMachine(true);
    try {
      // Serial is optional for planned machines - generate a placeholder if empty
      const serialNumber = newMachine.serialNumber.trim() || `PLANNED-${Date.now()}`;

      const res = await fetch("/api/machines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serialNumber,
          companyId: newMachine.companyId,
          categoryId: newMachine.categoryId || null,
          modelName: newMachine.modelName || null,
          status: "ACTIVE",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to add machine");
        return;
      }

      const created = await res.json();

      // Set action to STAY by default
      await fetch("/api/machines/action", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineId: created.id, action: "STAY" }),
      });

      // Add to local state
      const newEntry: MachineWithUtilization = {
        ...created,
        action: "STAY" as const,
        upgradeTo: null,
        moveToCompanyId: null,
        utilization: undefined,
        currentRate: undefined,
      };
      setMachines((prev) => [newEntry, ...prev]);
      setShowAddDialog(false);
      setNewMachine({ serialNumber: "", companyId: "", categoryId: "", modelName: "" });
    } catch (error) {
      console.error("Failed to add machine:", error);
      alert("Failed to add machine");
    } finally {
      setAddingMachine(false);
    }
  }, [newMachine]);

  // Compute which conditional columns to show based on current machine actions
  const conditionalColumns = useMemo(() => {
    const hasUpgrade = machines.some((m) => m.action === "TERMINATE_UPGRADE");
    const hasMove = machines.some((m) => m.action === "MOVE");
    const hasPlannedStore = machines.some((m) => m.action === "MOVE" && m.moveToCompanyId);
    return { showUpgradeTo: hasUpgrade, showMoveTo: hasMove, showPlannedStore: hasPlannedStore };
  }, [machines]);

  // Create columns with stores for action dropdowns
  const columns = useMemo(
    () => createMachineColumns(stores, handleActionChange, conditionalColumns),
    [stores, handleActionChange, conditionalColumns]
  );

  // Calculate summary stats
  const totalMachines = machines.length;
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
        <div className="flex items-center justify-between">
          <PageHeader
            title="Machines"
            description={`${totalMachines} active · ${uniqueStores} stores${storeFilter ? " · Filtered" : ""}`}
          />
          <Button onClick={() => setShowAddDialog(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add Machine
          </Button>
        </div>

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
          </div>
        )}

        {/* Summary Stats (inline) */}
        <div className="flex gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Total:</span>
            <span className="font-mono font-bold">{formatNumber(totalMachines)}</span>
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
                  key: "modelName",
                  label: "Model",
                  options: filterOptions.models,
                },
                {
                  key: "action",
                  label: "Action",
                  options: filterOptions.actions,
                },
              ]}
              exportFileName="jetline-machines"
              pageSize={99999}
              onRowClick={handleRowClick}
              enableRowSelection
              onBulkAction={handleBulkAction}
              bulkActions={[
                { value: "TERMINATE", label: "Set Terminate" },
                { value: "TERMINATE_UPGRADE", label: "Set Terminate & Upgrade" },
                { value: "STAY", label: "Set Stay" },
                { value: "MOVE", label: "Set Move" },
                { value: "NONE", label: "Clear Action" },
              ]}
            />
          </CardContent>
        </Card>
        {/* Add Machine Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Machine</DialogTitle>
              <DialogDescription>
                Add a planned machine. Leave serial blank for machines not yet received — it will sync automatically once a serial is captured and exists in BMS.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="add-serial">Serial Number (optional)</Label>
                <Input
                  id="add-serial"
                  placeholder="Leave blank for planned machines"
                  value={newMachine.serialNumber}
                  onChange={(e) => setNewMachine((prev) => ({ ...prev, serialNumber: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-store">Store *</Label>
                <Select
                  value={newMachine.companyId}
                  onValueChange={(value) => setNewMachine((prev) => ({ ...prev, companyId: value }))}
                >
                  <SelectTrigger id="add-store">
                    <SelectValue placeholder="Select store" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-category">Category</Label>
                <Select
                  value={newMachine.categoryId}
                  onValueChange={(value) => setNewMachine((prev) => ({ ...prev, categoryId: value }))}
                >
                  <SelectTrigger id="add-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-model">Model Name</Label>
                <Input
                  id="add-model"
                  placeholder="e.g., Xerox VersaLink C7025"
                  value={newMachine.modelName}
                  onChange={(e) => setNewMachine((prev) => ({ ...prev, modelName: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddMachine} disabled={!newMachine.companyId || addingMachine}>
                {addingMachine ? "Adding..." : "Add Machine"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
