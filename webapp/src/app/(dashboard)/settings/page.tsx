"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoading } from "@/components/ui/page-loading";
import { CheckCircle, XCircle, Loader2, Download } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import * as XLSX from "xlsx";
import { getFeatureToggles, setFeatureToggles, type FeatureToggles } from "@/lib/feature-toggles";

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
  const [toggles, setToggles] = useState<FeatureToggles>(getFeatureToggles);
  const [exportingReport, setExportingReport] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/companies");
      const data = await res.json();
      setCompanies(Array.isArray(data) ? data : []);
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

  const handleAnomalyReport = async () => {
    setExportingReport(true);
    try {
      const res = await fetch("/api/anomalies/report");
      const json = await res.json();
      if (!json.data || json.data.length === 0) {
        alert("No data returned");
        return;
      }
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(json.data);
      XLSX.utils.book_append_sheet(wb, ws, "Anomaly Report");
      XLSX.writeFile(wb, `anomaly-report-${new Date().toISOString().split("T")[0]}.xlsx`);
    } catch (err) {
      console.error("Anomaly report export error:", err);
      alert("Failed to export report");
    } finally {
      setExportingReport(false);
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
          description="Feature toggles and BMS connections"
        />

        {/* Feature Toggles */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-sm">Feature Toggles</CardTitle>
            <CardDescription className="text-xs">Show or hide pages in the sidebar. Settings and Xerox Reporting are always visible.</CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="space-y-1">
              {([
                { key: "machines"       as const, label: "Machines",        description: "Machine list and planning" },
                { key: "machinesAudit"  as const, label: "Machines Audit",  description: "Audit trail and data quality" },
                { key: "performance"    as const, label: "Performance",     description: "Volume and utilisation pivot" },
                { key: "reports"        as const, label: "Reports",         description: "3-month billing report" },
                { key: "existenceRecon" as const, label: "Existence Recon", description: "BMS vs Xerox machine matching" },
                { key: "syncStatus"     as const, label: "Sync Status",     description: "BMS sync log and status" },
                { key: "dashboard"      as const, label: "Dashboard",       description: "Overview stats and charts" },
                { key: "contracts"      as const, label: "Contracts",       description: "Contract management" },
                { key: "liftPlanner"    as const, label: "Lift Planner",    description: "Machine move planning tool" },
              ]).map((item) => (
                <div key={item.key} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <Label htmlFor={`toggle-${item.key}`} className="text-sm font-medium cursor-pointer">{item.label}</Label>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <Switch
                    id={`toggle-${item.key}`}
                    checked={toggles[item.key]}
                    onCheckedChange={(checked) => {
                      const next = { ...toggles, [item.key]: checked };
                      setToggles(next);
                      setFeatureToggles(next);
                    }}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Reports */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-sm">Reports</CardTitle>
            <CardDescription className="text-xs">Export data for manual review</CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Anomaly Report</p>
                <p className="text-xs text-muted-foreground">All readings from Jan 2024+, sorted by company/serial/date. Flags movements &gt;7,500 or &gt;25%.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs shrink-0"
                onClick={handleAnomalyReport}
                disabled={exportingReport}
              >
                {exportingReport ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Download className="h-3 w-3 mr-1" />
                )}
                {exportingReport ? "Exporting..." : "Download"}
              </Button>
            </div>
          </CardContent>
        </Card>

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
