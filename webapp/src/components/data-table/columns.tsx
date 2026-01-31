"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { ArrowRight, Printer, Banknote } from "lucide-react";
import { formatNumber, formatDate, cn } from "@/lib/utils";
import type { MachineWithUtilization } from "@/types";

function formatRate(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${(value * 100).toFixed(2)}c`;
}

function formatCostShort(value: number): string {
  if (value === 0) return "—";
  if (value < 1000) return `R${value.toFixed(0)}`;
  if (value < 1000000) return `R${(value / 1000).toFixed(1)}k`;
  return `R${(value / 1000000).toFixed(2)}m`;
}

export interface StoreOption {
  id: string;
  name: string;
}

const ACTION_OPTIONS = [
  { value: "NONE", label: "None", color: "" },
  { value: "TERMINATE", label: "Terminate", color: "text-red-700" },
  { value: "TERMINATE_UPGRADE", label: "Terminate & Upgrade", color: "text-orange-700" },
  { value: "STAY", label: "Stay", color: "text-emerald-700" },
  { value: "MOVE", label: "Move", color: "text-blue-700" },
] as const;

const ACTION_COLORS: Record<string, string> = {
  NONE: "",
  TERMINATE: "text-red-700 font-medium",
  TERMINATE_UPGRADE: "text-orange-700 font-medium",
  STAY: "text-emerald-700 font-medium",
  MOVE: "text-blue-700 font-medium",
};

export function createMachineColumns(
  stores: StoreOption[] = [],
  modelNames: string[] = [],
  onActionChange?: (machineId: string, action: string, extra?: Record<string, string>) => void,
  onNavigate?: (machineId: string) => void,
): ColumnDef<MachineWithUtilization>[] {
  const handleActionUpdate = (machineId: string, field: string, value: string) => {
    if (field === "action") {
      onActionChange?.(machineId, value);
    } else {
      onActionChange?.(machineId, "UPDATE_FIELD", { [field]: value });
    }
  };

  return [
    // --- Core identification ---
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
      filterFn: (row, id, value) => row.original.company?.name === value,
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
      filterFn: (row, id, value) => row.original.category?.name === value,
    },
    {
      accessorKey: "modelName",
      header: "Model",
      cell: ({ row }) => (
        <span className="text-sm truncate max-w-[150px] block">
          {row.getValue("modelName") || "-"}
        </span>
      ),
      filterFn: (row, id, value) => row.original.modelName === value,
    },

    // --- Volume group: MTD, 3M, 6M, 12M, Monthly Avg, Balance ---
    {
      id: "volumeMtd",
      accessorFn: (row) => row.utilization?.volumeMtd ?? 0,
      header: "MTD Vol",
      cell: ({ row }) => {
        const u = row.original.utilization;
        if (!u) return <span className="text-muted-foreground text-xs">—</span>;
        return <span className="font-mono text-xs">{formatNumber(u.volumeMtd)}</span>;
      },
    },
    {
      id: "volume3m",
      accessorFn: (row) => row.utilization?.volume3m ?? 0,
      header: "3M Vol",
      cell: ({ row }) => {
        const u = row.original.utilization;
        if (!u) return <span className="text-muted-foreground text-xs">—</span>;
        return <span className="font-mono text-xs">{formatNumber(u.volume3m)}</span>;
      },
    },
    {
      id: "volume6m",
      accessorFn: (row) => row.utilization?.volume6m ?? 0,
      header: "6M Vol",
      cell: ({ row }) => {
        const u = row.original.utilization;
        if (!u) return <span className="text-muted-foreground text-xs">—</span>;
        return <span className="font-mono text-xs">{formatNumber(u.volume6m)}</span>;
      },
    },
    {
      id: "volume12m",
      accessorFn: (row) => row.utilization?.volume12m ?? 0,
      header: "12M Vol",
      cell: ({ row }) => {
        const u = row.original.utilization;
        if (!u) return <span className="text-muted-foreground text-xs">—</span>;
        return <span className="font-mono text-xs">{formatNumber(u.volume12m)}</span>;
      },
    },
    {
      id: "avgMonthlyVolume",
      accessorFn: (row) => row.utilization?.avgMonthlyVolume ?? 0,
      header: "Monthly Avg",
      cell: ({ row }) => {
        const u = row.original.utilization;
        if (!u) return <span className="text-muted-foreground text-xs">—</span>;
        return <span className="font-mono text-xs">{formatNumber(u.avgMonthlyVolume)}</span>;
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

    // --- Rates ---
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
                <span className="font-mono text-xs text-gray-700">{formatRate(rate.a4Mono)}</span>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <p className="font-medium">A4 Mono Rate</p>
                  <p className="text-xs text-muted-foreground">Effective: {formatDate(rate.ratesFrom)}</p>
                  {rate.a3Mono && <p className="text-xs">A3 Mono: {formatRate(rate.a3Mono)}</p>}
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
                <span className="font-mono text-xs text-blue-700">{formatRate(rate.a4Colour)}</span>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <p className="font-medium">A4 Colour Rate</p>
                  <p className="text-xs text-muted-foreground">Effective: {formatDate(rate.ratesFrom)}</p>
                  {rate.a3Colour && <p className="text-xs">A3 Colour: {formatRate(rate.a3Colour)}</p>}
                  {rate.colourExtraLarge && <p className="text-xs">Extra Large: {formatRate(rate.colourExtraLarge)}</p>}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },

    // --- FSMA Cost ---
    {
      id: "monthlyCost",
      accessorFn: (row) => row.utilization?.monthlyCost ?? 0,
      header: "FSMA Cost",
      cell: ({ row }) => {
        const utilization = row.original.utilization;
        if (!utilization?.hasRates || utilization.monthlyCost === 0) {
          return <span className="text-muted-foreground text-xs">—</span>;
        }
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1">
                  <Banknote className="h-3 w-3 text-red-600" />
                  <span className="font-mono text-xs font-medium text-red-700">
                    {formatCostShort(utilization.monthlyCost)}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <p className="font-medium">Monthly FSMA Lease Cost (Volume × Rates)</p>
                  <div className="text-xs space-y-0.5">
                    <p className="text-gray-600">
                      Mono: R{utilization.monoCost.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-blue-600">
                      Colour: R{utilization.colourCost.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                    </p>
                    <hr className="my-1" />
                    <p className="font-medium">
                      Total: R{utilization.monthlyCost.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },

    // --- Action ---
    {
      id: "action",
      accessorFn: (row) => row.action || "NONE",
      header: "Action",
      cell: ({ row }) => {
        const machine = row.original;
        const currentAction = machine.action || "NONE";
        const colorClass = ACTION_COLORS[currentAction] || "";

        return (
          <Select
            value={currentAction}
            onValueChange={(value) => handleActionUpdate(machine.id, "action", value)}
          >
            <SelectTrigger className="h-7 w-[160px] text-xs">
              <SelectValue>
                <span className={colorClass}>
                  {ACTION_OPTIONS.find((o) => o.value === currentAction)?.label || "Select action"}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ACTION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <span className={opt.color}>{opt.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      },
      filterFn: (row, id, value) => (row.original.action || "NONE") === value,
    },

    // --- Action Result (contextual: store dropdown for Move, model dropdown for Upgrade) ---
    {
      id: "actionResult",
      accessorFn: (row) => {
        if (row.action === "MOVE") {
          return stores.find((s) => s.id === row.moveToCompanyId)?.name || "";
        }
        if (row.action === "TERMINATE_UPGRADE") {
          return row.upgradeTo || "";
        }
        return "";
      },
      header: "Action Detail",
      cell: ({ row }) => {
        const machine = row.original;

        // Move → store dropdown
        if (machine.action === "MOVE") {
          const availableStores = stores.filter((s) => s.id !== machine.companyId);
          const currentTarget = stores.find((s) => s.id === machine.moveToCompanyId);
          return (
            <Select
              value={machine.moveToCompanyId || ""}
              onValueChange={(value) => handleActionUpdate(machine.id, "moveToCompanyId", value)}
            >
              <SelectTrigger className={cn("h-7 w-[150px] text-xs", machine.moveToCompanyId && "border-blue-500 bg-blue-50")}>
                <SelectValue placeholder="Select store">
                  {currentTarget ? (
                    <span className="text-blue-700">{currentTarget.name}</span>
                  ) : (
                    <span className="text-muted-foreground">Select store</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {availableStores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }

        // Terminate & Upgrade → model dropdown from existing fleet
        if (machine.action === "TERMINATE_UPGRADE") {
          return (
            <Select
              value={machine.upgradeTo || ""}
              onValueChange={(value) => handleActionUpdate(machine.id, "upgradeTo", value)}
            >
              <SelectTrigger className={cn("h-7 w-[150px] text-xs", machine.upgradeTo && "border-orange-500 bg-orange-50")}>
                <SelectValue placeholder="Select model">
                  {machine.upgradeTo ? (
                    <span className="text-orange-700">{machine.upgradeTo}</span>
                  ) : (
                    <span className="text-muted-foreground">Select model</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {modelNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }

        return <span className="text-muted-foreground text-xs">—</span>;
      },
    },

    // --- Contract ---
    {
      accessorKey: "rentalMonthsRemaining",
      header: "Contract",
      cell: ({ row }) => {
        const months = row.getValue("rentalMonthsRemaining") as number | null;
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

    // --- Lifted ---
    {
      accessorKey: "isLifted",
      header: "Lifted",
      cell: ({ row }) => (
        <Badge variant={row.getValue("isLifted") ? "destructive" : "outline"} className="text-[10px]">
          {row.getValue("isLifted") ? "Yes" : "No"}
        </Badge>
      ),
    },

    // --- Date columns ---
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
      accessorKey: "lastReadingDate",
      header: "Last Reading",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {formatDate(row.getValue("lastReadingDate"))}
        </span>
      ),
    },

    // --- Navigate arrow (replaces triple-dot menu) ---
    {
      id: "navigate",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate?.(row.original.id);
          }}
        >
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Button>
      ),
    },
  ];
}

export const machineColumns = createMachineColumns();
