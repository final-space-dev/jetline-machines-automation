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
import { MoreHorizontal, ExternalLink, ArrowUpRight, Printer } from "lucide-react";
import { formatNumber, formatDate } from "@/lib/utils";
import type { MachineWithRelations } from "@/types";

export const machineColumns: ColumnDef<MachineWithRelations>[] = [
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
    accessorKey: "bmsMachineNo",
    header: "BMS No",
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.getValue("bmsMachineNo") || "-"}
      </span>
    ),
  },
  {
    accessorKey: "company.name",
    header: "Store",
    cell: ({ row }) => row.original.company.name,
    filterFn: (row, id, value) => {
      return row.original.company.name === value;
    },
  },
  {
    accessorKey: "category.name",
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
    accessorKey: "makeName",
    header: "Make",
    cell: ({ row }) => row.getValue("makeName") || "-",
  },
  {
    accessorKey: "modelName",
    header: "Model",
    cell: ({ row }) => row.getValue("modelName") || "-",
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
      return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
    },
    filterFn: (row, id, value) => {
      return row.getValue("status") === value;
    },
  },
  {
    accessorKey: "currentBalance",
    header: "Current Balance",
    cell: ({ row }) => (
      <span className="font-mono text-right block">
        {formatNumber(row.getValue("currentBalance"))}
      </span>
    ),
  },
  {
    accessorKey: "contractType",
    header: "Contract Type",
    cell: ({ row }) => row.getValue("contractType") || "-",
  },
  {
    accessorKey: "installDate",
    header: "Install Date",
    cell: ({ row }) => formatDate(row.getValue("installDate")),
  },
  {
    accessorKey: "startDate",
    header: "Start Date",
    cell: ({ row }) => formatDate(row.getValue("startDate")),
  },
  {
    accessorKey: "rentalStartDate",
    header: "Rental Start",
    cell: ({ row }) => formatDate(row.getValue("rentalStartDate")),
  },
  {
    accessorKey: "rentalEndDate",
    header: "Rental End",
    cell: ({ row }) => formatDate(row.getValue("rentalEndDate")),
  },
  {
    accessorKey: "rentalMonthsRemaining",
    header: "Months Left",
    cell: ({ row }) => {
      const months = row.getValue("rentalMonthsRemaining") as number | null;
      if (months === null) return "-";
      return (
        <Badge variant={months <= 3 ? "destructive" : months <= 12 ? "outline" : "secondary"}>
          {months}
        </Badge>
      );
    },
  },
  {
    accessorKey: "isLifted",
    header: "Lifted",
    cell: ({ row }) => (
      <Badge variant={row.getValue("isLifted") ? "destructive" : "outline"}>
        {row.getValue("isLifted") ? "Yes" : "No"}
      </Badge>
    ),
  },
  {
    accessorKey: "lastReadingDate",
    header: "Last Reading",
    cell: ({ row }) => formatDate(row.getValue("lastReadingDate")),
  },
  {
    accessorKey: "lastSyncedAt",
    header: "Last Synced",
    cell: ({ row }) => formatDate(row.getValue("lastSyncedAt")),
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
