"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
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

interface StoreMachines {
  store: Store;
  machines: MachineWithRelations[];
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

  // Apply planned moves to get current state
  const getEffectiveMachines = (): Map<string, MachineWithRelations[]> => {
    const machinesByStore = new Map<string, MachineWithRelations[]>();

    // Initialize all stores
    stores.forEach((store) => {
      machinesByStore.set(store.id, []);
    });

    // Start with original assignments
    machines.forEach((machine) => {
      // Check if this machine has been moved in the plan
      const move = plannedMoves.find((m) => m.machine.id === machine.id);
      const effectiveStoreId = move ? move.toStore.id : machine.companyId;

      const storeMachines = machinesByStore.get(effectiveStoreId) || [];
      storeMachines.push(machine);
      machinesByStore.set(effectiveStoreId, storeMachines);
    });

    return machinesByStore;
  };

  const machinesByStore = getEffectiveMachines();

  // Filter stores based on search
  const filteredStores = searchQuery
    ? stores.filter((store) => {
        const q = searchQuery.toLowerCase();
        if (store.name.toLowerCase().includes(q)) return true;
        const storeMachines = machinesByStore.get(store.id) || [];
        return storeMachines.some(
          (m) =>
            m.serialNumber?.toLowerCase().includes(q) ||
            m.modelName?.toLowerCase().includes(q)
        );
      })
    : stores;

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

    // Check if there's already a move for this machine
    const existingMoveIndex = plannedMoves.findIndex(
      (m) => m.machine.id === draggedMachine.id
    );

    // Get the original store
    const originalStoreId = draggedMachine.companyId;
    const originalStore = stores.find((s) => s.id === originalStoreId);

    // If moving back to original store, remove the move
    if (toStore.id === originalStoreId && existingMoveIndex !== -1) {
      setPlannedMoves((prev) => prev.filter((_, i) => i !== existingMoveIndex));
    } else if (existingMoveIndex !== -1) {
      // Update existing move
      setPlannedMoves((prev) =>
        prev.map((m, i) => (i === existingMoveIndex ? { ...m, toStore } : m))
      );
    } else if (originalStore) {
      // Add new move
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
        { key: "fromStore.name", header: "From Store" },
        { key: "toStore.name", header: "To Store" },
      ],
      "move-plan"
    );
    setShowExportDialog(false);
  };

  // Check if a machine has been moved from its original store
  const isMachineMoved = (machineId: string): boolean => {
    return plannedMoves.some((m) => m.machine.id === machineId);
  };

  // Get the original store for a moved machine
  const getOriginalStore = (machineId: string): Store | null => {
    const move = plannedMoves.find((m) => m.machine.id === machineId);
    return move?.fromStore || null;
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-[500px]" />
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
            <h1 className="text-xl font-bold tracking-tight">Lift Planner</h1>
            <p className="text-xs text-muted-foreground">
              Drag machines between stores to plan moves. Download the plan when ready.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {plannedMoves.length > 0 && (
              <Badge variant="outline" className="gap-1 text-xs">
                {plannedMoves.length} moves planned
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={plannedMoves.length === 0}
              onClick={handleClearAllMoves}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear All
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={plannedMoves.length === 0}
              onClick={() => setShowExportDialog(true)}
            >
              <Download className="h-3 w-3 mr-1" />
              Download Plan
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search stores or machines..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>

        {/* Planned Moves Summary */}
        {plannedMoves.length > 0 && (
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-sm flex items-center gap-2">
                Planned Moves ({plannedMoves.length})
                <span className="text-xs font-normal text-muted-foreground">
                  (Not saved - download to export)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="flex flex-wrap gap-2">
                {plannedMoves.map((move) => (
                  <div
                    key={move.id}
                    className="flex items-center gap-1 px-2 py-1 bg-background rounded border text-xs"
                  >
                    <span className="font-mono">{move.machine.serialNumber}</span>
                    <span className="text-muted-foreground">{move.fromStore.name}</span>
                    <ArrowRight className="h-3 w-3 text-primary" />
                    <span className="font-medium text-primary">{move.toStore.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 ml-1"
                      onClick={() => handleRemoveMove(move.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Store Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredStores.map((store) => {
            const storeMachines = machinesByStore.get(store.id) || [];
            const activeMachines = storeMachines.filter((m) => m.status === "ACTIVE");

            return (
              <Card
                key={store.id}
                className={cn(
                  "transition-colors",
                  draggedMachine &&
                    draggedFromStore?.id !== store.id &&
                    "border-dashed border-primary/50 bg-primary/5"
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add("ring-2", "ring-primary");
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove("ring-2", "ring-primary");
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("ring-2", "ring-primary");
                  handleDrop(store);
                }}
              >
                <CardHeader className="pb-1 pt-2 px-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-medium">{store.name}</CardTitle>
                    <Badge variant="secondary" className="text-[10px] px-1 py-0">
                      {activeMachines.length} active
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-2 pb-2">
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {storeMachines.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground text-center py-2">
                        No machines
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
                              "flex items-center gap-1 px-1.5 py-1 rounded text-[10px] cursor-grab active:cursor-grabbing hover:bg-muted/50",
                              moved && "bg-primary/10 border border-primary/30"
                            )}
                          >
                            <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-mono truncate">{machine.serialNumber}</div>
                              <div className="text-muted-foreground truncate">
                                {machine.modelName || "Unknown"}
                              </div>
                            </div>
                            {moved && originalStore && (
                              <Badge variant="outline" className="text-[8px] px-1 py-0 flex-shrink-0">
                                from {originalStore.name}
                              </Badge>
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
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No stores match your search
            </CardContent>
          </Card>
        )}
      </div>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Download Move Plan</DialogTitle>
            <DialogDescription>
              Download your {plannedMoves.length} planned moves as a spreadsheet.
              This is only a plan - no changes will be made to the system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-60 overflow-y-auto border rounded p-2">
            {plannedMoves.map((move) => (
              <div
                key={move.id}
                className="flex items-center gap-2 p-2 rounded bg-muted/50 text-xs"
              >
                <span className="font-mono">{move.machine.serialNumber}</span>
                <span className="text-muted-foreground">{move.fromStore.name}</span>
                <ArrowRight className="h-3 w-3" />
                <span className="font-medium text-primary">{move.toStore.name}</span>
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>
              Cancel
            </Button>
            <Button variant="outline" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button onClick={handleExportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
