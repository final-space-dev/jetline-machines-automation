"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import { formatNumber, formatDate } from "@/lib/utils";

interface DashboardData {
  summary: {
    totalMachines: number;
    activeMachines: number;
    totalBalance: number;
    totalVolumeInPeriod: number;
    totalColorVolume: number;
    totalBlackVolume: number;
    avgVolumePerMachine: number;
    dailyAverage: number;
    monthlyAverage: number;
    companiesCount: number;
    categoriesCount: number;
    colorPercentage: number;
  };
  period: {
    days: number;
    start: string;
    end: string;
  };
  lastSync: {
    completedAt: string;
    machinesProcessed: number;
    readingsProcessed: number;
  } | null;
  machinesByStatus: { status: string; count: number }[];
  machinesByCategory: { category: string; count: number }[];
  modelDistribution: { model: string; count: number; totalBalance: number }[];
}

interface StoreData {
  id: string;
  name: string;
  region: string | null;
  bmsSchema: string;
  isActive: boolean;
  _count?: { machines: number };
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardData | null>(null);
  const [stores, setStores] = useState<StoreData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [dashboardRes, companiesRes] = await Promise.all([
        fetch("/api/dashboard"),
        fetch("/api/companies"),
      ]);

      const dashboardData = await dashboardRes.json();
      const companiesData = await companiesRes.json();

      setStats(dashboardData);
      setStores(companiesData.sort((a: StoreData, b: StoreData) =>
        (b._count?.machines || 0) - (a._count?.machines || 0)
      ));
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-[500px]" />
        </div>
      </AppShell>
    );
  }

  const totalMachines = stats?.summary.totalMachines || 0;
  const activeMachines = stats?.summary.activeMachines || 0;

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-xs text-muted-foreground">
            {stats?.summary.companiesCount || 0} stores · {totalMachines} machines · Last sync: {stats?.lastSync ? formatDate(stats.lastSync.completedAt) : "Never"}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Left Column - Summary & By Model */}
          <div className="lg:col-span-2 space-y-4">
            {/* Fleet Summary */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm">Fleet Summary (Last {stats?.period.days || 90} Days)</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Total Machines</p>
                    <p className="font-mono font-bold">{formatNumber(totalMachines)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Active</p>
                    <p className="font-mono font-bold text-green-600">{formatNumber(activeMachines)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Inactive</p>
                    <p className="font-mono font-bold text-yellow-600">{formatNumber(totalMachines - activeMachines)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Stores</p>
                    <p className="font-mono font-bold">{stats?.summary.companiesCount || 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Balance</p>
                    <p className="font-mono">{formatNumber(stats?.summary.totalBalance || 0)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Period Volume</p>
                    <p className="font-mono">{formatNumber(stats?.summary.totalVolumeInPeriod || 0)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Color Volume</p>
                    <p className="font-mono text-blue-600">{formatNumber(stats?.summary.totalColorVolume || 0)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Black Volume</p>
                    <p className="font-mono">{formatNumber(stats?.summary.totalBlackVolume || 0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* By Model */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">By Model</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => router.push("/models")}>
                    View All
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-y">
                      <tr>
                        <th className="px-3 py-1.5 text-left font-medium">Model</th>
                        <th className="px-3 py-1.5 text-right font-medium">Count</th>
                        <th className="px-3 py-1.5 text-right font-medium">Total Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {stats?.modelDistribution.map((item) => (
                        <tr
                          key={item.model}
                          className="hover:bg-muted/50 cursor-pointer"
                          onClick={() => router.push(`/models/${encodeURIComponent(item.model)}`)}
                        >
                          <td className="px-3 py-1.5 font-medium">{item.model}</td>
                          <td className="px-3 py-1.5 text-right font-mono">{item.count}</td>
                          <td className="px-3 py-1.5 text-right font-mono">{formatNumber(item.totalBalance)}</td>
                        </tr>
                      ))}
                      {(!stats?.modelDistribution || stats.modelDistribution.length === 0) && (
                        <tr>
                          <td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">
                            No data available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Breakdowns */}
          <div className="space-y-4">
            {/* By Status */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm">By Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 px-3 pb-3">
                {stats?.machinesByStatus.map((item) => (
                  <div key={item.status} className="flex justify-between items-center text-xs">
                    <Badge variant={item.status === "ACTIVE" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                      {item.status}
                    </Badge>
                    <span className="font-mono">{item.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* By Category */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm">By Category</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 px-3 pb-3">
                {stats?.machinesByCategory.map((item) => (
                  <div key={item.category} className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">{item.category}</span>
                    <span className="font-mono">{item.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Stores Quick View */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Stores</CardTitle>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => router.push("/stores")}>
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-0.5 px-3 pb-3">
                {stores.slice(0, 8).map((store) => (
                  <div
                    key={store.id}
                    className="flex justify-between items-center text-xs cursor-pointer hover:bg-muted/50 -mx-1 px-1 py-0.5 rounded"
                    onClick={() => router.push(`/stores/${store.id}`)}
                  >
                    <span className="font-medium truncate">{store.name}</span>
                    <span className="font-mono text-muted-foreground">{store._count?.machines || 0}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Last Sync Info */}
            {stats?.lastSync && (
              <Card>
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-sm">Last Sync</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-xs px-3 pb-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Completed</span>
                    <span>{formatDate(stats.lastSync.completedAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Machines</span>
                    <span className="font-mono">{formatNumber(stats.lastSync.machinesProcessed)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Readings</span>
                    <span className="font-mono">{formatNumber(stats.lastSync.readingsProcessed)}</span>
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
