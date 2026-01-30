"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { MoreHorizontal, ExternalLink, Printer, Banknote } from "lucide-react";
import { formatNumber, formatDate, cn } from "@/lib/utils";
import type { MachineWithUtilization, MachineRate } from "@/types";

// Helper to format rate values (cents to currency display)
function formatRate(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${(value * 100).toFixed(2)}c`;
}

// Helper to format cost values (ZAR)
function formatCostShort(value: number): string {
  if (value === 0) return "—";
  if (value < 1000) return `R${value.toFixed(0)}`;
  if (value < 1000000) return `R${(value / 1000).toFixed(1)}k`;
  return `R${(value / 1000000).toFixed(2)}m`;
}

// Store type for move dropdown
export interface StoreOption {
  id: string;
  name: string;
}

// Action labels
const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  NONE: { label: "—", color: "" },
  TERMINATE: { label: "Terminate", color: "bg-red-100 text-red-700 border-red-300" },
  TERMINATE_UPGRADE: { label: "Terminate & Upgrade", color: "bg-orange-100 text-orange-700 border-orange-300" },
  STAY: { label: "Stay", color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  MOVE: { label: "Move", color: "bg-blue-100 text-blue-700 border-blue-300" },
};

// Inline editable upgrade cell
function UpgradeToCell({
  machine,
  onUpdate,
}: {
  machine: MachineWithUtilization;
  onUpdate: (machineId: string, field: string, value: string) => void;
}) {
  const [value, setValue] = useState(machine.upgradeTo || "");
  const [editing, setEditing] = useState(false);

  if (machine.action !== "TERMINATE_UPGRADE") {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  if (editing) {
    return (
      <Input
        className="h-7 w-[140px] text-xs"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          setEditing(false);
          onUpdate(machine.id, "upgradeTo", value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setEditing(false);
            onUpdate(machine.id, "upgradeTo", value);
          }
        }}
        autoFocus
        placeholder="Model name..."
      />
    );
  }

  return (
    <button
      className="text-xs text-orange-700 underline underline-offset-2 hover:text-orange-900"
      onClick={() => setEditing(true)}
    >
      {machine.upgradeTo || "Set model"}
    </button>
  );
}

// Inline move-to cell
function MoveToCell({
  machine,
  stores,
  onUpdate,
}: {
  machine: MachineWithUtilization;
  stores: StoreOption[];
  onUpdate: (machineId: string, field: string, value: string) => void;
}) {
  if (machine.action !== "MOVE") {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const availableStores = stores.filter((s) => s.id !== machine.companyId);
  const currentTarget = stores.find((s) => s.id === machine.moveToCompanyId);

  return (
    <Select
      value={machine.moveToCompanyId || ""}
      onValueChange={(value) => onUpdate(machine.id, "moveToCompanyId", value)}
    >
      <SelectTrigger className={cn("h-7 w-[130px] text-xs", machine.moveToCompanyId && "border-blue-500 bg-blue-50")}>
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

// Column generator function
export function createMachineColumns(
  stores: StoreOption[] = [],
  onActionChange?: (machineId: string, action: string, extra?: Record<string, string>) => void
): ColumnDef<MachineWithUtilization>[] {
  const handleActionUpdate = (machineId: string, field: string, value: string) => {
    if (field === "action") {
      onActionChange?.(machineId, value);
    } else {
      // For upgradeTo or moveToCompanyId updates
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
      filterFn: (row, id, value) => {
        const modelName = row.original.modelName;
        return modelName === value;
      },
    },

    // --- Volume columns (MTD, 3M, 6M, 12M) ---
    {
      id: "volumeMtd",
      accessorFn: (row) => row.utilization?.volumeMtd ?? 0,
      header: "MTD Vol",
      cell: ({ row }) => {
        const utilization = row.original.utilization;
        if (!utilization) return <span className="text-muted-foreground text-xs">—</span>;
        return <span className="font-mono text-xs">{formatNumber(utilization.volumeMtd)}</span>;
      },
    },
    {
      id: "volume3m",
      accessorFn: (row) => row.utilization?.volume3m ?? 0,
      header: "3M Vol",
      cell: ({ row }) => {
        const utilization = row.original.utilization;
        if (!utilization) return <span className="text-muted-foreground text-xs">—</span>;
        return <span className="font-mono text-xs">{formatNumber(utilization.volume3m)}</span>;
      },
    },
    {
      id: "volume6m",
      accessorFn: (row) => row.utilization?.volume6m ?? 0,
      header: "6M Vol",
      cell: ({ row }) => {
        const utilization = row.original.utilization;
        if (!utilization) return <span className="text-muted-foreground text-xs">—</span>;
        return <span className="font-mono text-xs">{formatNumber(utilization.volume6m)}</span>;
      },
    },
    {
      id: "volume12m",
      accessorFn: (row) => row.utilization?.volume12m ?? 0,
      header: "12M Vol",
      cell: ({ row }) => {
        const utilization = row.original.utilization;
        if (!utilization) return <span className="text-muted-foreground text-xs">—</span>;
        return <span className="font-mono text-xs">{formatNumber(utilization.volume12m)}</span>;
      },
    },

    // --- Monthly average ---
    {
      id: "avgMonthlyVolume",
      accessorFn: (row) => row.utilization?.avgMonthlyVolume ?? 0,
      header: "Monthly Avg",
      cell: ({ row }) => {
        const utilization = row.original.utilization;
        if (!utilization) return <span className="text-muted-foreground text-xs">—</span>;
        return <span className="font-mono text-xs">{formatNumber(utilization.avgMonthlyVolume)}</span>;
      },
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

    // --- Action status (replaces old Status) ---
    {
      id: "action",
      accessorFn: (row) => row.action || "NONE",
      header: "Action",
      cell: ({ row }) => {
        const machine = row.original;
        const currentAction = machine.action || "NONE";
        const config = ACTION_LABELS[currentAction];

        return (
          <Select
            value={currentAction}
            onValueChange={(value) => handleActionUpdate(machine.id, "action", value)}
          >
            <SelectTrigger className={cn("h-7 w-[150px] text-xs", currentAction !== "NONE" && "font-medium")}>
              <SelectValue>
                {currentAction !== "NONE" ? (
                  <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", config.color)}>
                    {config.label}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">Select action</span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NONE">None</SelectItem>
              <SelectItem value="TERMINATE">Terminate</SelectItem>
              <SelectItem value="TERMINATE_UPGRADE">Terminate & Upgrade</SelectItem>
              <SelectItem value="STAY">Stay</SelectItem>
              <SelectItem value="MOVE">Move</SelectItem>
            </SelectContent>
          </Select>
        );
      },
      filterFn: (row, id, value) => {
        const action = row.original.action || "NONE";
        return action === value;
      },
    },

    // --- Upgrade To (visible when action = TERMINATE_UPGRADE) ---
    {
      id: "upgradeTo",
      accessorFn: (row) => row.upgradeTo || "",
      header: "Upgrade To",
      cell: ({ row }) => (
        <UpgradeToCell
          machine={row.original}
          onUpdate={handleActionUpdate}
        />
      ),
    },

    // --- Move To (visible when action = MOVE) ---
    {
      id: "moveTo",
      accessorFn: (row) => {
        if (row.action !== "MOVE") return "";
        return row.moveToCompanyId || "";
      },
      header: "Move To",
      cell: ({ row }) => (
        <MoveToCell
          machine={row.original}
          stores={stores}
          onUpdate={handleActionUpdate}
        />
      ),
    },

    // --- Balance ---
    {
      accessorKey: "currentBalance",
      header: "Balance",
      cell: ({ row }) => (
        <span className="font-mono text-right block text-xs">
          {formatNumber(row.getValue("currentBalance"))}
        </span>
      ),
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

    // --- Date columns at the end ---
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

    // --- Actions (triple-dot) at the very end ---
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
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}

// Backwards compatible export
export const machineColumns = createMachineColumns();
