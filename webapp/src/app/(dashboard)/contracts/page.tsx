"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileSpreadsheet, Search, AlertTriangle, Clock } from "lucide-react";
import { formatNumber, formatDate, cn } from "@/lib/utils";
import { exportToExcel, exportToCSV } from "@/lib/export";
import type { MachineWithRelations } from "@/types";

interface ContractData extends MachineWithRelations {
  machineAge: number; // months
  contractRemaining: number | null; // months
}

export default function ContractsPage() {
  const router = useRouter();
  const [machines, setMachines] = useState<ContractData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("expiring");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/machines?limit=10000");
      const data = await res.json();
      const machinesData = data.data || [];

      const now = new Date();
      const processed: ContractData[] = machinesData.map((m: MachineWithRelations) => {
        // Calculate machine age in months
        const installDate = m.installDate ? new Date(m.installDate) : null;
        const machineAge = installDate
          ? Math.floor((now.getTime() - installDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
          : 0;

        // Calculate contract remaining months
        let contractRemaining: number | null = null;
        if (m.rentalEndDate) {
          const endDate = new Date(m.rentalEndDate);
          contractRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30));
        } else if (m.rentalMonthsRemaining !== undefined && m.rentalMonthsRemaining !== null) {
          contractRemaining = m.rentalMonthsRemaining;
        }

        return {
          ...m,
          machineAge,
          contractRemaining,
        };
      });

      setMachines(processed);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredMachines = machines
    .filter((m) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          m.serialNumber?.toLowerCase().includes(q) ||
          m.modelName?.toLowerCase().includes(q) ||
          m.company?.name?.toLowerCase().includes(q) ||
          m.contractNumber?.toLowerCase().includes(q);
        if (!matches) return false;
      }

      if (filterStatus === "expiring") {
        return m.contractRemaining !== null && m.contractRemaining <= 6 && m.contractRemaining > 0;
      }
      if (filterStatus === "expired") {
        return m.contractRemaining !== null && m.contractRemaining <= 0;
      }
      if (filterStatus === "no-contract") {
        return m.contractRemaining === null;
      }
      if (filterStatus === "active-contract") {
        return m.contractRemaining !== null && m.contractRemaining > 6;
      }

      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "expiring":
          // Expired first, then by remaining months ascending
          if (a.contractRemaining === null && b.contractRemaining === null) return 0;
          if (a.contractRemaining === null) return 1;
          if (b.contractRemaining === null) return 1;
          return a.contractRemaining - b.contractRemaining;
        case "oldest":
          return b.machineAge - a.machineAge;
        case "newest":
          return a.machineAge - b.machineAge;
        case "store":
          return (a.company?.name || "").localeCompare(b.company?.name || "");
        case "model":
          return (a.modelName || "").localeCompare(b.modelName || "");
        default:
          return 0;
      }
    });

  // Stats
  const totalMachines = machines.length;
  const expiringIn6Months = machines.filter(
    (m) => m.contractRemaining !== null && m.contractRemaining <= 6 && m.contractRemaining > 0
  ).length;
  const expired = machines.filter(
    (m) => m.contractRemaining !== null && m.contractRemaining <= 0
  ).length;
  const noContract = machines.filter((m) => m.contractRemaining === null).length;
  const avgMachineAge = machines.length > 0
    ? Math.round(machines.reduce((sum, m) => sum + m.machineAge, 0) / machines.length)
    : 0;

  const handleExportExcel = () => {
    exportToExcel(
      filteredMachines,
      [
        { key: "serialNumber", header: "Serial Number" },
        { key: "modelName", header: "Model" },
        { key: "company.name", header: "Store" },
        { key: "contractNumber", header: "Contract #" },
        { key: "contractType", header: "Type" },
        { key: "installDate", header: "Install Date" },
        { key: "machineAge", header: "Age (Months)" },
        { key: "rentalStartDate", header: "Contract Start" },
        { key: "rentalEndDate", header: "Contract End" },
        { key: "contractRemaining", header: "Months Remaining" },
        { key: "status", header: "Status" },
      ],
      "contracts"
    );
  };

  const handleExportCSV = () => {
    exportToCSV(
      filteredMachines,
      [
        { key: "serialNumber", header: "Serial Number" },
        { key: "modelName", header: "Model" },
        { key: "company.name", header: "Store" },
        { key: "contractNumber", header: "Contract #" },
        { key: "contractType", header: "Type" },
        { key: "installDate", header: "Install Date" },
        { key: "machineAge", header: "Age (Months)" },
        { key: "rentalStartDate", header: "Contract Start" },
        { key: "rentalEndDate", header: "Contract End" },
        { key: "contractRemaining", header: "Months Remaining" },
        { key: "status", header: "Status" },
      ],
      "contracts"
    );
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-[400px]" />
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
            <h1 className="text-xl font-bold tracking-tight">Contracts</h1>
            <p className="text-xs text-muted-foreground">
              Manage machine contracts, renewals, and equipment age
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setFilterStatus("all")}>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Total Machines</p>
              <p className="text-xl font-bold font-mono">{totalMachines}</p>
            </CardContent>
          </Card>
          <Card
            className={cn(
              "cursor-pointer hover:bg-muted/50",
              expired > 0 && "border-red-500/50 bg-red-50/50"
            )}
            onClick={() => setFilterStatus("expired")}
          >
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-red-600" />
                Expired
              </p>
              <p className="text-xl font-bold font-mono text-red-600">{expired}</p>
            </CardContent>
          </Card>
          <Card
            className={cn(
              "cursor-pointer hover:bg-muted/50",
              expiringIn6Months > 0 && "border-yellow-500/50 bg-yellow-50/50"
            )}
            onClick={() => setFilterStatus("expiring")}
          >
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3 text-yellow-600" />
                Expiring (6mo)
              </p>
              <p className="text-xl font-bold font-mono text-yellow-600">{expiringIn6Months}</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setFilterStatus("no-contract")}>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">No Contract Data</p>
              <p className="text-xl font-bold font-mono text-muted-foreground">{noContract}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Avg Machine Age</p>
              <p className="text-xl font-bold font-mono">{avgMachineAge} mo</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search serial, model, store..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Contracts</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="expiring">Expiring (6mo)</SelectItem>
              <SelectItem value="active-contract">Active Contract</SelectItem>
              <SelectItem value="no-contract">No Contract</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expiring">Expiring Soon</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="store">By Store</SelectItem>
              <SelectItem value="model">By Model</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Contracts Table */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-sm">
              Contracts ({filteredMachines.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 border-y">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium">Serial</th>
                    <th className="px-3 py-1.5 text-left font-medium">Model</th>
                    <th className="px-3 py-1.5 text-left font-medium">Store</th>
                    <th className="px-3 py-1.5 text-left font-medium">Contract #</th>
                    <th className="px-3 py-1.5 text-right font-medium">Age (mo)</th>
                    <th className="px-3 py-1.5 text-left font-medium">Contract End</th>
                    <th className="px-3 py-1.5 text-right font-medium">Remaining</th>
                    <th className="px-3 py-1.5 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredMachines.map((machine) => {
                    const isExpired = machine.contractRemaining !== null && machine.contractRemaining <= 0;
                    const isExpiring = machine.contractRemaining !== null && machine.contractRemaining <= 6 && machine.contractRemaining > 0;

                    return (
                      <tr
                        key={machine.id}
                        className={cn(
                          "hover:bg-muted/50 cursor-pointer",
                          isExpired && "bg-red-50/50",
                          isExpiring && "bg-yellow-50/30"
                        )}
                        onClick={() => router.push(`/machines/${machine.id}`)}
                      >
                        <td className="px-3 py-1.5 font-mono">{machine.serialNumber}</td>
                        <td className="px-3 py-1.5">{machine.modelName || "-"}</td>
                        <td className="px-3 py-1.5">{machine.company?.name || "-"}</td>
                        <td className="px-3 py-1.5 font-mono text-muted-foreground">
                          {machine.contractNumber || "-"}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono">{machine.machineAge}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">
                          {formatDate(machine.rentalEndDate)}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {machine.contractRemaining !== null ? (
                            <span
                              className={cn(
                                "font-mono font-medium",
                                isExpired && "text-red-600",
                                isExpiring && "text-yellow-600",
                                !isExpired && !isExpiring && "text-green-600"
                              )}
                            >
                              {machine.contractRemaining <= 0
                                ? `${Math.abs(machine.contractRemaining)} overdue`
                                : `${machine.contractRemaining} mo`}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {isExpired ? (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                              Expired
                            </Badge>
                          ) : isExpiring ? (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-yellow-500 text-yellow-700">
                              Expiring
                            </Badge>
                          ) : machine.contractRemaining !== null ? (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              No Data
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredMachines.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-4 text-center text-muted-foreground">
                        No contracts found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
