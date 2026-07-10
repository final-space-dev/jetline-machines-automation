"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageLoading } from "@/components/ui/page-loading";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight,
  Search,
  Download,
  FileSpreadsheet,
  Trash2,
  X,
  Lightbulb,
  Building2,
  Printer,
  CheckCircle2,
  GripVertical,
  Sparkles,
  Zap,
  RotateCcw,
  Plus,
  Minus,
  Eye,
  EyeOff,
  MapPin,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Target,
  Filter,
  Activity,
} from "lucide-react";
import { cn, formatNumber, formatCurrency } from "@/lib/utils";
import { exportToExcel, exportToCSV } from "@/lib/export";
import type { MachineWithRelations } from "@/types";

// Utilization data from the API
interface MachineUtilization {
  machineId: string;
  serialNumber: string;
  modelName: string | null;
  categoryName: string | null;
  companyId: string;
  companyName: string;
  currentBalance: number;
  avgMonthlyVolume: number;
  dutyCycle: number;
  utilizationPercent: number;
  utilizationStatus: "critical" | "low" | "optimal" | "high" | "overworked";
  volumeTrend: number;
  trendDirection: "up" | "down" | "stable";
  contractEndDate: string | null;
  contractMonthsRemaining: number | null;
  rentalAmount: number | null;
  contractType: string | null;
  daysSinceLastReading: number | null;
  machineAgeMonths: number | null;
  isLifted: boolean;
  liftScore: number;
  insights: string[];
}

const STORAGE_KEY = "jetline-lift-plan-v2";

interface Store {
  id: string;
  name: string;
  region: string | null;
  _count?: { machines: number };
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
  version: number;
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
  priority?: "high" | "medium" | "low";
}

type UtilizationFilter = "all" | "critical" | "low" | "optimal" | "high" | "overworked" | "lift-candidates" | "expiring";

// Utilization status colors and labels
const utilizationConfig: Record<string, { color: string; bgColor: string; label: string }> = {
  critical: { color: "text-red-600", bgColor: "bg-red-500", label: "Critical" },
  low: { color: "text-amber-600", bgColor: "bg-amber-500", label: "Low" },
  optimal: { color: "text-emerald-600", bgColor: "bg-emerald-500", label: "Optimal" },
  high: { color: "text-blue-600", bgColor: "bg-blue-500", label: "High" },
  overworked: { color: "text-purple-600", bgColor: "bg-purple-500", label: "Overworked" },
};

// Sortable Machine Card Component with Utilization Data
function SortableMachineCard({
  machine,
  utilization,
  isPlanned,
  plannedMove,
  onRemoveMove,
  viewMode,
}: {
  machine: MachineWithRelations;
  utilization?: MachineUtilization;
  isPlanned: boolean;
  plannedMove?: PlannedMove;
  onRemoveMove?: (id: string) => void;
  viewMode: "compact" | "detailed";
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: machine.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const categoryColors: Record<string, string> = {
    Colour: "bg-blue-500",
    "Black and White": "bg-gray-500",
    Plan: "bg-purple-500",
    "Office Machine": "bg-green-500",
  };

  const categoryColor = categoryColors[machine.category?.name || ""] || "bg-gray-400";
  const statusConfig = utilization ? utilizationConfig[utilization.utilizationStatus] : null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            ref={setNodeRef}
            style={style}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={cn(
              "group relative rounded-lg border bg-card transition-all duration-200",
              isDragging && "opacity-50 shadow-2xl ring-2 ring-primary z-50",
              isPlanned && "ring-2 ring-emerald-500 bg-emerald-50/50",
              !isDragging && "hover:shadow-md hover:border-primary/50"
            )}
          >
            {/* Category indicator bar */}
            <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-lg", categoryColor)} />

            <div className={cn("p-3 pl-4", viewMode === "compact" && "p-2 pl-3")}>
              <div className="flex items-start gap-2">
                {/* Drag handle */}
                <div
                  {...attributes}
                  {...listeners}
                  className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                  <GripVertical className="h-4 w-4" />
                </div>

                <div className="flex-1 min-w-0">
                  {/* Header row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-sm font-semibold truncate">
                        {machine.serialNumber}
                      </span>
                      {isPlanned && plannedMove && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 border-emerald-300 shrink-0">
                          → {plannedMove.toStoreName}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Lift Score Badge */}
                      {utilization && utilization.liftScore >= 60 && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] px-1 py-0",
                            utilization.liftScore >= 80
                              ? "bg-red-100 text-red-700 border-red-300"
                              : "bg-amber-100 text-amber-700 border-amber-300"
                          )}
                        >
                          <Target className="h-2.5 w-2.5 mr-0.5" />
                          {utilization.liftScore}
                        </Badge>
                      )}

                      {isPlanned && plannedMove && onRemoveMove && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveMove(plannedMove.id);
                          }}
                        >
                          <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Detailed View */}
                  {viewMode === "detailed" && (
                    <div className="mt-1.5 space-y-1.5">
                      <p className="text-xs text-muted-foreground truncate">
                        {machine.modelName || "Unknown Model"}
                      </p>

                      {/* Utilization Bar */}
                      {utilization && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className={cn("font-medium", statusConfig?.color)}>
                              {utilization.utilizationPercent}% util
                            </span>
                            <span className="text-muted-foreground flex items-center gap-0.5">
                              {utilization.trendDirection === "up" && (
                                <TrendingUp className="h-2.5 w-2.5 text-emerald-500" />
                              )}
                              {utilization.trendDirection === "down" && (
                                <TrendingDown className="h-2.5 w-2.5 text-red-500" />
                              )}
                              {utilization.avgMonthlyVolume > 0 && (
                                <span>{formatNumber(utilization.avgMonthlyVolume)}/mo</span>
                              )}
                            </span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full transition-all", statusConfig?.bgColor || "bg-gray-400")}
                              style={{ width: `${Math.min(utilization.utilizationPercent, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Contract & Info Row */}
                      <div className="flex items-center gap-2 text-[10px] flex-wrap">
                        {utilization && utilization.contractMonthsRemaining !== null && (
                          <span className={cn(
                            "flex items-center gap-0.5",
                            utilization.contractMonthsRemaining <= 3
                              ? "text-red-600"
                              : utilization.contractMonthsRemaining <= 6
                                ? "text-amber-600"
                                : "text-muted-foreground"
                          )}>
                            <Clock className="h-2.5 w-2.5" />
                            {utilization.contractMonthsRemaining}mo
                          </span>
                        )}
                        {utilization && utilization.rentalAmount && (
                          <span className="text-muted-foreground">
                            {formatCurrency(utilization.rentalAmount)}
                          </span>
                        )}
                        <span className="text-muted-foreground">
                          {machine.category?.name || "—"}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Compact View */}
                  {viewMode === "compact" && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[11px] text-muted-foreground truncate">
                        {machine.modelName}
                      </p>
                      {utilization && (
                        <span className={cn("text-[10px] font-medium", statusConfig?.color)}>
                          {utilization.utilizationPercent}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </TooltipTrigger>
        {utilization && utilization.insights.length > 0 && (
          <TooltipContent side="right" className="max-w-[250px]">
            <div className="space-y-1">
              <p className="font-medium text-xs">Insights</p>
              {utilization.insights.map((insight, idx) => (
                <p key={idx} className="text-[11px] text-muted-foreground">• {insight}</p>
              ))}
            </div>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}

// Machine Card for Drag Overlay
function MachineCardOverlay({ machine, utilization }: { machine: MachineWithRelations; utilization?: MachineUtilization }) {
  const statusConfig = utilization ? utilizationConfig[utilization.utilizationStatus] : null;

  return (
    <div className="rounded-lg border bg-card shadow-2xl ring-2 ring-primary p-3 min-w-[220px]">
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-primary" />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm font-semibold">{machine.serialNumber}</span>
            {utilization && (
              <Badge variant="outline" className={cn("text-[9px] px-1", statusConfig?.color)}>
                {utilization.utilizationPercent}%
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{machine.modelName}</p>
        </div>
      </div>
    </div>
  );
}

// Store Column Component
function StoreColumn({
  store,
  machines,
  utilizationMap,
  plannedMoves,
  onRemoveMove,
  isDropTarget,
  viewMode,
  searchQuery,
}: {
  store: Store;
  machines: MachineWithRelations[];
  utilizationMap: Map<string, MachineUtilization>;
  plannedMoves: PlannedMove[];
  onRemoveMove: (id: string) => void;
  isDropTarget: boolean;
  viewMode: "compact" | "detailed";
  searchQuery: string;
}) {
  const filteredMachines = useMemo(() => {
    if (!searchQuery) return machines;
    const q = searchQuery.toLowerCase();
    return machines.filter(
      (m) =>
        m.serialNumber?.toLowerCase().includes(q) ||
        m.modelName?.toLowerCase().includes(q) ||
        m.category?.name?.toLowerCase().includes(q)
    );
  }, [machines, searchQuery]);

  const incomingCount = plannedMoves.filter((m) => m.toStoreId === store.id).length;
  const outgoingCount = plannedMoves.filter((m) => m.fromStoreId === store.id).length;

  // Calculate store-level utilization summary
  const storeUtilizations = machines.map((m) => utilizationMap.get(m.id)).filter(Boolean) as MachineUtilization[];
  const avgUtilization = storeUtilizations.length > 0
    ? Math.round(storeUtilizations.reduce((sum, u) => sum + u.utilizationPercent, 0) / storeUtilizations.length)
    : 0;
  const liftCandidates = storeUtilizations.filter((u) => u.liftScore >= 70).length;

  return (
    <motion.div
      layout
      className={cn(
        "flex flex-col h-full rounded-xl border-2 bg-muted/30 transition-all duration-300 min-w-[300px] max-w-[340px]",
        isDropTarget && "border-primary bg-primary/5 shadow-lg scale-[1.02]",
        !isDropTarget && "border-transparent"
      )}
    >
      {/* Column Header */}
      <div className="p-3 border-b bg-background/80 backdrop-blur-sm rounded-t-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">{store.name}</h3>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>{machines.length} machines</span>
                <span>·</span>
                <span className={cn(
                  avgUtilization < 40 ? "text-amber-600" : avgUtilization > 80 ? "text-blue-600" : "text-emerald-600"
                )}>
                  {avgUtilization}% avg util
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-1">
              {outgoingCount > 0 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-300 bg-amber-50">
                  <Minus className="h-2.5 w-2.5 mr-0.5" />
                  {outgoingCount}
                </Badge>
              )}
              {incomingCount > 0 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-emerald-600 border-emerald-300 bg-emerald-50">
                  <Plus className="h-2.5 w-2.5 mr-0.5" />
                  {incomingCount}
                </Badge>
              )}
            </div>
            {liftCandidates > 0 && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 text-red-600 border-red-300 bg-red-50">
                <Target className="h-2 w-2 mr-0.5" />
                {liftCandidates} lift
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Machine List */}
      <ScrollArea className="flex-1 p-2">
        <SortableContext items={filteredMachines.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {filteredMachines.map((machine) => {
                const plannedMove = plannedMoves.find((pm) => pm.machineId === machine.id);
                const utilization = utilizationMap.get(machine.id);
                return (
                  <SortableMachineCard
                    key={machine.id}
                    machine={machine}
                    utilization={utilization}
                    isPlanned={!!plannedMove}
                    plannedMove={plannedMove}
                    onRemoveMove={onRemoveMove}
                    viewMode={viewMode}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        </SortableContext>

        {filteredMachines.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-8 text-center"
          >
            <div className="p-3 rounded-full bg-muted mb-2">
              <Printer className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              {searchQuery ? "No matches" : "Drop machines here"}
            </p>
          </motion.div>
        )}
      </ScrollArea>
    </motion.div>
  );
}

// Main Component
export default function LiftPlannerPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [machines, setMachines] = useState<MachineWithRelations[]>([]);
  const [utilizationData, setUtilizationData] = useState<MachineUtilization[]>([]);
  const [plannedMoves, setPlannedMoves] = useState<PlannedMove[]>([]);
  const [suggestions, setSuggestions] = useState<LiftSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [hasRestoredPlan, setHasRestoredPlan] = useState(false);

  // UI State
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"compact" | "detailed">("detailed");
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [utilizationFilter, setUtilizationFilter] = useState<UtilizationFilter>("all");

  // Create utilization lookup map
  const utilizationMap = useMemo(() => {
    const map = new Map<string, MachineUtilization>();
    utilizationData.forEach((u) => map.set(u.machineId, u));
    return map;
  }, [utilizationData]);

  // Utilization summary for header
  const utilizationSummary = useMemo(() => {
    if (utilizationData.length === 0) return null;
    return {
      total: utilizationData.length,
      critical: utilizationData.filter((u) => u.utilizationStatus === "critical").length,
      low: utilizationData.filter((u) => u.utilizationStatus === "low").length,
      optimal: utilizationData.filter((u) => u.utilizationStatus === "optimal").length,
      high: utilizationData.filter((u) => u.utilizationStatus === "high").length,
      overworked: utilizationData.filter((u) => u.utilizationStatus === "overworked").length,
      liftCandidates: utilizationData.filter((u) => u.liftScore >= 70).length,
      expiringSoon: utilizationData.filter((u) => u.contractMonthsRemaining !== null && u.contractMonthsRemaining <= 3).length,
    };
  }, [utilizationData]);

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Save/Load functions
  const savePlan = useCallback((moves: PlannedMove[]) => {
    if (typeof window === "undefined") return;
    const plan: SavedPlan = { moves, savedAt: new Date().toISOString(), version: 2 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
    setLastSaved(new Date());
  }, []);

  const loadSavedPlan = useCallback((): SavedPlan | null => {
    if (typeof window === "undefined") return null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved) as SavedPlan;
    } catch (e) {
      console.error("Failed to load saved plan:", e);
    }
    return null;
  }, []);

  const clearSavedPlan = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
    setLastSaved(null);
  }, []);

  // Fetch data
  useEffect(() => {
    fetchData();
  }, []);

  // Auto-save
  useEffect(() => {
    if (plannedMoves.length > 0) {
      savePlan(plannedMoves);
    } else if (hasRestoredPlan) {
      clearSavedPlan();
    }
  }, [plannedMoves, savePlan, clearSavedPlan, hasRestoredPlan]);

  const fetchData = async () => {
    try {
      const [companiesRes, machinesRes, insightsRes, utilizationRes] = await Promise.all([
        fetch("/api/companies"),
        fetch("/api/machines?limit=10000&status=ACTIVE"),
        fetch("/api/dashboard/insights?period=90"),
        fetch("/api/machines/utilization?months=6"),
      ]);

      const companiesData = await companiesRes.json();
      const machinesData = await machinesRes.json();
      const insightsData = await insightsRes.json();
      const utilizationResponse = await utilizationRes.json();

      // Handle API error responses
      const companiesArray = Array.isArray(companiesData) ? companiesData : [];
      const storeList: Store[] = companiesArray.map((c: Store) => ({
        id: c.id,
        name: c.name,
        region: c.region,
        _count: c._count,
      }));

      setStores(storeList);
      setMachines(Array.isArray(machinesData?.data) ? machinesData.data : []);
      setSuggestions(insightsData?.insights?.liftSuggestions || []);
      setUtilizationData(Array.isArray(utilizationResponse?.machines) ? utilizationResponse.machines : []);

      // Auto-select first 4 stores
      if (storeList.length > 0) {
        setSelectedStores(storeList.slice(0, Math.min(4, storeList.length)).map((s) => s.id));
      }

      // Restore saved plan
      const savedPlan = loadSavedPlan();
      if (savedPlan && savedPlan.moves.length > 0) {
        setPlannedMoves(savedPlan.moves);
        setLastSaved(new Date(savedPlan.savedAt));
        setHasRestoredPlan(true);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get effective store for a machine
  const getMachineEffectiveStore = useCallback(
    (machineId: string, originalStoreId: string): string => {
      const move = plannedMoves.find((pm) => pm.machineId === machineId);
      return move ? move.toStoreId : originalStoreId;
    },
    [plannedMoves]
  );

  // Get machines for a store with utilization filter applied
  const getMachinesForStore = useCallback(
    (storeId: string): MachineWithRelations[] => {
      if (!storeId) return [];
      let storeMachines = machines.filter((m) => getMachineEffectiveStore(m.id, m.companyId) === storeId);

      // Apply utilization filter
      if (utilizationFilter !== "all") {
        storeMachines = storeMachines.filter((m) => {
          const util = utilizationMap.get(m.id);
          if (!util) return false;

          switch (utilizationFilter) {
            case "critical":
              return util.utilizationStatus === "critical";
            case "low":
              return util.utilizationStatus === "low";
            case "optimal":
              return util.utilizationStatus === "optimal";
            case "high":
              return util.utilizationStatus === "high";
            case "overworked":
              return util.utilizationStatus === "overworked";
            case "lift-candidates":
              return util.liftScore >= 70;
            case "expiring":
              return util.contractMonthsRemaining !== null && util.contractMonthsRemaining <= 3;
            default:
              return true;
          }
        });
      }

      // Sort by lift score (highest first) for better visibility
      storeMachines.sort((a, b) => {
        const utilA = utilizationMap.get(a.id);
        const utilB = utilizationMap.get(b.id);
        return (utilB?.liftScore || 0) - (utilA?.liftScore || 0);
      });

      return storeMachines;
    },
    [machines, getMachineEffectiveStore, utilizationFilter, utilizationMap]
  );

  // Find which store a machine belongs to (for drag)
  const findStoreForMachine = useCallback(
    (machineId: string): string | null => {
      const machine = machines.find((m) => m.id === machineId);
      if (!machine) return null;
      return getMachineEffectiveStore(machine.id, machine.companyId);
    },
    [machines, getMachineEffectiveStore]
  );

  // DnD Handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (over) {
      // Check if over a store column
      const overStore = selectedStores.find((s) => s === over.id);
      if (overStore) {
        setOverId(overStore);
      } else {
        // Check if over a machine (find its store)
        const overMachineStore = findStoreForMachine(over.id as string);
        setOverId(overMachineStore);
      }
    } else {
      setOverId(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (!over) return;

    const machineId = active.id as string;
    const machine = machines.find((m) => m.id === machineId);
    if (!machine) return;

    // Determine target store
    let targetStoreId: string | null = null;

    // If dropped on a store column
    if (selectedStores.includes(over.id as string)) {
      targetStoreId = over.id as string;
    } else {
      // If dropped on another machine, find its store
      targetStoreId = findStoreForMachine(over.id as string);
    }

    if (!targetStoreId) return;

    const currentStore = getMachineEffectiveStore(machine.id, machine.companyId);
    if (currentStore === targetStoreId) return;

    const fromStore = stores.find((s) => s.id === machine.companyId);
    const toStore = stores.find((s) => s.id === targetStoreId);
    if (!fromStore || !toStore) return;

    // Check for existing move
    const existingMoveIndex = plannedMoves.findIndex((pm) => pm.machineId === machine.id);

    if (existingMoveIndex !== -1) {
      // Moving back to original store - remove the move
      if (targetStoreId === machine.companyId) {
        setPlannedMoves((prev) => prev.filter((pm) => pm.machineId !== machine.id));
        return;
      }
      // Update destination
      setPlannedMoves((prev) =>
        prev.map((pm) =>
          pm.machineId === machine.id
            ? { ...pm, toStoreId: targetStoreId!, toStoreName: toStore.name }
            : pm
        )
      );
      return;
    }

    // Don't add if already at target
    if (machine.companyId === targetStoreId) return;

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
      toStoreId: targetStoreId,
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

  const handleExportExcel = () => {
    if (plannedMoves.length === 0) return;
    const exportData = plannedMoves.map((move) => ({
      serialNumber: move.machineSerialNumber,
      modelName: move.machineModelName,
      makeName: move.machineMakeName,
      category: move.machineCategoryName,
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
        { key: "category", header: "Category" },
        { key: "balance", header: "Balance" },
        { key: "fromStore", header: "From Store" },
        { key: "toStore", header: "To Store" },
      ],
      `lift-plan-${new Date().toISOString().split("T")[0]}`
    );
    setShowExportDialog(false);
  };

  const handleExportCSV = () => {
    if (plannedMoves.length === 0) return;
    const exportData = plannedMoves.map((move) => ({
      serialNumber: move.machineSerialNumber,
      modelName: move.machineModelName,
      makeName: move.machineMakeName,
      category: move.machineCategoryName,
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
        { key: "category", header: "Category" },
        { key: "balance", header: "Balance" },
        { key: "fromStore", header: "From Store" },
        { key: "toStore", header: "To Store" },
      ],
      `lift-plan-${new Date().toISOString().split("T")[0]}`
    );
    setShowExportDialog(false);
  };

  const handleApplySuggestion = (suggestion: LiftSuggestion) => {
    const storeId = suggestion.machine.company.id;
    if (!selectedStores.includes(storeId)) {
      setSelectedStores((prev) => [...prev.slice(0, 3), storeId]);
    }
  };

  const toggleStoreSelection = (storeId: string) => {
    setSelectedStores((prev) =>
      prev.includes(storeId)
        ? prev.filter((id) => id !== storeId)
        : [...prev, storeId]
    );
  };

  // Active drag machine
  const activeMachine = activeId ? machines.find((m) => m.id === activeId) : null;
  const activeUtilization = activeId ? utilizationMap.get(activeId as string) : undefined;

  // Group moves by store
  const movesByStore = useMemo(() => {
    const grouped: Record<string, PlannedMove[]> = {};
    plannedMoves.forEach((move) => {
      if (!grouped[move.fromStoreName]) grouped[move.fromStoreName] = [];
      grouped[move.fromStoreName].push(move);
    });
    return grouped;
  }, [plannedMoves]);

  if (isLoading) {
    return (
      <AppShell>
        <PageLoading variant="cards" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-shrink-0 px-4 py-3 border-b bg-background/95 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Lift Planner
                </h1>
                <p className="text-xs text-muted-foreground">
                  Drag machines between stores to plan fleet rebalancing
                </p>
              </div>

              {/* Utilization Summary Badges */}
              {utilizationSummary && (
                <div className="hidden lg:flex items-center gap-1.5">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200 cursor-help">
                          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                          {utilizationSummary.critical} critical
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>Machines under 20% utilization</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 cursor-help">
                          <Target className="h-2.5 w-2.5 mr-0.5" />
                          {utilizationSummary.liftCandidates} lift candidates
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>Machines with lift score ≥70</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {utilizationSummary.expiringSoon > 0 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200 cursor-help">
                            <Clock className="h-2.5 w-2.5 mr-0.5" />
                            {utilizationSummary.expiringSoon} expiring
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>Contracts expiring in ≤3 months</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              )}

              {/* Status indicators */}
              <div className="flex items-center gap-2">
                {plannedMoves.length > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center gap-2"
                  >
                    <Badge className="bg-primary/10 text-primary hover:bg-primary/20">
                      {plannedMoves.length} planned move{plannedMoves.length !== 1 ? "s" : ""}
                    </Badge>
                    {lastSaved && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        <span>Saved</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Utilization Filter */}
              <Select value={utilizationFilter} onValueChange={(v) => setUtilizationFilter(v as UtilizationFilter)}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <Filter className="h-3 w-3 mr-1" />
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Machines</SelectItem>
                  <SelectItem value="lift-candidates">
                    <span className="flex items-center gap-1">
                      <Target className="h-3 w-3 text-red-500" />
                      Lift Candidates
                    </span>
                  </SelectItem>
                  <SelectItem value="critical">
                    <span className="flex items-center gap-1">
                      <Activity className="h-3 w-3 text-red-500" />
                      Critical (&lt;20%)
                    </span>
                  </SelectItem>
                  <SelectItem value="low">
                    <span className="flex items-center gap-1">
                      <Activity className="h-3 w-3 text-amber-500" />
                      Low (20-40%)
                    </span>
                  </SelectItem>
                  <SelectItem value="optimal">
                    <span className="flex items-center gap-1">
                      <Activity className="h-3 w-3 text-emerald-500" />
                      Optimal (40-80%)
                    </span>
                  </SelectItem>
                  <SelectItem value="high">
                    <span className="flex items-center gap-1">
                      <Activity className="h-3 w-3 text-blue-500" />
                      High (80-100%)
                    </span>
                  </SelectItem>
                  <SelectItem value="overworked">
                    <span className="flex items-center gap-1">
                      <Activity className="h-3 w-3 text-purple-500" />
                      Overworked (&gt;100%)
                    </span>
                  </SelectItem>
                  <SelectItem value="expiring">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-purple-500" />
                      Expiring Soon
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Search */}
              <div className="relative w-40">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>

              {/* View toggle */}
              <div className="flex items-center border rounded-md">
                <Button
                  variant={viewMode === "detailed" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-2 rounded-r-none"
                  onClick={() => setViewMode("detailed")}
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={viewMode === "compact" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-2 rounded-l-none"
                  onClick={() => setViewMode("compact")}
                >
                  <EyeOff className="h-3.5 w-3.5" />
                </Button>
              </div>

              {plannedMoves.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => setShowClearDialog(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Clear
                  </Button>
                  <Button size="sm" className="h-8" onClick={() => setShowExportDialog(true)}>
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Export
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Restored Plan Notice */}
          <AnimatePresence>
            {hasRestoredPlan && plannedMoves.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-center justify-between"
              >
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
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Store Selector */}
        <div className="flex-shrink-0 px-4 py-2 border-b bg-muted/30">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Stores:
            </span>
            {stores.map((store) => {
              const isSelected = selectedStores.includes(store.id);
              const machineCount = getMachinesForStore(store.id).length;
              return (
                <Button
                  key={store.id}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-7 text-xs whitespace-nowrap transition-all",
                    isSelected && "shadow-md"
                  )}
                  onClick={() => toggleStoreSelection(store.id)}
                >
                  {store.name}
                  <Badge
                    variant="secondary"
                    className={cn(
                      "ml-1.5 text-[10px] px-1 py-0",
                      isSelected && "bg-white/20"
                    )}
                  >
                    {machineCount}
                  </Badge>
                </Button>
              );
            })}
          </div>
        </div>

        {/* AI Lift Candidates (using real utilization data) */}
        <AnimatePresence>
          {showSuggestions && utilizationData.length > 0 && plannedMoves.length === 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex-shrink-0 px-4 py-2 border-b bg-gradient-to-r from-purple-50 to-indigo-50"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-900">Top Lift Candidates</span>
                  <Badge variant="secondary" className="text-[10px] bg-purple-100 text-purple-700">
                    Based on utilization analysis
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setShowSuggestions(false)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {utilizationData
                  .filter((u) => u.liftScore >= 60)
                  .slice(0, 6)
                  .map((util, idx) => {
                    const statusConfig = utilizationConfig[util.utilizationStatus];
                    return (
                      <TooltipProvider key={util.machineId}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <motion.div
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.05 }}
                              className="flex-shrink-0 p-2 bg-white rounded-lg border shadow-sm cursor-pointer hover:shadow-md transition-shadow min-w-[180px]"
                              onClick={() => {
                                if (!selectedStores.includes(util.companyId)) {
                                  setSelectedStores((prev) => [...prev.slice(0, 3), util.companyId]);
                                }
                                setUtilizationFilter("lift-candidates");
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "p-1.5 rounded",
                                  util.liftScore >= 80 ? "bg-red-100" : "bg-amber-100"
                                )}>
                                  <Target className={cn(
                                    "h-3 w-3",
                                    util.liftScore >= 80 ? "text-red-600" : "text-amber-600"
                                  )} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs font-mono font-medium truncate">{util.serialNumber}</p>
                                    <Badge variant="outline" className={cn("text-[9px] px-1", statusConfig.color)}>
                                      {util.liftScore}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                    <span className={statusConfig.color}>{util.utilizationPercent}%</span>
                                    <span>·</span>
                                    <span className="truncate">{util.companyName}</span>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-[250px]">
                            <div className="space-y-1">
                              <p className="font-medium text-xs">{util.modelName || "Unknown Model"}</p>
                              {util.insights.slice(0, 3).map((insight, i) => (
                                <p key={i} className="text-[11px] text-muted-foreground">• {insight}</p>
                              ))}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Kanban Board */}
        <div className="flex-1 overflow-hidden p-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="h-full flex gap-4 overflow-x-auto pb-4">
              {selectedStores.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 flex items-center justify-center"
                >
                  <div className="text-center">
                    <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No stores selected</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Select stores above to start planning machine moves
                    </p>
                  </div>
                </motion.div>
              ) : (
                selectedStores.map((storeId) => {
                  const store = stores.find((s) => s.id === storeId);
                  if (!store) return null;
                  return (
                    <StoreColumn
                      key={store.id}
                      store={store}
                      machines={getMachinesForStore(store.id)}
                      utilizationMap={utilizationMap}
                      plannedMoves={plannedMoves}
                      onRemoveMove={handleRemoveMove}
                      isDropTarget={overId === store.id}
                      viewMode={viewMode}
                      searchQuery={searchQuery}
                    />
                  );
                })
              )}
            </div>

            <DragOverlay>
              {activeMachine && <MachineCardOverlay machine={activeMachine} utilization={activeUtilization} />}
            </DragOverlay>
          </DndContext>
        </div>

        {/* Bottom Summary Bar */}
        <AnimatePresence>
          {plannedMoves.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex-shrink-0 px-4 py-3 border-t bg-gradient-to-r from-emerald-50 to-teal-50"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-emerald-500/10">
                      <Printer className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-emerald-900">
                        {plannedMoves.length} Machine{plannedMoves.length !== 1 ? "s" : ""} to Move
                      </p>
                      <p className="text-xs text-emerald-700">
                        From {Object.keys(movesByStore).length} store{Object.keys(movesByStore).length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  {/* Quick summary chips */}
                  <div className="hidden md:flex items-center gap-2">
                    {Object.entries(movesByStore).slice(0, 3).map(([storeName, moves]) => (
                      <Badge
                        key={storeName}
                        variant="outline"
                        className="text-[10px] bg-white/80"
                      >
                        {storeName}: {moves.length}
                      </Badge>
                    ))}
                    {Object.keys(movesByStore).length > 3 && (
                      <Badge variant="outline" className="text-[10px] bg-white/80">
                        +{Object.keys(movesByStore).length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white/80"
                    onClick={() => setShowClearDialog(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Clear All
                  </Button>
                  <Button size="sm" onClick={() => setShowExportDialog(true)}>
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Export Plan
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
            <AlertDialogAction
              onClick={handleClearAllMoves}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export Move Plan
            </DialogTitle>
            <DialogDescription>
              {plannedMoves.length} machines from {Object.keys(movesByStore).length} stores
            </DialogDescription>
          </DialogHeader>

          {/* Plan summary */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {Object.entries(movesByStore).map(([storeName, moves]) => (
              <div key={storeName} className="rounded-lg border p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{storeName}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {moves.length} machine{moves.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <div className="space-y-1">
                  {moves.map((move) => (
                    <div
                      key={move.id}
                      className="flex items-center gap-2 text-xs text-muted-foreground"
                    >
                      <span className="font-mono">{move.machineSerialNumber}</span>
                      <ArrowRight className="h-3 w-3 text-primary" />
                      <span className="font-medium text-foreground">{move.toStoreName}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>
              Cancel
            </Button>
            <Button variant="outline" onClick={handleExportCSV}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              CSV
            </Button>
            <Button onClick={handleExportExcel}>
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
              Excel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
