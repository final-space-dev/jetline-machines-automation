"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoading } from "@/components/ui/page-loading";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { formatNumber } from "@/lib/utils";

interface Company {
  id: string;
  name: string;
  bmsSchema: string;
  bmsHost: string | null;
  isActive: boolean;
  _count?: { machines: number };
}

interface ConnectionTest {
  companyId: string;
  status: "pending" | "testing" | "success" | "error";
  latency?: number;
  error?: string;
}

export default function SettingsPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionTests, setConnectionTests] = useState<Map<string, ConnectionTest>>(new Map());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/companies");
      const data = await res.json();
      setCompanies(data);
    } catch (error) {
      console.error("Failed to fetch companies:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async (company: Company) => {
    setConnectionTests((prev) => {
      const next = new Map(prev);
      next.set(company.id, { companyId: company.id, status: "testing" });
      return next;
    });

    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "test",
          bmsSchema: company.bmsSchema,
          bmsHost: company.bmsHost,
        }),
      });
      const data = await res.json();

      setConnectionTests((prev) => {
        const next = new Map(prev);
        next.set(company.id, {
          companyId: company.id,
          status: data.success ? "success" : "error",
          latency: data.latency,
          error: data.error,
        });
        return next;
      });
    } catch {
      setConnectionTests((prev) => {
        const next = new Map(prev);
        next.set(company.id, {
          companyId: company.id,
          status: "error",
          error: "Connection failed",
        });
        return next;
      });
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <PageLoading variant="table" />
      </AppShell>
    );
  }

  const activeCompanies = companies.filter((c) => c.isActive);

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          title="Settings"
          description="BMS connection configuration"
        />

        {/* Summary */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-sm">Company Connections</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Total Companies</p>
                <p className="font-mono font-bold">{companies.length}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Active</p>
                <p className="font-mono font-bold text-green-600">{activeCompanies.length}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Inactive</p>
                <p className="font-mono font-bold text-yellow-600">{companies.length - activeCompanies.length}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Machines</p>
                <p className="font-mono font-bold">
                  {formatNumber(companies.reduce((sum, c) => sum + (c._count?.machines || 0), 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Company List */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-sm">BMS Connections</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 border-y">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium">Company</th>
                    <th className="px-3 py-1.5 text-right font-medium">Machines</th>
                    <th className="px-3 py-1.5 text-center font-medium">Status</th>
                    <th className="px-3 py-1.5 text-center font-medium">Connection</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {companies.map((company) => {
                    const test = connectionTests.get(company.id);
                    return (
                      <tr key={company.id}>
                        <td className="px-3 py-1.5 font-medium">{company.name}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{company._count?.machines || 0}</td>
                        <td className="px-3 py-1.5 text-center">
                          <Badge
                            variant={company.isActive ? "default" : "secondary"}
                            className="text-[10px] px-1.5 py-0"
                          >
                            {company.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {test?.status === "testing" && (
                            <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                          )}
                          {test?.status === "success" && (
                            <div className="flex items-center justify-center gap-1">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span className="text-green-600">{test.latency}ms</span>
                            </div>
                          )}
                          {test?.status === "error" && (
                            <div className="flex items-center justify-center gap-1">
                              <XCircle className="h-4 w-4 text-red-600" />
                            </div>
                          )}
                          {!test && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => testConnection(company)}
                            >
                              Test
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
