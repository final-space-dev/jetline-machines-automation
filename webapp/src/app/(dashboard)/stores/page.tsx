"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { exportToExcel, exportToCSV } from "@/lib/export";
import { Download, FileSpreadsheet } from "lucide-react";
import type { MachineWithRelations } from "@/types";

interface StoreStats {
  id: string;
  name: string;
  region: string | null;
  bmsSchema: string;
  isActive: boolean;
  machineCount: number;
  activeMachines: number;
  totalBalance: number;
}

export default function StoresPage() {
  const router = useRouter();
  const [stores, setStores] = useState<StoreStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [companiesRes, machinesRes] = await Promise.all([
        fetch("/api/companies"),
        fetch("/api/machines"),
      ]);

      const companiesData = await companiesRes.json();
      const machinesData = await machinesRes.json();
      const machines = machinesData.data || [];

      const storeStats: StoreStats[] = companiesData.map((company: any) => {
        const storeMachines = machines.filter(
          (m: MachineWithRelations) => m.companyId === company.id
        );
        const totalBalance = storeMachines.reduce(
          (sum: number, m: MachineWithRelations) => sum + (m.currentBalance || 0),
          0
        );
        const activeMachines = storeMachines.filter(
          (m: MachineWithRelations) => m.status === "ACTIVE"
        ).length;

        return {
          id: company.id,
          name: company.name,
          region: company.region,
          bmsSchema: company.bmsSchema,
          isActive: company.isActive,
          machineCount: storeMachines.length,
          activeMachines,
          totalBalance,
        };
      });

      setStores(storeStats);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStores = stores
    .filter((store) =>
      store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      store.bmsSchema.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "machines":
          return b.machineCount - a.machineCount;
        case "balance":
          return b.totalBalance - a.totalBalance;
        default:
          return 0;
      }
    });

  const totalMachines = stores.reduce((sum, s) => sum + s.machineCount, 0);
  const totalBalance = stores.reduce((sum, s) => sum + s.totalBalance, 0);

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

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Stores</h1>
            <p className="text-xs text-muted-foreground">
              {stores.length} stores · {totalMachines} machines · {formatNumber(totalBalance)} total balance
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() =>
                exportToExcel(
                  filteredStores,
                  [
                    { key: "name", header: "Store" },
                    { key: "region", header: "Region" },
                    { key: "machineCount", header: "Machines" },
                    { key: "activeMachines", header: "Active" },
                    { key: "totalBalance", header: "Balance" },
                    { key: "isActive", header: "Status" },
                  ],
                  "stores"
                )
              }
            >
              <FileSpreadsheet className="h-3 w-3 mr-1" />
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() =>
                exportToCSV(
                  filteredStores,
                  [
                    { key: "name", header: "Store" },
                    { key: "region", header: "Region" },
                    { key: "machineCount", header: "Machines" },
                    { key: "activeMachines", header: "Active" },
                    { key: "totalBalance", header: "Balance" },
                    { key: "isActive", header: "Status" },
                  ],
                  "stores"
                )
              }
            >
              <Download className="h-3 w-3 mr-1" />
              CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search stores..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="machines">Machines</SelectItem>
              <SelectItem value="balance">Balance</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stores Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 border-y">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium">Store</th>
                    <th className="px-3 py-1.5 text-left font-medium">Region</th>
                    <th className="px-3 py-1.5 text-right font-medium">Machines</th>
                    <th className="px-3 py-1.5 text-right font-medium">Active</th>
                    <th className="px-3 py-1.5 text-right font-medium">Balance</th>
                    <th className="px-3 py-1.5 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredStores.map((store) => (
                    <tr
                      key={store.id}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => router.push(`/stores/${store.id}`)}
                    >
                      <td className="px-3 py-1.5 font-medium">{store.name}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{store.region || "-"}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{store.machineCount}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{store.activeMachines}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{formatNumber(store.totalBalance)}</td>
                      <td className="px-3 py-1.5 text-center">
                        <Badge variant={store.isActive ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                          {store.isActive ? "Active" : "Inactive"}
                        </Badge>
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
