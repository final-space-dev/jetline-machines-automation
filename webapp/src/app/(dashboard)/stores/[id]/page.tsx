"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageLoading } from "@/components/ui/page-loading";
import { NotFoundState } from "@/components/ui/empty-state";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  AlertTriangle,
  CheckCircle,
  Zap,
} from "lucide-react";
import { formatNumber, formatDate, cn, getStatusVariant } from "@/lib/utils";
import { utilizationConfig, type UtilizationStatus } from "@/components/ui/utilization-badge";
import type { MachineWithRelations, MachineUtilization } from "@/types";

interface MachineWithUtil extends MachineWithRelations {
  utilization?: MachineUtilization;
}

interface StoreDetail {
  id: string;
  name: string;
  region: string | null;
  bmsSchema: string;
  bmsHost: string | null;
  isActive: boolean;
  createdAt: string;
  machines: MachineWithUtil[];
}

interface UtilizationSummary {
  total: number;
  critical: number;
  low: number;
  optimal: number;
  high: number;
  overworked: number;
  liftCandidates: number;
  avgUtilization: number;
}

export default function StoreDetailPage() {
  const router = useRouter();
  const params = useParams();
  const storeId = params.id as string;

  const [store, setStore] = useState<StoreDetail | null>(null);
  const [utilizationSummary, setUtilizationSummary] = useState<UtilizationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStoreData();
  }, [storeId]);

  const fetchStoreData = async () => {
    try {
      const [companyRes, machinesRes, utilizationRes] = await Promise.all([
        fetch(`/api/companies/${storeId}`),
        fetch(`/api/machines?companyId=${storeId}&limit=10000`),
        fetch(`/api/machines/utilization?companyId=${storeId}`),
      ]);

      const companyData = await companyRes.json();
      const machinesData = await machinesRes.json();
      const utilizationData = await utilizationRes.json();

      // Handle API error responses
      const machinesArray: MachineWithRelations[] = Array.isArray(machinesData?.data) ? machinesData.data : [];
      const utilizationArray: MachineUtilization[] = utilizationData?.machines || [];

      // Create a map of machine utilization by machineId
      const utilizationMap = new Map<string, MachineUtilization>();
      utilizationArray.forEach((u) => utilizationMap.set(u.machineId, u));

      // Merge utilization data with machines
      const machinesWithUtil: MachineWithUtil[] = machinesArray.map((machine) => ({
        ...machine,
        utilization: utilizationMap.get(machine.id),
      }));

      if (companyData?.id) {
        setStore({
          id: companyData.id,
          name: companyData.name,
          region: companyData.region,
          bmsSchema: companyData.bmsSchema,
          bmsHost: companyData.bmsHost,
          isActive: companyData.isActive,
          createdAt: companyData.createdAt,
          machines: machinesWithUtil,
        });

        // Calculate utilization summary
        const machinesWithUtilData = machinesWithUtil.filter((m) => m.utilization);
        if (machinesWithUtilData.length > 0) {
          const critical = machinesWithUtilData.filter((m) => m.utilization?.utilizationStatus === "critical").length;
          const low = machinesWithUtilData.filter((m) => m.utilization?.utilizationStatus === "low").length;
          const optimal = machinesWithUtilData.filter((m) => m.utilization?.utilizationStatus === "optimal").length;
          const high = machinesWithUtilData.filter((m) => m.utilization?.utilizationStatus === "high").length;
          const overworked = machinesWithUtilData.filter((m) => m.utilization?.utilizationStatus === "overworked").length;
          const liftCandidates = machinesWithUtilData.filter((m) => m.utilization && m.utilization.liftScore >= 70).length;
          const avgUtilization = Math.round(
            machinesWithUtilData.reduce((sum, m) => sum + (m.utilization?.utilizationPercent || 0), 0) / machinesWithUtilData.length
          );

          setUtilizationSummary({
            total: machinesWithUtilData.length,
            critical,
            low,
            optimal,
            high,
            overworked,
            liftCandidates,
            avgUtilization,
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch store data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <PageLoading variant="detail" />
      </AppShell>
    );
  }

  if (!store) {
    return (
      <AppShell>
        <NotFoundState type="store" />
        <div className="flex justify-center mt-4">
          <Button onClick={() => router.push("/stores")}>
            Back to Stores
          </Button>
        </div>
      </AppShell>
    );
  }

  const activeMachines = store.machines.filter((m) => m.status === "ACTIVE").length;
  const totalBalance = store.machines.reduce((sum, m) => sum + (m.currentBalance || 0), 0);

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold">{store.name}</h1>
              <Badge variant={store.isActive ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                {store.isActive ? "Active" : "Inactive"}
              </Badge>
              {utilizationSummary && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] px-1.5 py-0",
                    utilizationSummary.avgUtilization < 40
                      ? "bg-amber-100 text-amber-700 border-amber-300"
                      : utilizationSummary.avgUtilization <= 80
                        ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                        : "bg-blue-100 text-blue-700 border-blue-300"
                  )}
                >
                  {utilizationSummary.avgUtilization}% Avg Util
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {store.machines.length} machines · {activeMachines} active · {formatNumber(totalBalance)} total balance
            </p>
          </div>
        </div>

        {/* Utilization Summary Badges */}
        {utilizationSummary && (
          <div className="flex flex-wrap gap-2">
            {utilizationSummary.critical > 0 && (
              <Badge
                variant="outline"
                className="text-xs px-2 py-1 gap-1.5 bg-red-50 text-red-700 border-red-200"
              >
                <AlertTriangle className="h-3 w-3" />
                {utilizationSummary.critical} Critical
              </Badge>
            )}
            {utilizationSummary.low > 0 && (
              <Badge
                variant="outline"
                className="text-xs px-2 py-1 gap-1.5 bg-amber-50 text-amber-700 border-amber-200"
              >
                <TrendingDown className="h-3 w-3" />
                {utilizationSummary.low} Low
              </Badge>
            )}
            <Badge
              variant="outline"
              className="text-xs px-2 py-1 gap-1.5 bg-emerald-50 text-emerald-700 border-emerald-200"
            >
              <CheckCircle className="h-3 w-3" />
              {utilizationSummary.optimal} Optimal
            </Badge>
            {utilizationSummary.overworked > 0 && (
              <Badge
                variant="outline"
                className="text-xs px-2 py-1 gap-1.5 bg-purple-50 text-purple-700 border-purple-200"
              >
                <Zap className="h-3 w-3" />
                {utilizationSummary.overworked} Overworked
              </Badge>
            )}
            {utilizationSummary.liftCandidates > 0 && (
              <Badge
                variant="outline"
                className="text-xs px-2 py-1 gap-1.5 bg-orange-50 text-orange-700 border-orange-200"
              >
                <Target className="h-3 w-3" />
                {utilizationSummary.liftCandidates} Lift Candidates
              </Badge>
            )}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Left Column - Store Info & Machines */}
          <div className="lg:col-span-2 space-y-4">
            {/* Store Information */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm">Store Information</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Store Name</p>
                    <p className="font-medium">{store.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Region</p>
                    <p className="font-medium">{store.region || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">BMS Schema</p>
                    <p className="font-mono">{store.bmsSchema}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">BMS Host</p>
                    <p className="font-mono">{store.bmsHost || "default"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <p>{store.isActive ? "Active" : "Inactive"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Created</p>
                    <p>{formatDate(store.createdAt)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Machines Table */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm">Machines ({store.machines.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 border-y">
                      <tr>
                        <th className="px-3 py-1.5 text-left font-medium">Serial</th>
                        <th className="px-3 py-1.5 text-left font-medium">Model</th>
                        <th className="px-3 py-1.5 text-center font-medium">Utilization</th>
                        <th className="px-3 py-1.5 text-center font-medium">Lift</th>
                        <th className="px-3 py-1.5 text-right font-medium">Balance</th>
                        <th className="px-3 py-1.5 text-center font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {store.machines.map((machine) => {
                        const util = machine.utilization;
                        const utilStatus = util?.utilizationStatus as UtilizationStatus | undefined;
                        const config = utilStatus ? utilizationConfig[utilStatus] : null;

                        return (
                          <tr
                            key={machine.id}
                            className={cn(
                              "hover:bg-muted/50 cursor-pointer",
                              util?.utilizationStatus === "critical" && "bg-red-50/30",
                              util && util.liftScore >= 80 && "bg-orange-50/30"
                            )}
                            onClick={() => router.push(`/machines/${machine.id}`)}
                          >
                            <td className="px-3 py-1.5 font-mono">{machine.serialNumber}</td>
                            <td className="px-3 py-1.5 truncate max-w-[120px]">{machine.modelName || "-"}</td>
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
                                <span className="text-muted-foreground flex justify-center">—</span>
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
                            <td className="px-3 py-1.5 text-right font-mono">{formatNumber(machine.currentBalance)}</td>
                            <td className="px-3 py-1.5 text-center">
                              <Badge variant={getStatusVariant(machine.status as "ACTIVE" | "INACTIVE" | "MAINTENANCE" | "DECOMMISSIONED")} className="text-[10px] px-1.5 py-0">
                                {machine.status}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                      {store.machines.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">
                            No machines in this store
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Summary */}
          <div className="space-y-4">
            {/* Summary */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm">Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-3 pb-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total Machines</span>
                  <span className="font-mono font-bold">{store.machines.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Active</span>
                  <span className="font-mono text-green-600">{activeMachines}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Inactive</span>
                  <span className="font-mono text-yellow-600">{store.machines.length - activeMachines}</span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Balance</span>
                    <span className="font-mono font-bold">{formatNumber(totalBalance)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Utilization Overview */}
            {utilizationSummary && (
              <Card>
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-sm">Utilization Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 px-3 pb-3 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Avg Utilization</span>
                    <span className={cn(
                      "font-mono font-bold",
                      utilizationSummary.avgUtilization < 40 ? "text-amber-600" :
                        utilizationSummary.avgUtilization <= 80 ? "text-emerald-600" : "text-blue-600"
                    )}>
                      {utilizationSummary.avgUtilization}%
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        utilizationSummary.avgUtilization < 40 ? "bg-amber-500" :
                          utilizationSummary.avgUtilization <= 80 ? "bg-emerald-500" : "bg-blue-500"
                      )}
                      style={{ width: `${Math.min(utilizationSummary.avgUtilization, 100)}%` }}
                    />
                  </div>
                  <div className="border-t pt-2 mt-2 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-red-600">Critical</span>
                      <span className="font-mono text-red-600">{utilizationSummary.critical}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-amber-600">Low</span>
                      <span className="font-mono text-amber-600">{utilizationSummary.low}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-emerald-600">Optimal</span>
                      <span className="font-mono text-emerald-600">{utilizationSummary.optimal}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-blue-600">High</span>
                      <span className="font-mono text-blue-600">{utilizationSummary.high}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-purple-600">Overworked</span>
                      <span className="font-mono text-purple-600">{utilizationSummary.overworked}</span>
                    </div>
                  </div>
                  {utilizationSummary.liftCandidates > 0 && (
                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-orange-600 flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          Lift Candidates
                        </span>
                        <span className="font-mono font-bold text-orange-600">{utilizationSummary.liftCandidates}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Category Breakdown */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm">By Category</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 px-3 pb-3">
                {Object.entries(
                  store.machines.reduce((acc, m) => {
                    const cat = m.category?.name || "Uncategorized";
                    acc[cat] = (acc[cat] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([category, count]) => (
                  <div key={category} className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">{category}</span>
                    <span className="font-mono">{count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
