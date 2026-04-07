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
import { ArrowRight, Pencil } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { formatNumber, formatDate, cn } from "@/lib/utils";
import type { MachineWithUtilization } from "@/types";

function formatCost(value: number): string {
  if (value === 0) return "—";
  return `R${value.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

function InlineNotesCell({
  value,
  onSave,
  placeholder = "Add note...",
}: {
  value: string | null;
  onSave: (val: string) => void;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const save = () => {
    setEditing(false);
    if (draft !== (value || "")) {
      onSave(draft);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="w-full min-w-[120px] h-7 px-1.5 text-xs border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") { setDraft(value || ""); setEditing(false); }
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <div
      className="flex items-center gap-1 cursor-text min-w-[80px] group"
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
    >
      {value ? (
        <span className="text-xs truncate max-w-[150px]">{value}</span>
      ) : (
        <span className="text-xs text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
          <Pencil className="h-3 w-3 inline mr-0.5" />
          {placeholder}
        </span>
      )}
    </div>
  );
}

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
      header: "Serial",
      cell: ({ row }) => {
        const serial = row.getValue("serialNumber") as string;
        const isPlanned = serial?.startsWith("PLANNED-");
        if (isPlanned) {
          return (
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300">
                Planned
              </Badge>
              <InlineNotesCell
                value=""
                placeholder="Enter serial..."
                onSave={(val) => {
                  if (val.trim()) handleActionUpdate(row.original.id, "serialNumber", val.trim());
                }}
              />
            </div>
          );
        }
        return (
          <span className="font-mono text-xs">{serial}</span>
        );
      },
    },
    {
      id: "companyName",
      accessorFn: (row) => row.company?.name,
      header: "Store",
      cell: ({ row }) => row.original.company?.name || "-",
    },
    {
      id: "companyGroup",
      accessorFn: (row) => row.company?.companyGroup,
      header: "Group",
      cell: ({ row }) => row.original.company?.companyGroup || "-",
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

    // --- Cost (from Xerox billing) ---
    {
      id: "xeroxCost",
      accessorFn: (row) => row.utilization?.xeroxCost ?? null,
      header: "Cost",
      cell: ({ row }) => {
        const utilization = row.original.utilization;
        if (utilization?.xeroxCost == null || utilization.xeroxCost === 0) {
          return <span className="text-muted-foreground text-xs">{"\u2014"}</span>;
        }
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="font-mono text-xs font-medium">
                  {formatCost(utilization.xeroxCost)}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <p className="font-medium">Xerox Charges ({utilization.xeroxBillingMonth})</p>
                  <div className="text-xs space-y-0.5">
                    {utilization.xeroxRental != null && utilization.xeroxRental > 0 && (
                      <p>Rental: {formatCost(utilization.xeroxRental)}</p>
                    )}
                    {utilization.xeroxVolumeCharges != null && utilization.xeroxVolumeCharges > 0 && (
                      <p>Volume: {formatCost(utilization.xeroxVolumeCharges)}</p>
                    )}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },

    // --- Rate (CPC from Xerox billing) ---
    {
      id: "xeroxRate",
      accessorFn: (row) => row.utilization?.xeroxCpc ?? null,
      header: "Rate",
      cell: ({ row }) => {
        const cpc = row.original.utilization?.xeroxCpc;
        if (cpc == null) {
          return <span className="text-muted-foreground text-xs">{"\u2014"}</span>;
        }
        return (
          <span className="font-mono text-xs">
            {cpc.toFixed(2)}c
          </span>
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

    // --- Notes ---
    {
      accessorKey: "notes",
      header: "Notes",
      cell: ({ row }) => {
        const machine = row.original;
        return (
          <InlineNotesCell
            value={machine.notes}
            onSave={(val) => handleActionUpdate(machine.id, "notes", val)}
          />
        );
      },
      enableSorting: false,
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
      cell: ({ row }) => {
        const date = row.getValue("lastReadingDate") as string | null;
        if (!date) return <span className="text-muted-foreground text-xs">—</span>;
        const daysSince = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
        const isStale = daysSince > 30;
        return (
          <span className={cn("text-xs", isStale ? "text-amber-600 font-medium" : "text-muted-foreground")}>
            {isStale && <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mr-1 align-middle" />}
            {formatDate(date)}
          </span>
        );
      },
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

