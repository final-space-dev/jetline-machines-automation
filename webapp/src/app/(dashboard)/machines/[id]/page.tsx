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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  AlertTriangle,
  Lightbulb,
  Calendar,
  Banknote,
} from "lucide-react";
import { formatNumber, formatDate, cn, getStatusVariant } from "@/lib/utils";
import { utilizationConfig, type UtilizationStatus } from "@/components/ui/utilization-badge";
import type { MachineWithRelations, MachineUtilization, MachineRate } from "@/types";

// Helper to format rate values (cents to currency display)
function formatRate(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${(Number(value) * 100).toFixed(2)}c`;
}

interface MonthlyReading {
  month: string;
  endBalance: number;
  volume: number;
  colorVolume: number;
  blackVolume: number;
  prevVolume: number | null;
  change: number | null;
}

export default function MachineDetailPage() {
  const router = useRouter();
  const params = useParams();
  const machineId = params.id as string;

  const [machine, setMachine] = useState<MachineWithRelations | null>(null);
  const [utilization, setUtilization] = useState<MachineUtilization | null>(null);
  const [monthlyReadings, setMonthlyReadings] = useState<MonthlyReading[]>([]);
  const [currentRate, setCurrentRate] = useState<MachineRate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [period, setPeriod] = useState<string>("12");

  useEffect(() => {
    fetchData();
  }, [machineId, period]);

  const fetchData = async () => {
    try {
      const [machineRes, readingsRes, utilizationRes, companiesRes, ratesRes] = await Promise.all([
        fetch(`/api/machines/${machineId}`),
        fetch(`/api/machines/${machineId}/readings?months=${period}`),
        fetch(`/api/machines/utilization`),
        fetch("/api/companies"),
        fetch(`/api/machines/rates?machineId=${machineId}&current=true`),
      ]);

      const machineData = await machineRes.json();
      const readingsData = await readingsRes.json();
      const utilizationData = await utilizationRes.json();
      const companiesData = await companiesRes.json();
      const ratesData = await ratesRes.json();

      // Handle API error responses
      const companiesArray = Array.isArray(companiesData) ? companiesData : [];

      // Find this machine's utilization data
      const machineUtilization = utilizationData?.machines?.find(
        (u: MachineUtilization) => u.machineId === machineId
      ) || null;

      // Get current rate
      const machineRateData = ratesData?.data?.[0];
      setCurrentRate(machineRateData?.currentRate || null);

      setMachine(machineData?.id ? machineData : null);
      setUtilization(machineUtilization);
      setMonthlyReadings(Array.isArray(readingsData?.monthly) ? readingsData.monthly : []);
      setStores(companiesArray.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
      setSelectedStore(machineData.companyId);
    } catch (error) {
      console.error("Failed to fetch machine data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMoveToStore = async () => {
    if (!selectedStore || selectedStore === machine?.companyId) return;
    try {
      await fetch(`/api/machines/${machineId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: selectedStore }),
      });
      await fetchData();
    } catch (error) {
      console.error("Failed to move machine:", error);
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <PageLoading variant="detail" />
      </AppShell>
    );
  }

  if (!machine) {
    return (
      <AppShell>
        <NotFoundState type="machine" />
        <div className="flex justify-center mt-4">
          <Button onClick={() => router.push("/machines")}>
            Back to Machines
          </Button>
        </div>
      </AppShell>
    );
  }

  const utilizationStatus = utilization?.utilizationStatus as UtilizationStatus | undefined;
  const config = utilizationStatus ? utilizationConfig[utilizationStatus] : null;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold">
                  {machine.modelName || "Unknown Model"} - {machine.company?.name}
                </h1>
                <Badge variant={getStatusVariant(machine.status as "ACTIVE" | "INACTIVE" | "MAINTENANCE" | "DECOMMISSIONED")} className="text-[10px] px-1.5 py-0">{machine.status}</Badge>
                {utilization && config && (
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] px-1.5 py-0", config.badgeBg)}
                  >
                    {utilization.utilizationPercent}% Utilization
                  </Badge>
                )}
                {utilization && utilization.liftScore >= 70 && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] px-1.5 py-0",
                      utilization.liftScore >= 80
                        ? "bg-red-100 text-red-700 border-red-300"
                        : "bg-amber-100 text-amber-700 border-amber-300"
                    )}
                  >
                    <Target className="h-2.5 w-2.5 mr-0.5" />
                    Lift Score: {utilization.liftScore}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                {machine.serialNumber}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Left Column - Machine Information */}
          <div className="lg:col-span-2 space-y-4">
            {/* Utilization & Insights Card (NEW) */}
            {utilization && config && (
              <Card className={cn(
                "border-l-4",
                utilization.utilizationStatus === "critical" && "border-l-red-500",
                utilization.utilizationStatus === "low" && "border-l-amber-500",
                utilization.utilizationStatus === "optimal" && "border-l-emerald-500",
                utilization.utilizationStatus === "high" && "border-l-blue-500",
                utilization.utilizationStatus === "overworked" && "border-l-purple-500"
              )}>
                <CardHeader className="pb-2 pt-3 px-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      Performance & Insights
                      {utilization.trendDirection === "up" && (
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                      )}
                      {utilization.trendDirection === "down" && (
                        <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                      )}
                      {utilization.trendDirection === "stable" && (
                        <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </CardTitle>
                    <Badge variant="outline" className={cn("text-xs", config.badgeBg)}>
                      {config.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-3 pb-3 space-y-4">
                  {/* Utilization Bar */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">Utilization</span>
                      <span className={cn("text-sm font-bold", config.color)}>
                        {utilization.utilizationPercent}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", config.bgColor)}
                        style={{ width: `${Math.min(utilization.utilizationPercent, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                      <span>0%</span>
                      <span>Duty: {formatNumber(utilization.dutyCycle)}/mo</span>
                      <span>100%</span>
                    </div>
                  </div>

                  {/* Key Metrics Grid */}
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="bg-muted/50 rounded-lg p-2 text-center">
                      <p className="text-muted-foreground text-[10px]">Avg Monthly</p>
                      <p className="font-mono font-bold">{formatNumber(utilization.avgMonthlyVolume)}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2 text-center">
                      <p className="text-muted-foreground text-[10px]">Trend</p>
                      <p className={cn(
                        "font-mono font-bold",
                        utilization.volumeTrend > 0 ? "text-emerald-600" : utilization.volumeTrend < 0 ? "text-red-600" : ""
                      )}>
                        {utilization.volumeTrend > 0 ? "+" : ""}{utilization.volumeTrend}%
                      </p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2 text-center">
                      <p className="text-muted-foreground text-[10px]">Lift Score</p>
                      <p className={cn(
                        "font-mono font-bold",
                        utilization.liftScore >= 80 ? "text-red-600" : utilization.liftScore >= 60 ? "text-amber-600" : ""
                      )}>
                        {utilization.liftScore}/100
                      </p>
                    </div>
                  </div>

                  {/* Insights */}
                  {utilization.insights.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium flex items-center gap-1.5">
                        <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                        Insights
                      </p>
                      <ul className="space-y-1">
                        {utilization.insights.map((insight, idx) => (
                          <li
                            key={idx}
                            className={cn(
                              "text-xs px-2 py-1 rounded-md",
                              insight.includes("Critical") || insight.includes("declining") || insight.includes("ends in")
                                ? "bg-red-50 text-red-700"
                                : insight.includes("Low") || insight.includes("Consider")
                                  ? "bg-amber-50 text-amber-700"
                                  : insight.includes("growing") || insight.includes("high demand")
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-muted text-muted-foreground"
                            )}
                          >
                            • {insight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Machine Information */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm">Machine Information</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Serial Number</p>
                    <p className="font-mono font-medium">{machine.serialNumber}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Model</p>
                    <p className="font-medium">{machine.modelName || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Make</p>
                    <p className="font-medium">{machine.makeName || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Category</p>
                    <p className="font-medium">{machine.category?.name || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">BMS Machine No</p>
                    <p className="font-mono">{machine.bmsMachineNo || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Store</p>
                    <p className="font-medium">{machine.company?.name || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Install Date</p>
                    <p>{formatDate(machine.installDate)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Contract Type</p>
                    <p>{machine.contractType || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Rental Amount</p>
                    <p className="font-mono">R {machine.rentalAmountExVat ? Number(machine.rentalAmountExVat).toFixed(2) : "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Rental Start</p>
                    <p>{formatDate(machine.rentalStartDate)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Rental End</p>
                    <p>{formatDate(machine.rentalEndDate)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Is Lifted</p>
                    <p>{machine.isLifted ? "Yes" : "No"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Volume History - Horizontal (months as columns) */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Volume History</CardTitle>
                  <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger className="w-28 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6">6 months</SelectItem>
                      <SelectItem value="12">12 months</SelectItem>
                      <SelectItem value="24">24 months</SelectItem>
                      <SelectItem value="60">5 years</SelectItem>
                      <SelectItem value="all">All time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {monthlyReadings.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 border-y">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium sticky left-0 bg-muted/50">Metric</th>
                          {monthlyReadings.slice().reverse().map((r) => (
                            <th key={r.month} className="px-2 py-1.5 text-right font-medium whitespace-nowrap">
                              {r.month}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        <tr>
                          <td className="px-2 py-1.5 font-medium text-muted-foreground sticky left-0 bg-background">End Balance</td>
                          {monthlyReadings.slice().reverse().map((r) => (
                            <td key={r.month} className="px-2 py-1.5 text-right font-mono">{formatNumber(r.endBalance)}</td>
                          ))}
                        </tr>
                        <tr className="bg-blue-50/30">
                          <td className="px-2 py-1.5 font-medium sticky left-0 bg-blue-50/30">Volume</td>
                          {monthlyReadings.slice().reverse().map((r) => (
                            <td key={r.month} className="px-2 py-1.5 text-right font-mono font-medium">{formatNumber(r.volume)}</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="px-2 py-1.5 font-medium text-blue-600 sticky left-0 bg-background">Color</td>
                          {monthlyReadings.slice().reverse().map((r) => (
                            <td key={r.month} className="px-2 py-1.5 text-right font-mono text-blue-600">{formatNumber(r.colorVolume)}</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="px-2 py-1.5 font-medium text-muted-foreground sticky left-0 bg-background">Black</td>
                          {monthlyReadings.slice().reverse().map((r) => (
                            <td key={r.month} className="px-2 py-1.5 text-right font-mono">{formatNumber(r.blackVolume)}</td>
                          ))}
                        </tr>
                        <tr>
                          <td className="px-2 py-1.5 font-medium text-muted-foreground sticky left-0 bg-background">vs Prev</td>
                          {monthlyReadings.slice().reverse().map((r) => (
                            <td key={r.month} className="px-2 py-1.5 text-right">
                              {r.change !== null ? (
                                <span className={cn(
                                  "font-mono",
                                  r.change > 0 ? "text-green-600" : r.change < 0 ? "text-red-600" : "text-muted-foreground"
                                )}>
                                  {r.change > 0 ? "+" : ""}{r.change.toFixed(0)}%
                                </span>
                              ) : "-"}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                    No reading history available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Key Metrics & Actions */}
          <div className="space-y-4">
            {/* Key Metrics */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm">Key Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-3 pb-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Current Balance</span>
                  <span className="font-mono font-bold">{formatNumber(machine.currentBalance)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Last Reading</span>
                  <span>{formatDate(machine.lastReadingDate)}</span>
                </div>
                {monthlyReadings.length > 0 && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Latest Month Vol</span>
                      <span className="font-mono font-medium">{formatNumber(monthlyReadings[0]?.volume || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Avg Monthly Vol</span>
                      <span className="font-mono">
                        {formatNumber(Math.round(monthlyReadings.reduce((s, r) => s + r.volume, 0) / monthlyReadings.length))}
                      </span>
                    </div>
                  </>
                )}
                {utilization && (
                  <>
                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Duty Cycle</span>
                        <span className="font-mono">{formatNumber(utilization.dutyCycle)}/mo</span>
                      </div>
                    </div>
                    {utilization.contractMonthsRemaining !== null && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Contract Remaining</span>
                        <span className={cn(
                          "font-medium",
                          utilization.contractMonthsRemaining <= 3 ? "text-red-600" : utilization.contractMonthsRemaining <= 6 ? "text-amber-600" : ""
                        )}>
                          {utilization.contractMonthsRemaining} months
                        </span>
                      </div>
                    )}
                    {utilization.daysSinceLastReading !== null && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Days Since Reading</span>
                        <span className={cn(
                          utilization.daysSinceLastReading > 60 ? "text-amber-600 font-medium" : ""
                        )}>
                          {utilization.daysSinceLastReading} days
                        </span>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Rates Card */}
            {currentRate && (
              <Card>
                <CardHeader className="pb-2 pt-3 px-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Current Rates</CardTitle>
                    <span className="text-[10px] text-muted-foreground">
                      From: {formatDate(currentRate.ratesFrom)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 px-3 pb-3 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-[10px] text-muted-foreground">A4 Mono</p>
                      <p className="font-mono font-bold text-gray-700">{formatRate(currentRate.a4Mono)}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-[10px] text-muted-foreground">A4 Colour</p>
                      <p className="font-mono font-bold text-blue-700">{formatRate(currentRate.a4Colour)}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-[10px] text-muted-foreground">A3 Mono</p>
                      <p className="font-mono font-medium">{formatRate(currentRate.a3Mono)}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-[10px] text-muted-foreground">A3 Colour</p>
                      <p className="font-mono font-medium text-blue-600">{formatRate(currentRate.a3Colour)}</p>
                    </div>
                  </div>
                  {(currentRate.meters || currentRate.colourExtraLarge) && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {currentRate.meters && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Meters</span>
                          <span className="font-mono">{formatRate(currentRate.meters)}</span>
                        </div>
                      )}
                      {currentRate.colourExtraLarge && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">XL Colour</span>
                          <span className="font-mono text-blue-600">{formatRate(currentRate.colourExtraLarge)}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="pt-1 border-t">
                    <p className="text-[10px] text-muted-foreground">
                      Category: {currentRate.category}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Monthly FSMA Cost Card */}
            {utilization && utilization.hasRates && utilization.monthlyCost > 0 && (
              <Card className="border-l-4 border-l-red-500">
                <CardHeader className="pb-2 pt-3 px-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-1.5">
                      <Banknote className="h-4 w-4 text-red-600" />
                      Monthly FSMA Cost
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 px-3 pb-3 text-xs">
                  <div className="text-center py-2">
                    <p className="text-2xl font-bold text-red-700 font-mono">
                      R{utilization.monthlyCost.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Volume × Rates = Cost to FSMA</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">Mono</p>
                      <p className="font-mono font-medium text-gray-700">
                        R{utilization.monoCost.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">Colour</p>
                      <p className="font-mono font-medium text-blue-700">
                        R{utilization.colourCost.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground pt-1">
                    Based on {formatNumber(utilization.avgMonthlyVolume)} avg monthly clicks
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Contract Status Card */}
            {utilization && utilization.contractMonthsRemaining !== null && utilization.contractMonthsRemaining <= 6 && (
              <Card className={cn(
                "border-l-4",
                utilization.contractMonthsRemaining <= 3 ? "border-l-red-500" : "border-l-amber-500"
              )}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <Calendar className={cn(
                      "h-4 w-4 mt-0.5",
                      utilization.contractMonthsRemaining <= 3 ? "text-red-500" : "text-amber-500"
                    )} />
                    <div>
                      <p className={cn(
                        "text-xs font-medium",
                        utilization.contractMonthsRemaining <= 3 ? "text-red-700" : "text-amber-700"
                      )}>
                        Contract {utilization.contractMonthsRemaining <= 3 ? "Expiring Soon" : "Ending"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {utilization.contractMonthsRemaining} months remaining
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Lift Recommendation Card */}
            {utilization && utilization.liftScore >= 70 && (
              <Card className={cn(
                "border-l-4",
                utilization.liftScore >= 80 ? "border-l-red-500" : "border-l-amber-500"
              )}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <Target className={cn(
                      "h-4 w-4 mt-0.5",
                      utilization.liftScore >= 80 ? "text-red-500" : "text-amber-500"
                    )} />
                    <div>
                      <p className={cn(
                        "text-xs font-medium",
                        utilization.liftScore >= 80 ? "text-red-700" : "text-amber-700"
                      )}>
                        {utilization.liftScore >= 80 ? "Strong Lift Candidate" : "Consider Relocation"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Lift Score: {utilization.liftScore}/100
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Move Machine */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm">Move Machine</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-3 pb-3">
                <Select value={selectedStore} onValueChange={setSelectedStore}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select store" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="w-full h-8 text-xs"
                  onClick={handleMoveToStore}
                  disabled={!selectedStore || selectedStore === machine.companyId}
                >
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                  Move to Store
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
