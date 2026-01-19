"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoading } from "@/components/ui/page-loading";
import { RefreshCw, CheckCircle, XCircle, Clock } from "lucide-react";
import { formatNumber, formatDate } from "@/lib/utils";

interface SyncLog {
  id: string;
  syncType: string;
  targetCompany: string | null;
  startedAt: string;
  completedAt: string | null;
  companiesProcessed: number;
  machinesProcessed: number;
  readingsProcessed: number;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  errors: string | null;
}

interface SyncData {
  history: SyncLog[];
  lastSuccessfulSync: SyncLog | null;
  totals: {
    machines: number;
    readings: number;
    companies: number;
  };
}

export default function SyncPage() {
  const [data, setData] = useState<SyncData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/sync?limit=20");
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error("Failed to fetch sync data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "full" }),
      });
      await fetchData();
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setIsSyncing(false);
    }
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
          title="Sync"
          description="BMS database synchronization"
        >
          <Button size="sm" className="h-7 text-xs" onClick={handleSync} disabled={isSyncing}>
            <RefreshCw className={`h-3 w-3 mr-1 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing..." : "Run Full Sync"}
          </Button>
        </PageHeader>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Totals */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-sm">Database Totals</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Companies</span>
                <span className="font-mono">{formatNumber(data?.totals.companies || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Machines</span>
                <span className="font-mono">{formatNumber(data?.totals.machines || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Readings</span>
                <span className="font-mono">{formatNumber(data?.totals.readings || 0)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Last Successful */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-sm">Last Successful Sync</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {data?.lastSuccessfulSync ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Completed</p>
                    <p className="font-mono">{formatDate(data.lastSuccessfulSync.completedAt!)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Companies</p>
                    <p className="font-mono">{data.lastSuccessfulSync.companiesProcessed}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Machines</p>
                    <p className="font-mono">{formatNumber(data.lastSuccessfulSync.machinesProcessed)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Readings</p>
                    <p className="font-mono">{formatNumber(data.lastSuccessfulSync.readingsProcessed)}</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No successful sync recorded</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sync History */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-sm">Sync History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 border-y">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium">Status</th>
                    <th className="px-3 py-1.5 text-left font-medium">Type</th>
                    <th className="px-3 py-1.5 text-left font-medium">Started</th>
                    <th className="px-3 py-1.5 text-right font-medium">Companies</th>
                    <th className="px-3 py-1.5 text-right font-medium">Machines</th>
                    <th className="px-3 py-1.5 text-right font-medium">Readings</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data?.history.map((log) => (
                    <tr key={log.id}>
                      <td className="px-3 py-1.5">
                        {log.status === "COMPLETED" && (
                          <Badge variant="default" className="text-[10px] px-1.5 py-0 gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Done
                          </Badge>
                        )}
                        {log.status === "RUNNING" && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
                            <Clock className="h-3 w-3" />
                            Running
                          </Badge>
                        )}
                        {log.status === "FAILED" && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 gap-1">
                            <XCircle className="h-3 w-3" />
                            Failed
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-1.5">{log.syncType}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{formatDate(log.startedAt)}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{log.companiesProcessed}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{formatNumber(log.machinesProcessed)}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{formatNumber(log.readingsProcessed)}</td>
                    </tr>
                  ))}
                  {(!data?.history || data.history.length === 0) && (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">
                        No sync history
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
