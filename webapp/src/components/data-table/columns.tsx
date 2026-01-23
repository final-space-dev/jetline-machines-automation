"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MoreHorizontal, ExternalLink, ArrowUpRight, Printer, TrendingUp, TrendingDown, Minus, Target, MoveRight, Banknote } from "lucide-react";
import { formatNumber, formatDate, cn } from "@/lib/utils";
import type { MachineWithUtilization, MachineRate } from "@/types";

// Helper to format rate values (cents to currency display)
function formatRate(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  // Rates are stored as decimals (e.g., 0.035 for 3.5 cents)
  // Display as cents with 2 decimal places
  return `${(value * 100).toFixed(2)}c`;
}

// Helper to format revenue values (ZAR)
function formatRevenueShort(value: number): string {
  if (value === 0) return "—";
  if (value < 1000) return `R${value.toFixed(0)}`;
  if (value < 1000000) return `R${(value / 1000).toFixed(1)}k`;
  return `R${(value / 1000000).toFixed(2)}m`;
}

// Helper to get primary rate based on category
function getPrimaryRate(rate: MachineRate | undefined, category: string | null): { mono: number | null; colour: number | null } {
  if (!rate) return { mono: null, colour: null };
  return {
    mono: rate.a4Mono,
    colour: rate.a4Colour,
  };
}

// Store type for lift dropdown
export interface StoreOption {
  id: string;
  name: string;
}

// Lift plan entry stored in localStorage
export interface LiftPlanEntry {
  machineId: string;
  serialNumber: string;
  fromStoreId: string;
  fromStoreName: string;
  toStoreId: string;
  toStoreName: string;
  addedAt: string;
}

const LIFT_PLAN_STORAGE_KEY = "jetline-lift-plan-inline";

const utilizationConfig: Record<string, { color: string; bgColor: string; badgeBg: string }> = {
  critical: { color: "text-red-600", bgColor: "bg-red-500", badgeBg: "bg-red-100 text-red-700 border-red-300" },
  low: { color: "text-amber-600", bgColor: "bg-amber-500", badgeBg: "bg-amber-100 text-amber-700 border-amber-300" },
  optimal: { color: "text-emerald-600", bgColor: "bg-emerald-500", badgeBg: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  high: { color: "text-blue-600", bgColor: "bg-blue-500", badgeBg: "bg-blue-100 text-blue-700 border-blue-300" },
  overworked: { color: "text-purple-600", bgColor: "bg-purple-500", badgeBg: "bg-purple-100 text-purple-700 border-purple-300" },
};

// Helper functions for lift plan localStorage
export function getLiftPlan(): LiftPlanEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(LIFT_PLAN_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveLiftPlan(plan: LiftPlanEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LIFT_PLAN_STORAGE_KEY, JSON.stringify(plan));
}

export function addToLiftPlan(entry: Omit<LiftPlanEntry, "addedAt">): void {
  const plan = getLiftPlan();
  // Remove existing entry for this machine if any
  const filtered = plan.filter(e => e.machineId !== entry.machineId);
  filtered.push({ ...entry, addedAt: new Date().toISOString() });
  saveLiftPlan(filtered);
}

export function removeFromLiftPlan(machineId: string): void {
  const plan = getLiftPlan();
  saveLiftPlan(plan.filter(e => e.machineId !== machineId));
}

export function getLiftPlanForMachine(machineId: string): LiftPlanEntry | undefined {
  return getLiftPlan().find(e => e.machineId === machineId);
}

// Column generator function - accepts stores for lift dropdown
export function createMachineColumns(
  stores: StoreOption[] = [],
  onLiftChange?: (machineId: string, toStoreId: string | null) => void
): ColumnDef<MachineWithUtilization>[] {
  return [
  {
    accessorKey: "serialNumber",
    header: "Serial Number",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Printer className="h-4 w-4 text-muted-foreground" />
        <span className="font-mono text-sm">{row.getValue("serialNumber")}</span>
      </div>
    ),
  },
  {
    id: "companyName",
    accessorFn: (row) => row.company?.name,
    header: "Store",
    cell: ({ row }) => row.original.company?.name || "-",
    filterFn: (row, id, value) => {
      return row.original.company?.name === value;
    },
  },
  {
    id: "categoryName",
    accessorFn: (row) => row.category?.name,
    header: "Category",
    cell: ({ row }) => {
      const category = row.original.category?.name;
      if (!category) return <span className="text-muted-foreground">-</span>;

      const colors: Record<string, string> = {
        "Colour": "bg-blue-100 text-blue-800",
        "Black and White": "bg-gray-100 text-gray-800",
        "Plan": "bg-purple-100 text-purple-800",
        "Office Machine": "bg-green-100 text-green-800",
      };

      return (
        <Badge variant="outline" className={colors[category] || ""}>
          {category}
        </Badge>
      );
    },
    filterFn: (row, id, value) => {
      return row.original.category?.name === value;
    },
  },
  {
    accessorKey: "modelName",
    header: "Model",
    cell: ({ row }) => (
      <span className="text-sm truncate max-w-[150px] block">
        {row.getValue("modelName") || "-"}
      </span>
    ),
  },
  {
    id: "utilizationPercent",
    accessorFn: (row) => row.utilization?.utilizationPercent ?? -1,
    header: "Utilization",
    cell: ({ row }) => {
      const utilization = row.original.utilization;
      if (!utilization) return <span className="text-muted-foreground text-xs">—</span>;

      const config = utilizationConfig[utilization.utilizationStatus];

      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <div className="w-16">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={cn("text-xs font-medium", config.color)}>
                      {utilization.utilizationPercent}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", config.bgColor)}
                      style={{ width: `${Math.min(utilization.utilizationPercent, 100)}%` }}
                    />
                  </div>
                </div>
                {utilization.trendDirection === "up" && (
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                )}
                {utilization.trendDirection === "down" && (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                {utilization.trendDirection === "stable" && (
                  <Minus className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                <p className="font-medium">{utilization.utilizationPercent}% of duty cycle</p>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(utilization.avgMonthlyVolume)}/mo avg · {formatNumber(utilization.dutyCycle)} duty
                </p>
                {utilization.volumeTrend !== 0 && (
                  <p className="text-xs">
                    Trend: {utilization.volumeTrend > 0 ? "+" : ""}{utilization.volumeTrend}%
                  </p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    },
    filterFn: (row, id, value) => {
      const status = row.original.utilization?.utilizationStatus;
      return status === value;
    },
  },
  {
    id: "avgMonthlyVolume",
    accessorFn: (row) => row.utilization?.avgMonthlyVolume ?? 0,
    header: "Monthly Avg",
    cell: ({ row }) => {
      const utilization = row.original.utilization;
      if (!utilization) return <span className="text-muted-foreground text-xs">—</span>;

      return (
        <span className="font-mono text-xs">
          {formatNumber(utilization.avgMonthlyVolume)}
        </span>
      );
    },
  },
  {
    id: "rateA4Mono",
    accessorFn: (row) => row.currentRate?.a4Mono ?? null,
    header: "A4 Mono",
    cell: ({ row }) => {
      const rate = row.original.currentRate;
      if (!rate?.a4Mono) return <span className="text-muted-foreground text-xs">—</span>;

      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-mono text-xs text-gray-700">
                {formatRate(rate.a4Mono)}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                <p className="font-medium">A4 Mono Rate</p>
                <p className="text-xs text-muted-foreground">
                  Effective: {formatDate(rate.ratesFrom)}
                </p>
                {rate.a3Mono && (
                  <p className="text-xs">A3 Mono: {formatRate(rate.a3Mono)}</p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    },
  },
  {
    id: "rateA4Colour",
    accessorFn: (row) => row.currentRate?.a4Colour ?? null,
    header: "A4 Colour",
    cell: ({ row }) => {
      const rate = row.original.currentRate;
      if (!rate?.a4Colour) return <span className="text-muted-foreground text-xs">—</span>;

      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-mono text-xs text-blue-700">
                {formatRate(rate.a4Colour)}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                <p className="font-medium">A4 Colour Rate</p>
                <p className="text-xs text-muted-foreground">
                  Effective: {formatDate(rate.ratesFrom)}
                </p>
                {rate.a3Colour && (
                  <p className="text-xs">A3 Colour: {formatRate(rate.a3Colour)}</p>
                )}
                {rate.colourExtraLarge && (
                  <p className="text-xs">Extra Large: {formatRate(rate.colourExtraLarge)}</p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    },
  },
  {
    id: "monthlyRevenue",
    accessorFn: (row) => row.utilization?.monthlyRevenue ?? 0,
    header: "Monthly Rev",
    cell: ({ row }) => {
      const utilization = row.original.utilization;
      if (!utilization?.hasRates || utilization.monthlyRevenue === 0) {
        return <span className="text-muted-foreground text-xs">—</span>;
      }

      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1">
                <Banknote className="h-3 w-3 text-emerald-600" />
                <span className="font-mono text-xs font-medium text-emerald-700">
                  {formatRevenueShort(utilization.monthlyRevenue)}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                <p className="font-medium">Monthly Revenue (Volume × Rates)</p>
                <div className="text-xs space-y-0.5">
                  <p className="text-gray-600">
                    Mono: R{utilization.monoRevenue.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-blue-600">
                    Colour: R{utilization.colourRevenue.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                  </p>
                  <hr className="my-1" />
                  <p className="font-medium">
                    Total: R{utilization.monthlyRevenue.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    },
  },
  {
    id: "liftScore",
    accessorFn: (row) => row.utilization?.liftScore ?? 0,
    header: "Lift",
    cell: ({ row }) => {
      const utilization = row.original.utilization;
      if (!utilization || utilization.liftScore < 50) {
        return <span className="text-muted-foreground text-xs">—</span>;
      }

      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] px-1.5 py-0",
                  utilization.liftScore >= 80
                    ? "bg-red-100 text-red-700 border-red-300"
                    : utilization.liftScore >= 60
                      ? "bg-amber-100 text-amber-700 border-amber-300"
                      : "bg-gray-100 text-gray-700 border-gray-300"
                )}
              >
                <Target className="h-2.5 w-2.5 mr-0.5" />
                {utilization.liftScore}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1 max-w-[200px]">
                <p className="font-medium">Lift Score: {utilization.liftScore}/100</p>
                {utilization.insights.slice(0, 2).map((insight, idx) => (
                  <p key={idx} className="text-xs text-muted-foreground">• {insight}</p>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
        ACTIVE: "default",
        INACTIVE: "secondary",
        MAINTENANCE: "outline",
        DECOMMISSIONED: "destructive",
      };
      return <Badge variant={variants[status] || "outline"} className="text-[10px]">{status}</Badge>;
    },
    filterFn: (row, id, value) => {
      return row.getValue("status") === value;
    },
  },
  {
    accessorKey: "currentBalance",
    header: "Balance",
    cell: ({ row }) => (
      <span className="font-mono text-right block text-xs">
        {formatNumber(row.getValue("currentBalance"))}
      </span>
    ),
  },
  {
    accessorKey: "rentalMonthsRemaining",
    header: "Contract",
    cell: ({ row }) => {
      const months = row.getValue("rentalMonthsRemaining") as number | null;
      // Out of Contract: null, 0, or negative months
      if (months === null || months <= 0) {
        return (
          <Badge variant="outline" className="text-[10px] bg-gray-100 text-gray-600 border-gray-300">
            OOC
          </Badge>
        );
      }
      return (
        <Badge variant={months <= 3 ? "destructive" : months <= 12 ? "outline" : "secondary"} className="text-[10px]">
          {months}mo
        </Badge>
      );
    },
  },
  {
    accessorKey: "installDate",
    header: "Installed",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {formatDate(row.getValue("installDate"))}
      </span>
    ),
  },
  {
    accessorKey: "isLifted",
    header: "Lifted",
    cell: ({ row }) => (
      <Badge variant={row.getValue("isLifted") ? "destructive" : "outline"} className="text-[10px]">
        {row.getValue("isLifted") ? "Yes" : "No"}
      </Badge>
    ),
  },
  {
    accessorKey: "lastReadingDate",
    header: "Last Reading",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {formatDate(row.getValue("lastReadingDate"))}
      </span>
    ),
  },
  // Inline lift dropdown - only shown if stores are provided
  ...(stores.length > 0 ? [{
    id: "liftTo",
    header: "Lift To",
    cell: ({ row }: { row: { original: MachineWithUtilization } }) => {
      const machine = row.original;
      const currentStoreId = machine.company?.id;
      const currentStoreName = machine.company?.name || "Unknown";

      // Filter out current store from options
      const availableStores = stores.filter(s => s.id !== currentStoreId);

      // Check if this machine has a planned lift
      const existingPlan = getLiftPlanForMachine(machine.id);

      return (
        <Select
          value={existingPlan?.toStoreId || ""}
          onValueChange={(value) => {
            if (value === "__clear__") {
              removeFromLiftPlan(machine.id);
              onLiftChange?.(machine.id, null);
            } else if (value) {
              const toStore = stores.find(s => s.id === value);
              if (toStore) {
                addToLiftPlan({
                  machineId: machine.id,
                  serialNumber: machine.serialNumber,
                  fromStoreId: currentStoreId || "",
                  fromStoreName: currentStoreName,
                  toStoreId: toStore.id,
                  toStoreName: toStore.name,
                });
                onLiftChange?.(machine.id, value);
              }
            }
          }}
        >
          <SelectTrigger className={cn(
            "h-7 w-[130px] text-xs",
            existingPlan && "border-emerald-500 bg-emerald-50"
          )}>
            <SelectValue placeholder="Select store">
              {existingPlan ? (
                <span className="flex items-center gap-1 text-emerald-700">
                  <MoveRight className="h-3 w-3" />
                  {existingPlan.toStoreName}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {existingPlan && (
              <SelectItem value="__clear__" className="text-red-600">
                Clear lift plan
              </SelectItem>
            )}
            {availableStores.map((store) => (
              <SelectItem key={store.id} value={store.id}>
                {store.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    },
  }] as ColumnDef<MachineWithUtilization>[] : []),
  {
    id: "actions",
    cell: ({ row }) => {
      const machine = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(machine.serialNumber)}>
              Copy serial number
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <ExternalLink className="h-4 w-4 mr-2" />
              View details
            </DropdownMenuItem>
            <DropdownMenuItem>
              <ArrowUpRight className="h-4 w-4 mr-2" />
              Lift machine
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
  ];
}

// Backwards compatible export - columns without lift dropdown
export const machineColumns = createMachineColumns();
