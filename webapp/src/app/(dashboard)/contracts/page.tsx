"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoading } from "@/components/ui/page-loading";
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
  Download,
  FileSpreadsheet,
  Search,
  AlertTriangle,
  Clock,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { formatDate, formatNumber, cn } from "@/lib/utils";
import { exportToExcel, exportToCSV } from "@/lib/export";
import { utilizationConfig, type UtilizationStatus } from "@/components/ui/utilization-badge";
import type { MachineWithRelations, MachineUtilization } from "@/types";

interface ContractData extends MachineWithRelations {
  machineAge: number; // months
  contractRemaining: number | null; // months
  utilization?: MachineUtilization;
}

export default function ContractsPage() {
  const router = useRouter();
  const [machines, setMachines] = useState<ContractData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("expiring");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterUtilization, setFilterUtilization] = useState<string>("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [machinesRes, utilizationRes] = await Promise.all([
        fetch("/api/machines?limit=10000&status=ACTIVE"),
        fetch("/api/machines/utilization"),
      ]);

      const data = await machinesRes.json();
      const utilizationData = await utilizationRes.json();

      // Handle API error responses
      const machinesData = Array.isArray(data?.data) ? data.data : [];
      const utilizationArray: MachineUtilization[] = utilizationData?.machines || [];

      // Create a map of machine utilization by machineId
      const utilizationMap = new Map<string, MachineUtilization>();
      utilizationArray.forEach((u) => utilizationMap.set(u.machineId, u));

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
          utilization: utilizationMap.get(m.id),
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
        if (!(m.contractRemaining !== null && m.contractRemaining <= 6 && m.contractRemaining > 0)) return false;
      } else if (filterStatus === "expired") {
        if (!(m.contractRemaining !== null && m.contractRemaining <= 0)) return false;
      } else if (filterStatus === "no-contract") {
        if (m.contractRemaining !== null) return false;
      } else if (filterStatus === "active-contract") {
        if (!(m.contractRemaining !== null && m.contractRemaining > 6)) return false;
      }

      // Utilization filter
      if (filterUtilization !== "all" && m.utilization) {
        if (filterUtilization === "lift-candidates") {
          if (m.utilization.liftScore < 70) return false;
        } else if (m.utilization.utilizationStatus !== filterUtilization) {
          return false;
        }
      } else if (filterUtilization !== "all" && !m.utilization) {
        return false;
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
        case "lift-score":
          return (b.utilization?.liftScore || 0) - (a.utilization?.liftScore || 0);
        case "utilization":
          return (a.utilization?.utilizationPercent || 0) - (b.utilization?.utilizationPercent || 0);
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
  const liftCandidates = machines.filter((m) => m.utilization && m.utilization.liftScore >= 70).length;
  const criticalUtilization = machines.filter((m) => m.utilization?.utilizationStatus === "critical").length;

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
        { key: "utilization.utilizationPercent", header: "Utilization %" },
        { key: "utilization.avgMonthlyVolume", header: "Avg Monthly Vol" },
        { key: "utilization.liftScore", header: "Lift Score" },
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
        { key: "utilization.utilizationPercent", header: "Utilization %" },
        { key: "utilization.avgMonthlyVolume", header: "Avg Monthly Vol" },
        { key: "utilization.liftScore", header: "Lift Score" },
        { key: "status", header: "Status" },
      ],
      "contracts"
    );
  };

  if (isLoading) {
    return (
      <AppShell>
        <PageLoading variant="cards" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          title="Contracts"
          description="Manage machine contracts, renewals, and utilization"
        >
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleExportExcel}>
            <FileSpreadsheet className="h-3 w-3 mr-1" />
            Excel
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleExportCSV}>
            <Download className="h-3 w-3 mr-1" />
            CSV
          </Button>
        </PageHeader>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
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
          <Card
            className={cn(
              "cursor-pointer hover:bg-muted/50",
              criticalUtilization > 0 && "border-red-500/50"
            )}
            onClick={() => setFilterUtilization("critical")}
          >
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingDown className="h-3 w-3 text-red-600" />
                Critical Util
              </p>
              <p className="text-xl font-bold font-mono text-red-600">{criticalUtilization}</p>
            </CardContent>
          </Card>
          <Card
            className={cn(
              "cursor-pointer hover:bg-muted/50",
              liftCandidates > 0 && "border-orange-500/50 bg-orange-50/50"
            )}
            onClick={() => setFilterUtilization("lift-candidates")}
          >
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Target className="h-3 w-3 text-orange-600" />
                Lift Candidates
              </p>
              <p className="text-xl font-bold font-mono text-orange-600">{liftCandidates}</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setFilterStatus("no-contract")}>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">No Contract</p>
              <p className="text-xl font-bold font-mono text-muted-foreground">{noContract}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search serial, model, store..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setFilterUtilization("all"); }}>
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue placeholder="Contract Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Contracts</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="expiring">Expiring (6mo)</SelectItem>
              <SelectItem value="active-contract">Active Contract</SelectItem>
              <SelectItem value="no-contract">No Contract</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterUtilization} onValueChange={(v) => { setFilterUtilization(v); }}>
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue placeholder="Utilization" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Utilization</SelectItem>
              <SelectItem value="critical">Critical (&lt;20%)</SelectItem>
              <SelectItem value="low">Low (20-40%)</SelectItem>
              <SelectItem value="optimal">Optimal (40-80%)</SelectItem>
              <SelectItem value="high">High (80-100%)</SelectItem>
              <SelectItem value="overworked">Overworked (&gt;100%)</SelectItem>
              <SelectItem value="lift-candidates">Lift Candidates</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expiring">Expiring Soon</SelectItem>
              <SelectItem value="lift-score">Lift Score</SelectItem>
              <SelectItem value="utilization">Lowest Util</SelectItem>
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
                    <th className="px-3 py-1.5 text-center font-medium">Utilization</th>
                    <th className="px-3 py-1.5 text-center font-medium">Lift</th>
                    <th className="px-3 py-1.5 text-left font-medium">Contract End</th>
                    <th className="px-3 py-1.5 text-right font-medium">Remaining</th>
                    <th className="px-3 py-1.5 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredMachines.map((machine) => {
                    const isExpired = machine.contractRemaining !== null && machine.contractRemaining <= 0;
                    const isExpiring = machine.contractRemaining !== null && machine.contractRemaining <= 6 && machine.contractRemaining > 0;
                    const util = machine.utilization;
                    const utilStatus = util?.utilizationStatus as UtilizationStatus | undefined;
                    const config = utilStatus ? utilizationConfig[utilStatus] : null;

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
                        <td className="px-3 py-1.5 truncate max-w-[120px]">{machine.modelName || "-"}</td>
                        <td className="px-3 py-1.5">{machine.company?.name || "-"}</td>
                        <td className="px-3 py-1.5">
                          {util && config ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center justify-center gap-1.5">
                                    <div className="w-12">
                                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div
                                          className={cn("h-full rounded-full", config.bgColor)}
                                          style={{ width: `${Math.min(util.utilizationPercent, 100)}%` }}
                                        />
                                      </div>
                                    </div>
                                    <span className={cn("text-[10px] font-medium w-8", config.color)}>
                                      {util.utilizationPercent}%
                                    </span>
                                    {util.trendDirection === "up" && <TrendingUp className="h-2.5 w-2.5 text-emerald-500" />}
                                    {util.trendDirection === "down" && <TrendingDown className="h-2.5 w-2.5 text-red-500" />}
                                    {util.trendDirection === "stable" && <Minus className="h-2.5 w-2.5 text-muted-foreground" />}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="font-medium">{config.label}: {util.utilizationPercent}%</p>
                                  <p className="text-xs text-muted-foreground">
                                    Avg: {formatNumber(util.avgMonthlyVolume)}/mo · Duty: {formatNumber(util.dutyCycle)}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {util && util.liftScore >= 60 ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-[9px] px-1 py-0",
                                      util.liftScore >= 80
                                        ? "bg-red-100 text-red-700 border-red-300"
                                        : "bg-amber-100 text-amber-700 border-amber-300"
                                    )}
                                  >
                                    <Target className="h-2 w-2 mr-0.5" />
                                    {util.liftScore}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="font-medium">Lift Score: {util.liftScore}/100</p>
                                  {util.insights.slice(0, 2).map((i, idx) => (
                                    <p key={idx} className="text-xs text-muted-foreground">• {i}</p>
                                  ))}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
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
                                ? `${Math.abs(machine.contractRemaining)} over`
                                : `${machine.contractRemaining}mo`}
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
