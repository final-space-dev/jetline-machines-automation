"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { exportToExcel, exportToCSV } from "@/lib/export";
import { Download, FileSpreadsheet } from "lucide-react";

interface ModelData {
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
}

interface ApiResponse {
  period: {
    days: number;
    start: string;
    end: string;
  };
  totalModels: number;
  totalMachines: number;
  models: ModelData[];
}

export default function ModelsPage() {
  const router = useRouter();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<string>("90");

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/analytics/models?period=${period}`);
      const result = await res.json();
      setData(result);
    } catch (error) {
      console.error("Failed to fetch model data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-[400px]" />
        </div>
      </AppShell>
    );
  }

  const models = data?.models || [];

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Models</h1>
            <p className="text-xs text-muted-foreground">
              {data?.totalModels || 0} models · {data?.totalMachines || 0} active machines
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() =>
                exportToExcel(
                  models.map((m) => ({
                    model: m.modelName,
                    make: m.makeName,
                    machines: m.machineCount,
                    avgMonthly: m.statistics.averageMonthlyPerMachine,
                    totalVolume: m.statistics.totalVolume,
                    minVolume: m.statistics.minVolume,
                    maxVolume: m.statistics.maxVolume,
                  })),
                  [
                    { key: "model", header: "Model" },
                    { key: "make", header: "Make" },
                    { key: "machines", header: "Machines" },
                    { key: "avgMonthly", header: "Avg Monthly" },
                    { key: "totalVolume", header: "Total Volume" },
                    { key: "minVolume", header: "Min" },
                    { key: "maxVolume", header: "Max" },
                  ],
                  "models"
                )
              }
            >
              <FileSpreadsheet className="h-3 w-3 mr-1" />
              Excel
            </Button>
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
        </div>

        {/* Models Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 border-y">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium">Model</th>
                    <th className="px-3 py-1.5 text-left font-medium">Make</th>
                    <th className="px-3 py-1.5 text-right font-medium">Machines</th>
                    <th className="px-3 py-1.5 text-right font-medium">Avg Monthly</th>
                    <th className="px-3 py-1.5 text-right font-medium">Total Volume</th>
                    <th className="px-3 py-1.5 text-right font-medium">Min</th>
                    <th className="px-3 py-1.5 text-right font-medium">Max</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {models
                    .sort((a, b) => b.machineCount - a.machineCount)
                    .map((model) => (
                      <tr
                        key={model.modelName}
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => router.push(`/models/${encodeURIComponent(model.modelName)}`)}
                      >
                        <td className="px-3 py-1.5 font-medium">{model.modelName}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{model.makeName || "-"}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{model.machineCount}</td>
                        <td className="px-3 py-1.5 text-right font-mono font-medium">
                          {formatNumber(model.statistics.averageMonthlyPerMachine)}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">
                          {formatNumber(model.statistics.totalVolume)}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">
                          {formatNumber(model.statistics.minVolume)}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">
                          {formatNumber(model.statistics.maxVolume)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
