"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoading } from "@/components/ui/page-loading";
import {
  ChevronRight,
  AlertTriangle,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  FileWarning,
  Zap,
  Building2,
} from "lucide-react";
import { formatNumber, formatDate } from "@/lib/utils";

interface InsightsData {
  period: { days: number; start: string; end: string };
  summary: {
    totalMachines: number;
    totalStores: number;
    agingHighPerformersCount: number;
    underutilizedNewCount: number;
    expiredContractsCount: number;
    expiringContractsCount: number;
    urgentContractsCount: number;
    storesWithGaps: number;
    liftSuggestionsCount: number;
    fleetAvgVolumePerMachine: number;
    storeMedianVolumePerMachine: number;
  };
  insights: {
    agingHighPerformers: Array<{
      id: string;
      serialNumber: string;
      modelName: string | null;
      company: { id: string; name: string };
      ageInMonths: number | null;
      periodVolume: number;
      monthlyAverage: number;
      vsModelAvg: number;
      recommendation: string;
    }>;
    underutilizedNew: Array<{
      id: string;
      serialNumber: string;
      modelName: string | null;
      company: { id: string; name: string };
      periodVolume: number;
      monthlyAverage: number;
      vsFleetAvg: number;
      recommendation: string;
    }>;
    contractAlerts: {
      expired: Array<{
        id: string;
        serialNumber: string;
        modelName: string | null;
        company: { id: string; name: string };
        category: string | null;
        rentalEndDate: string | null;
        daysOverdue: number;
      }>;
      expiringSoon: Array<{
        id: string;
        serialNumber: string;
        modelName: string | null;
        company: { id: string; name: string };
        category: string | null;
        rentalEndDate: string | null;
        daysUntilExpiry: number;
      }>;
      urgentCount: number;
    };
    storePerformance: {
      topStores: Array<{
        companyId: string;
        companyName: string;
        machineCount: number;
        totalVolume: number;
        avgPerMachine: number;
        vsMedian: number;
      }>;
      underperformingStores: Array<{
        companyId: string;
        companyName: string;
        machineCount: number;
        totalVolume: number;
        avgPerMachine: number;
        vsMedian: number;
      }>;
      median: number;
    };
    liftSuggestions: Array<{
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
    }>;
    storeCapabilityGaps: Array<{
      companyId: string;
      companyName: string;
      machineCount: number;
      missingCategories: string[];
    }>;
  };
}

interface DashboardData {
  summary: {
    totalMachines: number;
    activeMachines: number;
    totalBalance: number;
    companiesCount: number;
  };
  lastSync: {
    completedAt: string;
    machinesProcessed: number;
    readingsProcessed: number;
  } | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [insightsRes, dashboardRes] = await Promise.all([
        fetch("/api/dashboard/insights?period=90"),
        fetch("/api/dashboard"),
      ]);

      const insightsData = await insightsRes.json();
      const dashData = await dashboardRes.json();

      setInsights(insightsData);
      setDashboardData(dashData);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <PageLoading variant="cards" />
      </AppShell>
    );
  }

  const summary = insights?.summary;
  const alerts = insights?.insights;

  // Calculate total alerts requiring attention
  const totalAlerts =
    (summary?.expiredContractsCount || 0) +
    (summary?.urgentContractsCount || 0) +
    (summary?.agingHighPerformersCount || 0) +
    (summary?.underutilizedNewCount || 0);

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          title="Executive Dashboard"
          description={`${summary?.totalStores || 0} stores · ${summary?.totalMachines || 0} machines · Last sync: ${dashboardData?.lastSync ? formatDate(dashboardData.lastSync.completedAt) : "Never"}`}
        />

        {/* Alert Summary Bar */}
        {totalAlerts > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-amber-800 font-medium">
                {totalAlerts} items require attention
              </span>
            </div>
            <div className="flex gap-3 text-xs">
              {(summary?.expiredContractsCount || 0) > 0 && (
                <span className="text-red-600">{summary?.expiredContractsCount} expired contracts</span>
              )}
              {(summary?.urgentContractsCount || 0) > 0 && (
                <span className="text-amber-600">{summary?.urgentContractsCount} expiring soon</span>
              )}
              {(summary?.agingHighPerformersCount || 0) > 0 && (
                <span className="text-blue-600">{summary?.agingHighPerformersCount} aging performers</span>
              )}
            </div>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Left Column - Actionable Insights */}
          <div className="lg:col-span-2 space-y-4">
            {/* Contract Alerts */}
            {((alerts?.contractAlerts.expired.length || 0) > 0 ||
              (alerts?.contractAlerts.expiringSoon.length || 0) > 0) && (
              <Card className="border-red-200">
                <CardHeader className="pb-2 pt-3 px-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileWarning className="h-4 w-4 text-red-600" />
                      Contract Alerts
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={() => router.push("/contracts")}>
                      View All <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 border-y">
                        <tr>
                          <th className="px-3 py-1.5 text-left font-medium">Status</th>
                          <th className="px-3 py-1.5 text-left font-medium">Serial</th>
                          <th className="px-3 py-1.5 text-left font-medium">Model</th>
                          <th className="px-3 py-1.5 text-left font-medium">Store</th>
                          <th className="px-3 py-1.5 text-left font-medium">End Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {alerts?.contractAlerts.expired.slice(0, 3).map((item) => (
                          <tr
                            key={item.id}
                            className="hover:bg-muted/50 cursor-pointer"
                            onClick={() => router.push(`/machines/${item.id}`)}
                          >
                            <td className="px-3 py-1.5">
                              <Badge variant="destructive" className="text-[10px]">
                                {item.daysOverdue}d overdue
                              </Badge>
                            </td>
                            <td className="px-3 py-1.5 font-mono">{item.serialNumber}</td>
                            <td className="px-3 py-1.5">{item.modelName || "-"}</td>
                            <td className="px-3 py-1.5">{item.company.name}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">
                              {formatDate(item.rentalEndDate)}
                            </td>
                          </tr>
                        ))}
                        {alerts?.contractAlerts.expiringSoon.slice(0, 3).map((item) => (
                          <tr
                            key={item.id}
                            className="hover:bg-muted/50 cursor-pointer"
                            onClick={() => router.push(`/machines/${item.id}`)}
                          >
                            <td className="px-3 py-1.5">
                              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                                {item.daysUntilExpiry}d left
                              </Badge>
                            </td>
                            <td className="px-3 py-1.5 font-mono">{item.serialNumber}</td>
                            <td className="px-3 py-1.5">{item.modelName || "-"}</td>
                            <td className="px-3 py-1.5">{item.company.name}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">
                              {formatDate(item.rentalEndDate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Aging High Performers */}
            {(alerts?.agingHighPerformers.length || 0) > 0 && (
              <Card>
                <CardHeader className="pb-2 pt-3 px-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      Aging High Performers
                      <span className="text-muted-foreground font-normal text-xs">
                        Old machines with high usage - consider upgrading
                      </span>
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 border-y">
                        <tr>
                          <th className="px-3 py-1.5 text-left font-medium">Serial</th>
                          <th className="px-3 py-1.5 text-left font-medium">Model</th>
                          <th className="px-3 py-1.5 text-left font-medium">Store</th>
                          <th className="px-3 py-1.5 text-right font-medium">Age</th>
                          <th className="px-3 py-1.5 text-right font-medium">Monthly Vol</th>
                          <th className="px-3 py-1.5 text-right font-medium">vs Model Avg</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {alerts?.agingHighPerformers.slice(0, 5).map((item) => (
                          <tr
                            key={item.id}
                            className="hover:bg-muted/50 cursor-pointer"
                            onClick={() => router.push(`/machines/${item.id}`)}
                          >
                            <td className="px-3 py-1.5 font-mono">{item.serialNumber}</td>
                            <td className="px-3 py-1.5">{item.modelName || "-"}</td>
                            <td className="px-3 py-1.5">{item.company.name}</td>
                            <td className="px-3 py-1.5 text-right text-muted-foreground">
                              {item.ageInMonths ? `${Math.floor(item.ageInMonths / 12)}y ${item.ageInMonths % 12}m` : "-"}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono">
                              {formatNumber(item.monthlyAverage)}
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              <span className="text-green-600 font-medium">+{item.vsModelAvg}%</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Underutilized New Machines */}
            {(alerts?.underutilizedNew.length || 0) > 0 && (
              <Card>
                <CardHeader className="pb-2 pt-3 px-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-amber-600" />
                      Underutilized New Machines
                      <span className="text-muted-foreground font-normal text-xs">
                        New machines not getting enough volume - consider relocating
                      </span>
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 border-y">
                        <tr>
                          <th className="px-3 py-1.5 text-left font-medium">Serial</th>
                          <th className="px-3 py-1.5 text-left font-medium">Model</th>
                          <th className="px-3 py-1.5 text-left font-medium">Store</th>
                          <th className="px-3 py-1.5 text-right font-medium">Monthly Vol</th>
                          <th className="px-3 py-1.5 text-right font-medium">vs Fleet Avg</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {alerts?.underutilizedNew.slice(0, 5).map((item) => (
                          <tr
                            key={item.id}
                            className="hover:bg-muted/50 cursor-pointer"
                            onClick={() => router.push(`/machines/${item.id}`)}
                          >
                            <td className="px-3 py-1.5 font-mono">{item.serialNumber}</td>
                            <td className="px-3 py-1.5">{item.modelName || "-"}</td>
                            <td className="px-3 py-1.5">{item.company.name}</td>
                            <td className="px-3 py-1.5 text-right font-mono">
                              {formatNumber(item.monthlyAverage)}
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              <span className="text-red-600 font-medium">{item.vsFleetAvg}%</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Lift Suggestions */}
            {(alerts?.liftSuggestions.length || 0) > 0 && (
              <Card>
                <CardHeader className="pb-2 pt-3 px-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ArrowRightLeft className="h-4 w-4 text-purple-600" />
                      Lift Suggestions
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={() => router.push("/lift")}>
                      Open Planner <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 border-y">
                        <tr>
                          <th className="px-3 py-1.5 text-left font-medium">Serial</th>
                          <th className="px-3 py-1.5 text-left font-medium">Model</th>
                          <th className="px-3 py-1.5 text-left font-medium">Current Store</th>
                          <th className="px-3 py-1.5 text-left font-medium">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {alerts?.liftSuggestions.slice(0, 5).map((item, idx) => (
                          <tr
                            key={idx}
                            className="hover:bg-muted/50 cursor-pointer"
                            onClick={() => router.push(`/machines/${item.machine.id}`)}
                          >
                            <td className="px-3 py-1.5 font-mono">{item.machine.serialNumber}</td>
                            <td className="px-3 py-1.5">{item.machine.modelName || "-"}</td>
                            <td className="px-3 py-1.5">{item.currentStore}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{item.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Performance Overview */}
          <div className="space-y-4">
            {/* Quick Stats */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Fleet Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-3 pb-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Active Machines</span>
                  <span className="font-mono font-bold">{formatNumber(dashboardData?.summary.activeMachines || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Stores</span>
                  <span className="font-mono font-bold">{summary?.totalStores || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Avg Volume/Machine</span>
                  <span className="font-mono">{formatNumber(summary?.fleetAvgVolumePerMachine || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Store Median Vol</span>
                  <span className="font-mono">{formatNumber(summary?.storeMedianVolumePerMachine || 0)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Top Performing Stores */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-green-600" />
                  Top Stores
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 px-3 pb-3">
                {alerts?.storePerformance.topStores.map((store) => (
                  <div
                    key={store.companyId}
                    className="flex justify-between items-center text-xs cursor-pointer hover:bg-muted/50 -mx-1 px-1 py-0.5 rounded"
                    onClick={() => router.push(`/stores/${store.companyId}`)}
                  >
                    <span className="font-medium truncate">{store.companyName}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-muted-foreground">{formatNumber(store.avgPerMachine)}</span>
                      <span className="text-green-600 text-[10px]">+{store.vsMedian}%</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Underperforming Stores */}
            {(alerts?.storePerformance.underperformingStores.length || 0) > 0 && (
              <Card className="border-amber-200">
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-amber-600" />
                    Underperforming Stores
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 px-3 pb-3">
                  {alerts?.storePerformance.underperformingStores.map((store) => (
                    <div
                      key={store.companyId}
                      className="flex justify-between items-center text-xs cursor-pointer hover:bg-muted/50 -mx-1 px-1 py-0.5 rounded"
                      onClick={() => router.push(`/stores/${store.companyId}`)}
                    >
                      <span className="font-medium truncate">{store.companyName}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-muted-foreground">{formatNumber(store.avgPerMachine)}</span>
                        <span className="text-red-600 text-[10px]">{store.vsMedian}%</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Stores Missing Capabilities */}
            {(alerts?.storeCapabilityGaps.length || 0) > 0 && (
              <Card>
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Capability Gaps
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 px-3 pb-3">
                  {alerts?.storeCapabilityGaps.slice(0, 5).map((store) => (
                    <div
                      key={store.companyId}
                      className="text-xs cursor-pointer hover:bg-muted/50 -mx-1 px-1 py-0.5 rounded"
                      onClick={() => router.push(`/stores/${store.companyId}`)}
                    >
                      <div className="font-medium">{store.companyName}</div>
                      <div className="text-muted-foreground">
                        Missing: {store.missingCategories.join(", ")}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 px-3 pb-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs h-7"
                  onClick={() => router.push("/machines")}
                >
                  View All Machines
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs h-7"
                  onClick={() => router.push("/contracts")}
                >
                  Manage Contracts
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs h-7"
                  onClick={() => router.push("/lift")}
                >
                  Open Lift Planner
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs h-7"
                  onClick={() => router.push("/sync")}
                >
                  Sync Status
                </Button>
              </CardContent>
            </Card>

            {/* Last Sync Info */}
            {dashboardData?.lastSync && (
              <Card>
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Last Sync
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-xs px-3 pb-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Completed</span>
                    <span>{formatDate(dashboardData.lastSync.completedAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Machines</span>
                    <span className="font-mono">{formatNumber(dashboardData.lastSync.machinesProcessed)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Readings</span>
                    <span className="font-mono">{formatNumber(dashboardData.lastSync.readingsProcessed)}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
