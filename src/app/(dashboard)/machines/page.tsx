"use client";

import { Suspense, useCallback, useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { DataTable } from "@/components/data-table/data-table";
import { createMachineColumns, type StoreOption } from "@/components/data-table/columns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageLoading } from "@/components/ui/page-loading";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { ColumnFiltersState } from "@tanstack/react-table";
import type { MachineWithRelations, MachineUtilization, MachineWithUtilization, MachineRate } from "@/types";

interface FilterOptions {
  companies: { value: string; label: string }[];
  categories: { value: string; label: string }[];
  models: { value: string; label: string }[];
  groups: { value: string; label: string }[];
  actions: { value: string; label: string }[];
}

function MachinesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeFilter = searchParams.get("store");

  const [machines, setMachines] = useState<MachineWithUtilization[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    companies: [],
    categories: [],
    models: [],
    groups: [],
    actions: [
      { value: "NONE", label: "None" },
      { value: "TERMINATE", label: "Terminate" },
      { value: "TERMINATE_UPGRADE", label: "Terminate & Upgrade" },
      { value: "STAY", label: "Stay" },
      { value: "MOVE", label: "Move" },
    ],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Add Machine dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addingMachine, setAddingMachine] = useState(false);
  const [newMachine, setNewMachine] = useState({
    serialNumber: "",
    companyId: "",
    categoryId: "",
    modelName: "",
  });

  // Escape key to close add bar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showAddDialog) {
        setShowAddDialog(false);
        setNewMachine({ serialNumber: "", companyId: "", categoryId: "", modelName: "" });
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showAddDialog]);

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

      const utilizationMap = new Map<string, MachineUtilization>();
      utilizationArray.forEach((u) => utilizationMap.set(u.machineId, u));

      const machinesWithUtilization: MachineWithUtilization[] = machinesArray.map((machine) => ({
        ...machine,
        utilization: utilizationMap.get(machine.id),
        currentRate: machine.rates?.[0],
      }));

      setMachines(machinesWithUtilization);
      setStores(companiesArray.map((c: { id: string; name: string }) => ({
        id: c.id,
        name: c.name,
      })));

      const modelSet = new Set<string>();
      machinesArray.forEach((m) => {
        if (m.modelName) modelSet.add(m.modelName);
      });
      const modelOptions = Array.from(modelSet)
        .sort()
        .map((name) => ({ value: name, label: name }));

      const groupSet = new Set<string>();
      machinesArray.forEach((m) => {
        const g = (m.company as { companyGroup?: string | null })?.companyGroup;
        if (g) groupSet.add(g);
      });
      const groupOptions = Array.from(groupSet).sort().map((g) => ({ value: g, label: g }));

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
        groups: groupOptions,
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
      toast.error("Failed to load machines data");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle action changes (saves immediately to DB)
  const handleActionChange = useCallback(async (machineId: string, action: string, extra?: Record<string, string>) => {
    try {
      if (action === "UPDATE_FIELD") {
        const field = Object.keys(extra || {})[0];
        const value = extra?.[field] || "";

        await fetch("/api/machines/action", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            machineId,
            [field]: value,
          }),
        });

        setMachines((prev) =>
          prev.map((m) =>
            m.id === machineId ? { ...m, [field]: value } : m
          )
        );
      } else {
        await fetch("/api/machines/action", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ machineId, action }),
        });

        setMachines((prev) =>
          prev.map((m) =>
            m.id === machineId
              ? {
                  ...m,
                  action: action as MachineWithUtilization["action"],
                  upgradeTo: action === "TERMINATE_UPGRADE" ? m.upgradeTo : null,
                  moveToCompanyId: action === "MOVE" ? m.moveToCompanyId : null,
                }
              : m
          )
        );
      }
    } catch (error) {
      console.error("Failed to update action:", error);
      toast.error("Failed to save action");
    }
  }, [machines]);

  // Bulk action handler
  const handleBulkAction = useCallback(async (selectedIds: string[], action: string) => {
    try {
      const res = await fetch("/api/machines/action", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineIds: selectedIds, action }),
      });

      if (!res.ok) {
        toast.error("Bulk action failed");
        return;
      }

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
      toast.error("Failed to update actions");
    }
  }, []);

  // Navigate to machine detail
  const handleNavigate = useCallback((machineId: string) => {
    router.push(`/machines/${machineId}`);
  }, [router]);

  // Add machine handler
  const handleAddMachine = useCallback(async () => {
    if (!newMachine.companyId) return;
    setAddingMachine(true);
    try {
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
        toast.error(err.error || "Failed to add machine");
        return;
      }

      const created = await res.json();

      await fetch("/api/machines/action", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineId: created.id, action: "STAY" }),
      });

      const newEntry: MachineWithUtilization = {
        ...created,
        action: "STAY" as const,
        upgradeTo: null,
        moveToCompanyId: null,
        notes: null,
        utilization: undefined,
        currentRate: undefined,
      };
      setMachines((prev) => [newEntry, ...prev]);
      setShowAddDialog(false);
      setNewMachine({ serialNumber: "", companyId: "", categoryId: "", modelName: "" });
      toast.success("Machine added successfully");
    } catch (error) {
      console.error("Failed to add machine:", error);
      toast.error("Failed to add machine");
    } finally {
      setAddingMachine(false);
    }
  }, [newMachine]);

  // Build unique model names list for the upgrade dropdown
  const modelNames = useMemo(() => {
    const set = new Set<string>();
    machines.forEach((m) => {
      if (m.modelName) set.add(m.modelName);
    });
    return Array.from(set).sort();
  }, [machines]);

  // Create columns
  const columns = useMemo(
    () => createMachineColumns(stores, modelNames, handleActionChange, handleNavigate),
    [stores, modelNames, handleActionChange, handleNavigate]
  );

  const totalMachines = machines.length;
  const uniqueStores = new Set(machines.map((m) => m.company.id)).size;

  // Action summary counts (must be before early return to satisfy hooks rules)
  const actionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    machines.forEach((m) => {
      const a = m.action || "NONE";
      counts[a] = (counts[a] || 0) + 1;
    });
    return counts;
  }, [machines]);

  if (isLoading) {
    return (
      <AppShell>
        <PageLoading variant="table" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Machines</h1>
            <span className="text-xs text-muted-foreground">
              {totalMachines} active · {uniqueStores} stores{storeFilter ? " · Filtered" : ""}
            </span>
          </div>
          <Button onClick={() => setShowAddDialog((v) => !v)} size="sm" variant={showAddDialog ? "secondary" : "outline"}>
            <Plus className="h-4 w-4 mr-1" />
            Add Machine
          </Button>
        </div>

        {/* Inline add machine bar */}
        {showAddDialog && (
          <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/30">
            <Select
              value={newMachine.companyId}
              onValueChange={(value) => setNewMachine((prev) => ({ ...prev, companyId: value }))}
            >
              <SelectTrigger className="h-8 w-[200px] text-xs">
                <SelectValue placeholder="Store *" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Serial (optional)"
              value={newMachine.serialNumber}
              onChange={(e) => setNewMachine((prev) => ({ ...prev, serialNumber: e.target.value }))}
              className="h-8 w-[180px] text-xs"
            />
            <Input
              placeholder="Model (optional)"
              value={newMachine.modelName}
              onChange={(e) => setNewMachine((prev) => ({ ...prev, modelName: e.target.value }))}
              className="h-8 w-[180px] text-xs"
            />
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={handleAddMachine}
              disabled={!newMachine.companyId || addingMachine}
            >
              {addingMachine ? "Adding..." : "Add"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={() => {
                setShowAddDialog(false);
                setNewMachine({ serialNumber: "", companyId: "", categoryId: "", modelName: "" });
              }}
            >
              Cancel
            </Button>
          </div>
        )}

        {/* Action summary pills (clickable to filter) */}
        <div className="flex items-center gap-2 text-[11px]">
          {([
            { key: "STAY", label: "Stay", bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-400" },
            { key: "TERMINATE", label: "Terminate", bg: "bg-red-50", text: "text-red-700", ring: "ring-red-400" },
            { key: "TERMINATE_UPGRADE", label: "Upgrade", bg: "bg-orange-50", text: "text-orange-700", ring: "ring-orange-400" },
            { key: "MOVE", label: "Move", bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-400" },
            { key: "NONE", label: "Unassigned", bg: "bg-muted", text: "text-muted-foreground", ring: "ring-gray-400" },
          ] as const).map(({ key, label, bg, text, ring }) => {
            if (!actionCounts[key]) return null;
            const actionFilter = columnFilters.find((f) => f.id === "action");
            const activeValues = (actionFilter?.value as string[] | undefined) ?? [];
            const isActive = activeValues.includes(key);
            return (
              <button
                key={key}
                onClick={() => {
                  setColumnFilters((prev) => {
                    const existing = prev.find((f) => f.id === "action");
                    const current = (existing?.value as string[] | undefined) ?? [];
                    const next = isActive ? current.filter((v) => v !== key) : [...current, key];
                    const without = prev.filter((f) => f.id !== "action");
                    return next.length > 0 ? [...without, { id: "action", value: next }] : without;
                  });
                }}
                className={`px-2 py-0.5 rounded-full font-medium transition-all cursor-pointer ${bg} ${text} ${isActive ? `ring-2 ${ring}` : "opacity-75 hover:opacity-100"}`}
              >
                {actionCounts[key]} {label}
              </button>
            );
          })}
          {columnFilters.some((f) => f.id === "action") && (
            <button
              onClick={() => setColumnFilters((prev) => prev.filter((f) => f.id !== "action"))}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        <DataTable
              columns={columns}
              data={machines}
              tableId="machines"
              searchPlaceholder="Search serial, model, store..."
              filterColumns={[
                {
                  key: "companyGroup",
                  label: "Group",
                  options: filterOptions.groups,
                },
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
              enableRowSelection
              externalColumnFilters={columnFilters}
              onExternalColumnFiltersChange={setColumnFilters}
              onBulkAction={handleBulkAction}
              bulkActions={[
                { value: "TERMINATE", label: "Set Terminate" },
                { value: "TERMINATE_UPGRADE", label: "Set Terminate & Upgrade" },
                { value: "STAY", label: "Set Stay" },
                { value: "MOVE", label: "Set Move" },
                { value: "NONE", label: "Clear Action" },
              ]}
              getRowClassName={(row: MachineWithUtilization) => {
                const a = row.action;
                if (a === "TERMINATE") return "bg-red-50/50";
                if (a === "TERMINATE_UPGRADE") return "bg-orange-50/50";
                if (a === "STAY") return "bg-emerald-50/40";
                if (a === "MOVE") return "bg-blue-50/50";
                return "";
              }}
            />

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
