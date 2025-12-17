"use client";

import { useEffect, useState, useMemo } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowRight,
  Search,
  Download,
  FileSpreadsheet,
  Trash2,
  X,
} from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { exportToExcel, exportToCSV } from "@/lib/export";
import type { MachineWithRelations } from "@/types";

interface Store {
  id: string;
  name: string;
  region: string | null;
}

interface PlannedMove {
  id: string;
  machine: MachineWithRelations;
  fromStore: Store;
  toStore: Store;
}

// Generate consistent color for model names
const modelColors: Record<string, string> = {};
const colorPalette = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-amber-500",
  "bg-lime-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-fuchsia-500",
  "bg-sky-500",
];

function getModelColor(modelName: string): string {
  if (!modelName) return "bg-gray-400";
  if (!modelColors[modelName]) {
    const index = Object.keys(modelColors).length % colorPalette.length;
    modelColors[modelName] = colorPalette[index];
  }
  return modelColors[modelName];
}

export default function LiftPlannerPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [machines, setMachines] = useState<MachineWithRelations[]>([]);
  const [plannedMoves, setPlannedMoves] = useState<PlannedMove[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [draggedMachine, setDraggedMachine] = useState<MachineWithRelations | null>(null);
  const [draggedFromStore, setDraggedFromStore] = useState<Store | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [companiesRes, machinesRes] = await Promise.all([
        fetch("/api/companies"),
        fetch("/api/machines?limit=10000"),
      ]);

      const companiesData = await companiesRes.json();
      const machinesData = await machinesRes.json();

      setStores(
        companiesData.map((c: any) => ({
          id: c.id,
          name: c.name,
          region: c.region,
        }))
      );
      setMachines(machinesData.data || []);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get unique models for legend
  const uniqueModels = useMemo(() => {
    const models = new Set<string>();
    machines.forEach((m) => {
      if (m.modelName) models.add(m.modelName);
    });
    return Array.from(models).sort();
  }, [machines]);

  // Apply planned moves to get current state
  const machinesByStore = useMemo(() => {
    const byStore = new Map<string, MachineWithRelations[]>();
    stores.forEach((store) => byStore.set(store.id, []));

    machines.forEach((machine) => {
      const move = plannedMoves.find((m) => m.machine.id === machine.id);
      const effectiveStoreId = move ? move.toStore.id : machine.companyId;
      const storeMachines = byStore.get(effectiveStoreId) || [];
      storeMachines.push(machine);
      byStore.set(effectiveStoreId, storeMachines);
    });

    return byStore;
  }, [stores, machines, plannedMoves]);

  // Filter stores based on search
  const filteredStores = useMemo(() => {
    if (!searchQuery) return stores;
    const q = searchQuery.toLowerCase();
    return stores.filter((store) => {
      if (store.name.toLowerCase().includes(q)) return true;
      const storeMachines = machinesByStore.get(store.id) || [];
      return storeMachines.some(
        (m) =>
          m.serialNumber?.toLowerCase().includes(q) ||
          m.modelName?.toLowerCase().includes(q)
      );
    });
  }, [stores, searchQuery, machinesByStore]);

  // Calculate planned moves stats
  const moveStats = useMemo(() => {
    const totalBalance = plannedMoves.reduce(
      (sum, m) => sum + (m.machine.currentBalance || 0),
      0
    );
    return { totalBalance };
  }, [plannedMoves]);

  const handleDragStart = (machine: MachineWithRelations, fromStore: Store) => {
    setDraggedMachine(machine);
    setDraggedFromStore(fromStore);
  };

  const handleDragEnd = () => {
    setDraggedMachine(null);
    setDraggedFromStore(null);
  };

  const handleDrop = (toStore: Store) => {
    if (!draggedMachine || !draggedFromStore) return;
    if (draggedFromStore.id === toStore.id) return;

    const existingMoveIndex = plannedMoves.findIndex(
      (m) => m.machine.id === draggedMachine.id
    );

    const originalStoreId = draggedMachine.companyId;
    const originalStore = stores.find((s) => s.id === originalStoreId);

    if (toStore.id === originalStoreId && existingMoveIndex !== -1) {
      setPlannedMoves((prev) => prev.filter((_, i) => i !== existingMoveIndex));
    } else if (existingMoveIndex !== -1) {
      setPlannedMoves((prev) =>
        prev.map((m, i) => (i === existingMoveIndex ? { ...m, toStore } : m))
      );
    } else if (originalStore) {
      setPlannedMoves((prev) => [
        ...prev,
        {
          id: `move-${Date.now()}-${draggedMachine.id}`,
          machine: draggedMachine,
          fromStore: originalStore,
          toStore,
        },
      ]);
    }

    handleDragEnd();
  };

  const handleRemoveMove = (moveId: string) => {
    setPlannedMoves((prev) => prev.filter((m) => m.id !== moveId));
  };

  const handleClearAllMoves = () => {
    setPlannedMoves([]);
  };

  const handleExportExcel = () => {
    if (plannedMoves.length === 0) return;
    exportToExcel(
      plannedMoves,
      [
        { key: "machine.serialNumber", header: "Serial Number" },
        { key: "machine.modelName", header: "Model" },
        { key: "machine.currentBalance", header: "Balance" },
        { key: "fromStore.name", header: "From Store" },
        { key: "toStore.name", header: "To Store" },
      ],
      "move-plan"
    );
    setShowExportDialog(false);
  };

  const handleExportCSV = () => {
    if (plannedMoves.length === 0) return;
    exportToCSV(
      plannedMoves,
      [
        { key: "machine.serialNumber", header: "Serial Number" },
        { key: "machine.modelName", header: "Model" },
        { key: "machine.currentBalance", header: "Balance" },
        { key: "fromStore.name", header: "From Store" },
        { key: "toStore.name", header: "To Store" },
      ],
      "move-plan"
    );
    setShowExportDialog(false);
  };

  const isMachineMoved = (machineId: string): boolean => {
    return plannedMoves.some((m) => m.machine.id === machineId);
  };

  const getOriginalStore = (machineId: string): Store | null => {
    const move = plannedMoves.find((m) => m.machine.id === machineId);
    return move?.fromStore || null;
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-[500px]" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-lg font-bold">Lift Planner</h1>
            <p className="text-[10px] text-muted-foreground">
              Drag machines between stores. Download plan when ready.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {plannedMoves.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {plannedMoves.length} moves · {formatNumber(moveStats.totalBalance)} bal
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px] px-2"
              disabled={plannedMoves.length === 0}
              onClick={handleClearAllMoves}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear
            </Button>
            <Button
              size="sm"
              className="h-6 text-[10px] px-2"
              disabled={plannedMoves.length === 0}
              onClick={() => setShowExportDialog(true)}
            >
              <Download className="h-3 w-3 mr-1" />
              Download
            </Button>
          </div>
        </div>

        {/* Search + Model Legend */}
        <div className="flex items-start gap-4">
          <div className="relative w-48">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 h-6 text-[10px]"
            />
          </div>
          <div className="flex-1 flex flex-wrap gap-1">
            {uniqueModels.slice(0, 12).map((model) => (
              <div
                key={model}
                className="flex items-center gap-1 text-[9px] text-muted-foreground"
              >
                <div className={cn("w-2 h-2 rounded-sm", getModelColor(model))} />
                <span className="truncate max-w-[80px]">{model}</span>
              </div>
            ))}
            {uniqueModels.length > 12 && (
              <span className="text-[9px] text-muted-foreground">
                +{uniqueModels.length - 12} more
              </span>
            )}
          </div>
        </div>

        {/* Planned Moves Summary */}
        {plannedMoves.length > 0 && (
          <div className="flex flex-wrap gap-1 p-2 bg-primary/5 border border-primary/20 rounded">
            {plannedMoves.map((move) => (
              <div
                key={move.id}
                className="flex items-center gap-1 px-1.5 py-0.5 bg-background rounded border text-[9px]"
              >
                <div className={cn("w-2 h-2 rounded-sm", getModelColor(move.machine.modelName || ""))} />
                <span className="font-medium">{move.machine.modelName || "Unknown"}</span>
                <span className="text-muted-foreground">{formatNumber(move.machine.currentBalance)}</span>
                <ArrowRight className="h-2 w-2 text-primary" />
                <span className="text-primary">{move.toStore.name}</span>
                <button
                  className="ml-0.5 hover:text-destructive"
                  onClick={() => handleRemoveMove(move.id)}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Store Grid - 6 columns on xl, 4 on lg, 3 on md */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
          {filteredStores.map((store) => {
            const storeMachines = machinesByStore.get(store.id) || [];
            const totalBalance = storeMachines.reduce((sum, m) => sum + (m.currentBalance || 0), 0);
            const activeMachines = storeMachines.filter((m) => m.status === "ACTIVE");

            return (
              <Card
                key={store.id}
                className={cn(
                  "transition-all",
                  draggedMachine &&
                    draggedFromStore?.id !== store.id &&
                    "border-dashed border-primary/50 bg-primary/5"
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add("ring-1", "ring-primary");
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove("ring-1", "ring-primary");
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("ring-1", "ring-primary");
                  handleDrop(store);
                }}
              >
                <CardContent className="p-1.5">
                  {/* Store Header */}
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-medium truncate flex-1">{store.name}</span>
                    <span className="text-[8px] text-muted-foreground ml-1">{activeMachines.length}</span>
                  </div>

                  {/* Store Stats */}
                  <div className="text-[8px] text-muted-foreground mb-1">
                    {formatNumber(totalBalance)} bal
                  </div>

                  {/* Machines */}
                  <div className="space-y-0.5 max-h-32 overflow-y-auto">
                    {storeMachines.length === 0 ? (
                      <p className="text-[8px] text-muted-foreground text-center py-1">
                        Empty
                      </p>
                    ) : (
                      storeMachines.map((machine) => {
                        const moved = isMachineMoved(machine.id);
                        const originalStore = getOriginalStore(machine.id);

                        return (
                          <div
                            key={machine.id}
                            draggable
                            onDragStart={() => handleDragStart(machine, store)}
                            onDragEnd={handleDragEnd}
                            className={cn(
                              "flex items-center gap-1 px-1 py-0.5 rounded text-[8px] cursor-grab active:cursor-grabbing hover:bg-muted/50",
                              moved && "ring-1 ring-primary/50 bg-primary/5"
                            )}
                            title={`${machine.serialNumber} - ${machine.modelName || "Unknown"}\nBalance: ${formatNumber(machine.currentBalance)}`}
                          >
                            <div className={cn("w-2 h-2 rounded-sm flex-shrink-0", getModelColor(machine.modelName || ""))} />
                            <div className="flex-1 min-w-0 truncate font-medium">
                              {machine.modelName || "Unknown"}
                            </div>
                            <span className="text-muted-foreground flex-shrink-0">
                              {formatNumber(machine.currentBalance)}
                            </span>
                            {moved && originalStore && (
                              <span className="text-[7px] text-primary flex-shrink-0">
                                *
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredStores.length === 0 && (
          <Card>
            <CardContent className="py-4 text-center text-xs text-muted-foreground">
              No stores match your search
            </CardContent>
          </Card>
        )}
      </div>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Download Move Plan</DialogTitle>
            <DialogDescription className="text-xs">
              {plannedMoves.length} machines · {formatNumber(moveStats.totalBalance)} total balance
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 max-h-48 overflow-y-auto border rounded p-2">
            {plannedMoves.map((move) => (
              <div
                key={move.id}
                className="flex items-center gap-2 p-1.5 rounded bg-muted/50 text-[10px]"
              >
                <div className={cn("w-2 h-2 rounded-sm", getModelColor(move.machine.modelName || ""))} />
                <span className="font-medium">{move.machine.modelName}</span>
                <span className="font-mono text-muted-foreground">{move.machine.serialNumber}</span>
                <span className="text-muted-foreground">{formatNumber(move.machine.currentBalance)}</span>
                <ArrowRight className="h-2.5 w-2.5 mx-1" />
                <span className="text-muted-foreground">{move.fromStore.name}</span>
                <ArrowRight className="h-2.5 w-2.5" />
                <span className="font-medium text-primary">{move.toStore.name}</span>
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowExportDialog(false)}>
              Cancel
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-3 w-3 mr-1" />
              CSV
            </Button>
            <Button size="sm" onClick={handleExportExcel}>
              <FileSpreadsheet className="h-3 w-3 mr-1" />
              Excel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
