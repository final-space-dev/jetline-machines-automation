"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoading } from "@/components/ui/page-loading";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowRight,
  Search,
  Download,
  FileSpreadsheet,
  Trash2,
  X,
  Lightbulb,
  ArrowLeftRight,
  ChevronRight,
  Building2,
  Printer,
  Save,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { exportToExcel, exportToCSV } from "@/lib/export";
import type { MachineWithRelations } from "@/types";

const STORAGE_KEY = "jetline-lift-plan";

interface Store {
  id: string;
  name: string;
  region: string | null;
}

interface PlannedMove {
  id: string;
  machineId: string;
  machineSerialNumber: string;
  machineModelName: string | null;
  machineMakeName: string | null;
  machineBalance: number;
  machineCategoryName: string | null;
  fromStoreId: string;
  fromStoreName: string;
  toStoreId: string;
  toStoreName: string;
}

interface SavedPlan {
  moves: PlannedMove[];
  savedAt: string;
}

interface LiftSuggestion {
  machine: {
    id: string;
    serialNumber: string;
    modelName: string | null;
    company: { id: string; name: string };
    periodVolume: number;
  };
  currentStore: string;
  suggestedAction: string;
  reason: string;
}

export default function LiftPlannerPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [machines, setMachines] = useState<MachineWithRelations[]>([]);
  const [plannedMoves, setPlannedMoves] = useState<PlannedMove[]>([]);
  const [suggestions, setSuggestions] = useState<LiftSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [hasRestoredPlan, setHasRestoredPlan] = useState(false);

  // Selection state
  const [sourceStore, setSourceStore] = useState<string>("");
  const [targetStore, setTargetStore] = useState<string>("");
  const [machineSearch, setMachineSearch] = useState("");
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Save to localStorage whenever moves change
  const savePlan = useCallback((moves: PlannedMove[]) => {
    if (typeof window === "undefined") return;

    const plan: SavedPlan = {
      moves,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
    setLastSaved(new Date());
  }, []);

  // Load from localStorage on mount
  const loadSavedPlan = useCallback((): SavedPlan | null => {
    if (typeof window === "undefined") return null;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved) as SavedPlan;
      }
    } catch (e) {
      console.error("Failed to load saved plan:", e);
    }
    return null;
  }, []);

  // Clear saved plan
  const clearSavedPlan = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
    setLastSaved(null);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-save when moves change
  useEffect(() => {
    if (plannedMoves.length > 0) {
      savePlan(plannedMoves);
    } else if (hasRestoredPlan) {
      // Only clear storage if user explicitly cleared after restoring
      clearSavedPlan();
    }
  }, [plannedMoves, savePlan, clearSavedPlan, hasRestoredPlan]);

  const fetchData = async () => {
    try {
      const [companiesRes, machinesRes, insightsRes] = await Promise.all([
        fetch("/api/companies"),
        fetch("/api/machines?limit=10000&status=ACTIVE"),
        fetch("/api/dashboard/insights?period=90"),
      ]);

      const companiesData = await companiesRes.json();
      const machinesData = await machinesRes.json();
      const insightsData = await insightsRes.json();

      const storeList = companiesData.map((c: { id: string; name: string; region: string | null }) => ({
        id: c.id,
        name: c.name,
        region: c.region,
      }));

      setStores(storeList);
      setMachines(machinesData.data || []);
      setSuggestions(insightsData.insights?.liftSuggestions || []);

      // Restore saved plan if exists
      const savedPlan = loadSavedPlan();
      if (savedPlan && savedPlan.moves.length > 0) {
        setPlannedMoves(savedPlan.moves);
        setLastSaved(new Date(savedPlan.savedAt));
        setHasRestoredPlan(true);
      }

      // Auto-select first store if available
      if (storeList.length > 0) {
        setSourceStore(storeList[0].id);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get effective store for a machine (accounting for planned moves)
  const getMachineEffectiveStore = useCallback((machineId: string, originalStoreId: string): string => {
    const move = plannedMoves.find((pm) => pm.machineId === machineId);
    return move ? move.toStoreId : originalStoreId;
  }, [plannedMoves]);

  // Get machines for a store (accounting for planned moves)
  const getMachinesForStore = useCallback((storeId: string): MachineWithRelations[] => {
    if (!storeId) return [];

    return machines.filter((m) => {
      const effectiveStore = getMachineEffectiveStore(m.id, m.companyId);
      return effectiveStore === storeId;
    });
  }, [machines, getMachineEffectiveStore]);

  // Get machines for source store
  const sourceMachines = useMemo(() => {
    return getMachinesForStore(sourceStore);
  }, [sourceStore, getMachinesForStore]);

  // Get machines for target store
  const targetMachines = useMemo(() => {
    return getMachinesForStore(targetStore);
  }, [targetStore, getMachinesForStore]);

  // Filter source machines by search
  const filteredSourceMachines = useMemo(() => {
    if (!machineSearch) return sourceMachines;
    const q = machineSearch.toLowerCase();
    return sourceMachines.filter(
      (m) =>
        m.serialNumber?.toLowerCase().includes(q) ||
        m.modelName?.toLowerCase().includes(q) ||
        m.category?.name?.toLowerCase().includes(q)
    );
  }, [sourceMachines, machineSearch]);

  // Store stats helper
  const getStoreStats = useCallback((storeId: string) => {
    const storeMachines = getMachinesForStore(storeId);
    return {
      count: storeMachines.length,
      balance: storeMachines.reduce((sum, m) => sum + (m.currentBalance || 0), 0),
    };
  }, [getMachinesForStore]);

  const handleMoveMachine = (machine: MachineWithRelations) => {
    if (!targetStore || !sourceStore) return;

    const fromStore = stores.find((s) => s.id === machine.companyId); // Always use original store
    const toStore = stores.find((s) => s.id === targetStore);
    if (!fromStore || !toStore) return;

    // Check if machine already has a planned move
    const existingMoveIndex = plannedMoves.findIndex((pm) => pm.machineId === machine.id);

    if (existingMoveIndex !== -1) {
      const existingMove = plannedMoves[existingMoveIndex];

      // If moving back to original location, remove the move entirely
      if (toStore.id === machine.companyId) {
        setPlannedMoves((prev) => prev.filter((pm) => pm.machineId !== machine.id));
        return;
      }

      // Otherwise update the destination
      setPlannedMoves((prev) =>
        prev.map((pm) =>
          pm.machineId === machine.id
            ? { ...pm, toStoreId: toStore.id, toStoreName: toStore.name }
            : pm
        )
      );
      return;
    }

    // Don't add move if machine is already at target store
    if (machine.companyId === targetStore) return;

    // Add new move
    const newMove: PlannedMove = {
      id: `move-${Date.now()}-${machine.id}`,
      machineId: machine.id,
      machineSerialNumber: machine.serialNumber,
      machineModelName: machine.modelName,
      machineMakeName: machine.makeName,
      machineBalance: machine.currentBalance,
      machineCategoryName: machine.category?.name || null,
      fromStoreId: machine.companyId,
      fromStoreName: fromStore.name,
      toStoreId: toStore.id,
      toStoreName: toStore.name,
    };

    setPlannedMoves((prev) => [...prev, newMove]);
  };

  const handleRemoveMove = (moveId: string) => {
    setPlannedMoves((prev) => prev.filter((m) => m.id !== moveId));
  };

  const handleClearAllMoves = () => {
    setPlannedMoves([]);
    clearSavedPlan();
    setShowClearDialog(false);
    setHasRestoredPlan(false);
  };

  const handleSwapStores = () => {
    const temp = sourceStore;
    setSourceStore(targetStore);
    setTargetStore(temp);
  };

  const handleApplySuggestion = (suggestion: LiftSuggestion) => {
    const machine = machines.find((m) => m.id === suggestion.machine.id);
    if (!machine) return;
    setSourceStore(machine.companyId);
  };

  const handleExportExcel = () => {
    if (plannedMoves.length === 0) return;

    const exportData = plannedMoves.map((move) => ({
      serialNumber: move.machineSerialNumber,
      modelName: move.machineModelName,
      makeName: move.machineMakeName,
      balance: move.machineBalance,
      fromStore: move.fromStoreName,
      toStore: move.toStoreName,
    }));

    exportToExcel(
      exportData,
      [
        { key: "serialNumber", header: "Serial Number" },
        { key: "modelName", header: "Model" },
        { key: "makeName", header: "Make" },
        { key: "balance", header: "Balance" },
        { key: "fromStore", header: "From Store" },
        { key: "toStore", header: "To Store" },
      ],
      "lift-plan"
    );
    setShowExportDialog(false);
  };

  const handleExportCSV = () => {
    if (plannedMoves.length === 0) return;

    const exportData = plannedMoves.map((move) => ({
      serialNumber: move.machineSerialNumber,
      modelName: move.machineModelName,
      makeName: move.machineMakeName,
      balance: move.machineBalance,
      fromStore: move.fromStoreName,
      toStore: move.toStoreName,
    }));

    exportToCSV(
      exportData,
      [
        { key: "serialNumber", header: "Serial Number" },
        { key: "modelName", header: "Model" },
        { key: "makeName", header: "Make" },
        { key: "balance", header: "Balance" },
        { key: "fromStore", header: "From Store" },
        { key: "toStore", header: "To Store" },
      ],
      "lift-plan"
    );
    setShowExportDialog(false);
  };

  const isMachineMoved = (machineId: string): boolean => {
    return plannedMoves.some((m) => m.machineId === machineId);
  };

  const getMoveForMachine = (machineId: string): PlannedMove | undefined => {
    return plannedMoves.find((m) => m.machineId === machineId);
  };

  if (isLoading) {
    return (
      <AppShell>
        <PageLoading variant="cards" />
      </AppShell>
    );
  }

  const sourceStoreData = stores.find((s) => s.id === sourceStore);
  const targetStoreData = stores.find((s) => s.id === targetStore);
  const sourceStats = sourceStore ? getStoreStats(sourceStore) : null;
  const targetStats = targetStore ? getStoreStats(targetStore) : null;

  // Group moves by from-store for summary
  const movesByFromStore = plannedMoves.reduce((acc, move) => {
    if (!acc[move.fromStoreName]) acc[move.fromStoreName] = [];
    acc[move.fromStoreName].push(move);
    return acc;
  }, {} as Record<string, PlannedMove[]>);

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <PageHeader
            title="Lift Planner"
            description={`Plan machine moves between stores`}
          />
          {plannedMoves.length > 0 && (
            <div className="flex items-center gap-2">
              {lastSaved && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  <span>Auto-saved</span>
                </div>
              )}
              <Badge variant="secondary" className="text-xs">
                {plannedMoves.length} moves
              </Badge>
            </div>
          )}
        </div>

        {/* Restored Plan Notice */}
        {hasRestoredPlan && plannedMoves.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <RotateCcw className="h-4 w-4 text-blue-600" />
              <span className="text-blue-800">
                Restored {plannedMoves.length} moves from previous session
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-blue-600 hover:text-blue-800"
              onClick={() => setHasRestoredPlan(false)}
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* AI Suggestions Banner */}
        {suggestions.length > 0 && plannedMoves.length === 0 && (
          <Card className="border-purple-200 bg-purple-50/50">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-purple-600" />
                Suggested Moves
                <Badge variant="secondary" className="text-[10px]">
                  {suggestions.length} suggestions
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="space-y-1">
                {suggestions.slice(0, 3).map((suggestion, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-white rounded border text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="font-mono font-medium">
                          {suggestion.machine.serialNumber}
                        </span>
                        <span className="text-muted-foreground ml-2">
                          {suggestion.machine.modelName}
                        </span>
                      </div>
                      <span className="text-muted-foreground">at</span>
                      <span className="font-medium">{suggestion.currentStore}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-[10px] max-w-[200px] truncate">
                        {suggestion.reason}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px]"
                        onClick={() => handleApplySuggestion(suggestion)}
                      >
                        Select
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Store Selector */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">From Store</label>
            <Select value={sourceStore} onValueChange={setSourceStore}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select source store" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((store) => {
                  const stats = getStoreStats(store.id);
                  const movesFromStore = plannedMoves.filter((m) => m.fromStoreId === store.id).length;
                  return (
                    <SelectItem key={store.id} value={store.id}>
                      <div className="flex items-center gap-2 w-full">
                        <span>{store.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {stats.count} machines
                        </span>
                        {movesFromStore > 0 && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0">
                            {movesFromStore} moving
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            size="icon"
            className="mt-5 h-9 w-9"
            onClick={handleSwapStores}
            disabled={!sourceStore || !targetStore}
          >
            <ArrowLeftRight className="h-4 w-4" />
          </Button>

          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">To Store</label>
            <Select value={targetStore} onValueChange={setTargetStore}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select target store" />
              </SelectTrigger>
              <SelectContent>
                {stores
                  .filter((s) => s.id !== sourceStore)
                  .map((store) => {
                    const stats = getStoreStats(store.id);
                    const movesToStore = plannedMoves.filter((m) => m.toStoreId === store.id).length;
                    return (
                      <SelectItem key={store.id} value={store.id}>
                        <div className="flex items-center gap-2 w-full">
                          <span>{store.name}</span>
                          <span className="text-muted-foreground text-xs">
                            {stats.count} machines
                          </span>
                          {movesToStore > 0 && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 text-blue-600 border-blue-300">
                              +{movesToStore} incoming
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Two-Panel Machine View */}
        <div className="grid grid-cols-2 gap-4">
          {/* Source Store Panel */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {sourceStoreData?.name || "Select a store"}
                </CardTitle>
                {sourceStats && (
                  <div className="text-xs text-muted-foreground">
                    {sourceStats.count} machines · {formatNumber(sourceStats.balance)} bal
                  </div>
                )}
              </div>
              {sourceStore && (
                <div className="relative mt-2">
                  <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search machines..."
                    value={machineSearch}
                    onChange={(e) => setMachineSearch(e.target.value)}
                    className="pl-7 h-7 text-xs"
                  />
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {!sourceStore ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Select a source store to see machines
                </div>
              ) : filteredSourceMachines.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {machineSearch ? "No machines match search" : "No machines in this store"}
                </div>
              ) : (
                <div className="max-h-[400px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 border-y sticky top-0">
                      <tr>
                        <th className="px-3 py-1.5 text-left font-medium">Serial</th>
                        <th className="px-3 py-1.5 text-left font-medium">Model</th>
                        <th className="px-3 py-1.5 text-left font-medium">Category</th>
                        <th className="px-3 py-1.5 text-right font-medium">Balance</th>
                        <th className="px-3 py-1.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredSourceMachines.map((machine) => {
                        const move = getMoveForMachine(machine.id);
                        const isMovedHere = move && move.toStoreId === sourceStore;
                        const isMovingAway = move && move.fromStoreId === sourceStore;

                        return (
                          <tr
                            key={machine.id}
                            className={cn(
                              "hover:bg-muted/50",
                              isMovedHere && "bg-blue-50",
                              isMovingAway && "bg-amber-50"
                            )}
                          >
                            <td className="px-3 py-1.5 font-mono">
                              {machine.serialNumber}
                              {isMovedHere && (
                                <Badge variant="outline" className="ml-1 text-[8px] px-1 py-0 text-blue-600 border-blue-300">
                                  from {move.fromStoreName}
                                </Badge>
                              )}
                            </td>
                            <td className="px-3 py-1.5">{machine.modelName || "-"}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">
                              {machine.category?.name || "-"}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono">
                              {formatNumber(machine.currentBalance)}
                            </td>
                            <td className="px-3 py-1.5">
                              {targetStore && !isMovedHere && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0"
                                  onClick={() => handleMoveMachine(machine)}
                                  title={`Move to ${targetStoreData?.name}`}
                                >
                                  <ChevronRight className="h-3 w-3" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Target Store Panel */}
          <Card className={cn(!targetStore && "opacity-50")}>
            <CardHeader className="pb-2 pt-3 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {targetStoreData?.name || "Select target store"}
                </CardTitle>
                {targetStats && (
                  <div className="text-xs text-muted-foreground">
                    {targetStats.count} machines · {formatNumber(targetStats.balance)} bal
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {!targetStore ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Select a target store to move machines
                </div>
              ) : targetMachines.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No machines in this store yet
                </div>
              ) : (
                <div className="max-h-[400px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 border-y sticky top-0">
                      <tr>
                        <th className="px-3 py-1.5 text-left font-medium">Serial</th>
                        <th className="px-3 py-1.5 text-left font-medium">Model</th>
                        <th className="px-3 py-1.5 text-left font-medium">Category</th>
                        <th className="px-3 py-1.5 text-right font-medium">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {targetMachines.map((machine) => {
                        const move = getMoveForMachine(machine.id);
                        const isIncoming = move && move.toStoreId === targetStore;

                        return (
                          <tr
                            key={machine.id}
                            className={cn(
                              "hover:bg-muted/50",
                              isIncoming && "bg-green-50"
                            )}
                          >
                            <td className="px-3 py-1.5 font-mono">
                              {machine.serialNumber}
                              {isIncoming && (
                                <Badge variant="outline" className="ml-1 text-[8px] px-1 py-0 text-green-600 border-green-300">
                                  incoming
                                </Badge>
                              )}
                            </td>
                            <td className="px-3 py-1.5">{machine.modelName || "-"}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">
                              {machine.category?.name || "-"}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono">
                              {formatNumber(machine.currentBalance)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Planned Moves Summary */}
        {plannedMoves.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-3 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Printer className="h-4 w-4" />
                  Planned Moves
                  <Badge variant="secondary" className="text-[10px]">
                    {plannedMoves.length} machines
                  </Badge>
                  <span className="text-xs text-muted-foreground font-normal">
                    from {Object.keys(movesByFromStore).length} stores
                  </span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setShowClearDialog(true)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Clear All
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setShowExportDialog(true)}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Export Plan
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[300px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 border-y sticky top-0">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium">Serial</th>
                      <th className="px-3 py-1.5 text-left font-medium">Model</th>
                      <th className="px-3 py-1.5 text-right font-medium">Balance</th>
                      <th className="px-3 py-1.5 text-left font-medium">From</th>
                      <th className="px-3 py-1.5 w-8"></th>
                      <th className="px-3 py-1.5 text-left font-medium">To</th>
                      <th className="px-3 py-1.5 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {plannedMoves.map((move) => (
                      <tr key={move.id} className="hover:bg-muted/50">
                        <td className="px-3 py-1.5 font-mono">{move.machineSerialNumber}</td>
                        <td className="px-3 py-1.5">{move.machineModelName || "-"}</td>
                        <td className="px-3 py-1.5 text-right font-mono">
                          {formatNumber(move.machineBalance)}
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground">{move.fromStoreName}</td>
                        <td className="px-3 py-1.5">
                          <ArrowRight className="h-3 w-3 text-primary" />
                        </td>
                        <td className="px-3 py-1.5 font-medium text-primary">{move.toStoreName}</td>
                        <td className="px-3 py-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 hover:text-destructive"
                            onClick={() => handleRemoveMove(move.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Clear Confirmation Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all planned moves?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all {plannedMoves.length} planned moves. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAllMoves} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Export Move Plan</DialogTitle>
            <DialogDescription className="text-xs">
              {plannedMoves.length} machines from {Object.keys(movesByFromStore).length} stores
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 max-h-64 overflow-y-auto border rounded p-2">
            {plannedMoves.map((move) => (
              <div
                key={move.id}
                className="flex items-center gap-2 p-2 rounded bg-muted/50 text-xs"
              >
                <span className="font-mono">{move.machineSerialNumber}</span>
                <span className="text-muted-foreground">{move.machineModelName}</span>
                <ArrowRight className="h-3 w-3 mx-1 text-primary" />
                <span className="text-muted-foreground">{move.fromStoreName}</span>
                <ArrowRight className="h-3 w-3 text-primary" />
                <span className="font-medium text-primary">{move.toStoreName}</span>
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
