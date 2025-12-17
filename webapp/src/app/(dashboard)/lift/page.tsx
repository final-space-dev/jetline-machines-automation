"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
  ArrowRight,
  Search,
  Undo2,
  Save,
  Trash2,
  CheckCircle,
} from "lucide-react";
import { formatNumber, cn } from "@/lib/utils";
import type { MachineWithRelations } from "@/types";

interface Store {
  id: string;
  name: string;
  region: string | null;
}

interface PendingMove {
  id: string;
  machine: MachineWithRelations;
  fromStore: Store;
  toStore: Store;
}

export default function LiftPlannerPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [machines, setMachines] = useState<MachineWithRelations[]>([]);
  const [pendingMoves, setPendingMoves] = useState<PendingMove[]>([]);
  const [sourceStore, setSourceStore] = useState<string>("");
  const [destStore, setDestStore] = useState<string>("");
  const [selectedMachines, setSelectedMachines] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [companiesRes, machinesRes] = await Promise.all([
        fetch("/api/companies"),
        fetch("/api/machines"),
      ]);

      const companiesData = await companiesRes.json();
      const machinesData = await machinesRes.json();

      setStores(companiesData.map((c: any) => ({
        id: c.id,
        name: c.name,
        region: c.region,
      })));
      setMachines(machinesData.data || []);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const sourceMachines = sourceStore
    ? machines.filter((m) => m.companyId === sourceStore)
    : [];

  const filteredMachines = searchQuery
    ? sourceMachines.filter(
        (m) =>
          m.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.modelName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : sourceMachines;

  const handleToggleMachine = (machineId: string) => {
    const newSelected = new Set(selectedMachines);
    if (newSelected.has(machineId)) {
      newSelected.delete(machineId);
    } else {
      newSelected.add(machineId);
    }
    setSelectedMachines(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedMachines.size === filteredMachines.length) {
      setSelectedMachines(new Set());
    } else {
      setSelectedMachines(new Set(filteredMachines.map((m) => m.id)));
    }
  };

  const handleAddMoves = () => {
    if (!sourceStore || !destStore || selectedMachines.size === 0) return;

    const fromStore = stores.find((s) => s.id === sourceStore);
    const toStore = stores.find((s) => s.id === destStore);
    if (!fromStore || !toStore) return;

    const newMoves: PendingMove[] = [];
    selectedMachines.forEach((machineId) => {
      const machine = machines.find((m) => m.id === machineId);
      if (machine && !pendingMoves.some((pm) => pm.machine.id === machineId)) {
        newMoves.push({
          id: `move-${Date.now()}-${machineId}`,
          machine,
          fromStore,
          toStore,
        });
      }
    });

    setPendingMoves([...pendingMoves, ...newMoves]);
    setSelectedMachines(new Set());
  };

  const handleUndoMove = (moveId: string) => {
    setPendingMoves((prev) => prev.filter((m) => m.id !== moveId));
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      // Execute all moves
      for (const move of pendingMoves) {
        await fetch(`/api/machines/${move.machine.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId: move.toStore.id }),
        });
      }
      setPendingMoves([]);
      setShowConfirmDialog(false);
      // Refresh data
      await fetchData();
    } catch (error) {
      console.error("Failed to save moves:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
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
              Move machines between stores
            </p>
          </div>
          <div className="flex items-center gap-2">
            {pendingMoves.length > 0 && (
              <Badge variant="outline" className="gap-1 text-xs">
                {pendingMoves.length} pending
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={pendingMoves.length === 0}
              onClick={() => setPendingMoves([])}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={pendingMoves.length === 0}
              onClick={() => setShowConfirmDialog(true)}
            >
              <Save className="h-3 w-3 mr-1" />
              Save ({pendingMoves.length})
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Source Selection */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-sm">Select Machines to Move</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-3 pb-3">
              {/* Store Selectors */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">From Store</label>
                  <Select value={sourceStore} onValueChange={(v) => { setSourceStore(v); setSelectedMachines(new Set()); }}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select source store" />
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
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">To Store</label>
                  <Select value={destStore} onValueChange={setDestStore}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select destination" />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.filter((s) => s.id !== sourceStore).map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {sourceStore && (
                <>
                  {/* Search */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search machines..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 h-8 text-xs"
                      />
                    </div>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleSelectAll}>
                      {selectedMachines.size === filteredMachines.length ? "Deselect" : "Select All"}
                    </Button>
                  </div>

                  {/* Machines Table */}
                  <div className="border rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="px-2 py-1.5 text-left w-6"></th>
                          <th className="px-2 py-1.5 text-left font-medium">Serial</th>
                          <th className="px-2 py-1.5 text-left font-medium">Model</th>
                          <th className="px-2 py-1.5 text-right font-medium">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredMachines.map((machine) => (
                          <tr
                            key={machine.id}
                            className={cn(
                              "cursor-pointer",
                              selectedMachines.has(machine.id) ? "bg-primary/10" : "hover:bg-muted/50"
                            )}
                            onClick={() => handleToggleMachine(machine.id)}
                          >
                            <td className="px-2 py-1">
                              <input
                                type="checkbox"
                                checked={selectedMachines.has(machine.id)}
                                onChange={() => {}}
                                className="rounded h-3 w-3"
                              />
                            </td>
                            <td className="px-2 py-1 font-mono">{machine.serialNumber}</td>
                            <td className="px-2 py-1 text-muted-foreground">{machine.modelName || "-"}</td>
                            <td className="px-2 py-1 text-right font-mono">{formatNumber(machine.currentBalance)}</td>
                          </tr>
                        ))}
                        {filteredMachines.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-2 py-4 text-center text-muted-foreground">
                              No machines found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Add Button */}
                  <Button
                    className="w-full h-8 text-xs"
                    disabled={selectedMachines.size === 0 || !destStore}
                    onClick={handleAddMoves}
                  >
                    Add {selectedMachines.size} Machine{selectedMachines.size !== 1 ? "s" : ""} to Move List
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Pending Moves */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-sm">Pending Moves ({pendingMoves.length})</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {pendingMoves.length > 0 ? (
                <div className="border rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-medium">Serial</th>
                        <th className="px-2 py-1.5 text-left font-medium">From</th>
                        <th className="px-2 py-1.5 text-center font-medium"></th>
                        <th className="px-2 py-1.5 text-left font-medium">To</th>
                        <th className="px-2 py-1.5 text-center font-medium w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {pendingMoves.map((move) => (
                        <tr key={move.id}>
                          <td className="px-2 py-1 font-mono">{move.machine.serialNumber}</td>
                          <td className="px-2 py-1 text-muted-foreground">{move.fromStore.name}</td>
                          <td className="px-2 py-1 text-center">
                            <ArrowRight className="h-3 w-3 inline text-muted-foreground" />
                          </td>
                          <td className="px-2 py-1 font-medium text-primary">{move.toStore.name}</td>
                          <td className="px-2 py-1 text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={() => handleUndoMove(move.id)}
                            >
                              <Undo2 className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="border rounded-lg p-4 text-center text-xs text-muted-foreground">
                  <p>Select machines from a source store and add them to the move list</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Machine Moves</DialogTitle>
            <DialogDescription>
              You are about to move {pendingMoves.length} machines. This will update their
              assigned stores in the system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {pendingMoves.map((move) => (
              <div
                key={move.id}
                className="flex items-center gap-2 p-2 rounded-lg border text-sm"
              >
                <span className="font-mono">{move.machine.serialNumber}</span>
                <span className="text-muted-foreground">{move.fromStore.name}</span>
                <ArrowRight className="h-4 w-4" />
                <span className="text-primary font-medium">{move.toStore.name}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveChanges} disabled={isSaving}>
              <CheckCircle className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Confirm Moves"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
