"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageLoading } from "@/components/ui/page-loading";
import { NotFoundState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { formatNumber, formatDate, cn } from "@/lib/utils";

interface MachineData {
  id: string;
  serialNumber: string;
  company: { id: string; name: string } | null;
  currentBalance: number;
  installDate: string | null;
  totalVolumeInPeriod: number;
  dailyAverage: number;
  monthlyAverage: number;
  readingsCount: number;
  lastReadingDate: string | null;
  colorVolume: number;
  blackVolume: number;
}

interface ModelAnalytics {
  modelName: string;
  makeName: string | null;
  machineCount: number;
  statistics: {
    totalVolume: number;
    averageVolumePerMachine: number;
    averageMonthlyPerMachine: number;
    minVolume: number;
    maxVolume: number;
    standardDeviation: number;
  };
  machines: MachineData[];
}

export default function ModelDetailPage() {
  const router = useRouter();
  const params = useParams();
  const modelName = decodeURIComponent(params.modelName as string);

  const [modelData, setModelData] = useState<ModelAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<string>("90");

  useEffect(() => {
    fetchData();
  }, [modelName, period]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/analytics/models?modelName=${encodeURIComponent(modelName)}&period=${period}`);
      const result = await res.json();
      // The API returns models array, find the one matching our model
      const model = result.models?.find((m: ModelAnalytics) => m.modelName === modelName);
      setModelData(model || null);
    } catch (error) {
      console.error("Failed to fetch model data:", error);
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

  if (!modelData) {
    return (
      <AppShell>
        <NotFoundState type="model" />
        <div className="flex justify-center mt-4">
          <Button onClick={() => router.push("/models")}>
            Back to Models
          </Button>
        </div>
      </AppShell>
    );
  }

  const avgMonthly = modelData.statistics.averageMonthlyPerMachine;

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">{modelData.modelName}</h1>
              <p className="text-xs text-muted-foreground">
                {modelData.makeName || "Unknown Make"} · {modelData.machineCount} machines
              </p>
            </div>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
              <SelectItem value="180">6 months</SelectItem>
              <SelectItem value="365">1 year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Model Statistics */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-sm">Model Statistics (Last {period} days)</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-2 text-xs">
              <div>
                <p className="text-muted-foreground">Total Volume</p>
                <p className="font-mono font-bold">{formatNumber(modelData.statistics.totalVolume)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Avg Monthly/Machine</p>
                <p className="font-mono font-bold">{formatNumber(modelData.statistics.averageMonthlyPerMachine)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Min Volume</p>
                <p className="font-mono">{formatNumber(modelData.statistics.minVolume)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Max Volume</p>
                <p className="font-mono">{formatNumber(modelData.statistics.maxVolume)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Std Deviation</p>
                <p className="font-mono">{formatNumber(modelData.statistics.standardDeviation)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Machine Count</p>
                <p className="font-mono">{modelData.machineCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Machines Table */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-sm">Machines of this Model</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 border-y">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium">Serial</th>
                    <th className="px-3 py-1.5 text-left font-medium">Store</th>
                    <th className="px-3 py-1.5 text-right font-medium">Balance</th>
                    <th className="px-3 py-1.5 text-right font-medium">Period Vol</th>
                    <th className="px-3 py-1.5 text-right font-medium">Monthly Avg</th>
                    <th className="px-3 py-1.5 text-right font-medium">Color</th>
                    <th className="px-3 py-1.5 text-right font-medium">Black</th>
                    <th className="px-3 py-1.5 text-right font-medium">vs Avg</th>
                    <th className="px-3 py-1.5 text-left font-medium">Install</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {modelData.machines.map((machine) => {
                    const vsAvg = avgMonthly > 0
                      ? ((machine.monthlyAverage - avgMonthly) / avgMonthly) * 100
                      : null;

                    return (
                      <tr
                        key={machine.id}
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => router.push(`/machines/${machine.id}`)}
                      >
                        <td className="px-3 py-1.5 font-mono">{machine.serialNumber}</td>
                        <td className="px-3 py-1.5">{machine.company?.name || "-"}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{formatNumber(machine.currentBalance)}</td>
                        <td className="px-3 py-1.5 text-right font-mono font-medium">{formatNumber(machine.totalVolumeInPeriod)}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{formatNumber(machine.monthlyAverage)}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-blue-600">{formatNumber(machine.colorVolume)}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{formatNumber(machine.blackVolume)}</td>
                        <td className="px-3 py-1.5 text-right">
                          {vsAvg !== null && (
                            <span className={cn(
                              "font-mono",
                              vsAvg > 10 ? "text-green-600" : vsAvg < -10 ? "text-red-600" : "text-muted-foreground"
                            )}>
                              {vsAvg > 0 ? "+" : ""}{vsAvg.toFixed(0)}%
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground">{formatDate(machine.installDate)}</td>
                      </tr>
                    );
                  })}
                  {modelData.machines.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-4 text-center text-muted-foreground">
                        No machines found for this model
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
