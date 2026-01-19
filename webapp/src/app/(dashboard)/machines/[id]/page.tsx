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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { formatNumber, formatDate, cn, getStatusVariant } from "@/lib/utils";
import type { MachineWithRelations } from "@/types";

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
  const [monthlyReadings, setMonthlyReadings] = useState<MonthlyReading[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [period, setPeriod] = useState<string>("12");

  useEffect(() => {
    fetchData();
  }, [machineId, period]);

  const fetchData = async () => {
    try {
      const [machineRes, readingsRes, companiesRes] = await Promise.all([
        fetch(`/api/machines/${machineId}`),
        fetch(`/api/machines/${machineId}/readings?months=${period}`),
        fetch("/api/companies"),
      ]);

      const machineData = await machineRes.json();
      const readingsData = await readingsRes.json();
      const companiesData = await companiesRes.json();

      setMachine(machineData);
      setMonthlyReadings(readingsData.monthly || []);
      setStores(companiesData.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
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
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold">
                  {machine.modelName || "Unknown Model"} - {machine.company?.name}
                </h1>
                <Badge variant={getStatusVariant(machine.status as "ACTIVE" | "INACTIVE" | "MAINTENANCE" | "DECOMMISSIONED")} className="text-[10px] px-1.5 py-0">{machine.status}</Badge>
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
              </CardContent>
            </Card>

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
