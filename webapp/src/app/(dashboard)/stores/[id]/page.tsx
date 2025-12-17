"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { formatNumber, formatDate, cn } from "@/lib/utils";
import type { MachineWithRelations } from "@/types";

interface StoreDetail {
  id: string;
  name: string;
  region: string | null;
  bmsSchema: string;
  bmsHost: string | null;
  isActive: boolean;
  createdAt: string;
  machines: MachineWithRelations[];
}

export default function StoreDetailPage() {
  const router = useRouter();
  const params = useParams();
  const storeId = params.id as string;

  const [store, setStore] = useState<StoreDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStoreData();
  }, [storeId]);

  const fetchStoreData = async () => {
    try {
      const [companyRes, machinesRes] = await Promise.all([
        fetch(`/api/companies/${storeId}`),
        fetch(`/api/machines?companyId=${storeId}`),
      ]);

      const companyData = await companyRes.json();
      const machinesData = await machinesRes.json();

      setStore({
        id: companyData.id,
        name: companyData.name,
        region: companyData.region,
        bmsSchema: companyData.bmsSchema,
        bmsHost: companyData.bmsHost,
        isActive: companyData.isActive,
        createdAt: companyData.createdAt,
        machines: machinesData.data || [],
      });
    } catch (error) {
      console.error("Failed to fetch store data:", error);
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

  if (!store) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-96">
          <p className="text-muted-foreground">Store not found</p>
          <Button onClick={() => router.push("/stores")} className="mt-4">
            Back to Stores
          </Button>
        </div>
      </AppShell>
    );
  }

  const statusVariant = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      ACTIVE: "default",
      INACTIVE: "secondary",
      MAINTENANCE: "outline",
      DECOMMISSIONED: "destructive",
    };
    return variants[status] || "outline";
  };

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
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold">{store.name}</h1>
              <Badge variant={store.isActive ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                {store.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {store.machines.length} machines · {activeMachines} active · {formatNumber(totalBalance)} total balance
            </p>
          </div>
        </div>

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
                        <th className="px-3 py-1.5 text-right font-medium">Balance</th>
                        <th className="px-3 py-1.5 text-left font-medium">Last Reading</th>
                        <th className="px-3 py-1.5 text-center font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {store.machines.map((machine) => (
                        <tr
                          key={machine.id}
                          className="hover:bg-muted/50 cursor-pointer"
                          onClick={() => router.push(`/machines/${machine.id}`)}
                        >
                          <td className="px-3 py-1.5 font-mono">{machine.serialNumber}</td>
                          <td className="px-3 py-1.5">{machine.modelName || "-"}</td>
                          <td className="px-3 py-1.5 text-right font-mono">{formatNumber(machine.currentBalance)}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{formatDate(machine.lastReadingDate)}</td>
                          <td className="px-3 py-1.5 text-center">
                            <Badge variant={statusVariant(machine.status)} className="text-[10px] px-1.5 py-0">
                              {machine.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                      {store.machines.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
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
