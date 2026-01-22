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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MoreHorizontal, ExternalLink, ArrowUpRight, Printer, TrendingUp, TrendingDown, Minus, Target } from "lucide-react";
import { formatNumber, formatDate, cn } from "@/lib/utils";
import type { MachineWithUtilization } from "@/types";

const utilizationConfig: Record<string, { color: string; bgColor: string; badgeBg: string }> = {
  critical: { color: "text-red-600", bgColor: "bg-red-500", badgeBg: "bg-red-100 text-red-700 border-red-300" },
  low: { color: "text-amber-600", bgColor: "bg-amber-500", badgeBg: "bg-amber-100 text-amber-700 border-amber-300" },
  optimal: { color: "text-emerald-600", bgColor: "bg-emerald-500", badgeBg: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  high: { color: "text-blue-600", bgColor: "bg-blue-500", badgeBg: "bg-blue-100 text-blue-700 border-blue-300" },
  overworked: { color: "text-purple-600", bgColor: "bg-purple-500", badgeBg: "bg-purple-100 text-purple-700 border-purple-300" },
};

export const machineColumns: ColumnDef<MachineWithUtilization>[] = [
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
      if (months === null) return <span className="text-muted-foreground text-xs">—</span>;
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
