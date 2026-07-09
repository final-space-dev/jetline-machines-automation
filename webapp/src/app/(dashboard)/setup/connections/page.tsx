"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoading } from "@/components/ui/page-loading";
import { jlCard, jlTh, jlTd, jlBtnGhost, jlPill } from "@/lib/jl";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface Company {
  id: string;
  name: string;
  bmsSchema: string;
  bmsHost: string | null;
  isActive: boolean;
  _count?: { machines: number };
}

interface ConnectionTest {
  status: "testing" | "success" | "error";
  latency?: number;
  error?: string;
}

export default function ConnectionsPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState<Record<string, ConnectionTest>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/companies");
      const data = await res.json();
      setCompanies(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function testConnection(company: Company) {
    setTests((prev) => ({ ...prev, [company.id]: { status: "testing" } }));
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
      setTests((prev) => ({
        ...prev,
        [company.id]: {
          status: data.success ? "success" : "error",
          latency: data.latency,
          error: data.error,
        },
      }));
    } catch {
      setTests((prev) => ({
        ...prev,
        [company.id]: { status: "error", error: "Connection failed" },
      }));
    }
  }

  if (loading) {
    return <AppShell><PageLoading variant="table" /></AppShell>;
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader title="Connections" />

        <div style={jlCard}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={jlTh}>Company</th>
                <th style={{ ...jlTh, textAlign: "right", width: 120 }}>Machines</th>
                <th style={{ ...jlTh, width: 120 }}>Status</th>
                <th style={{ ...jlTh, textAlign: "right", width: 200 }}>Connection</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => {
                const test = tests[company.id];
                return (
                  <tr key={company.id}>
                    <td style={{ ...jlTd, fontWeight: 600 }}>
                      <div>{company.name}</div>
                      <div style={{ fontSize: 11, color: "var(--jl-ink-400)" }}>
                        {company.bmsSchema}{company.bmsHost ? ` · ${company.bmsHost}` : ""}
                      </div>
                    </td>
                    <td style={{ ...jlTd, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {company._count?.machines ?? 0}
                    </td>
                    <td style={jlTd}>
                      {company.isActive ? (
                        <span style={jlPill("var(--jl-green-700)", "var(--jl-green-tint)")}>Active</span>
                      ) : (
                        <span style={jlPill("var(--jl-ink-500)", "var(--jl-ink-50)")}>Inactive</span>
                      )}
                    </td>
                    <td style={{ ...jlTd, textAlign: "right" }}>
                      {test?.status === "testing" && (
                        <Loader2 size={16} className="animate-spin" style={{ color: "var(--jl-ink-400)", display: "inline" }} />
                      )}
                      {test?.status === "success" && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--jl-green-700)", fontWeight: 600, fontSize: 13 }}>
                          <CheckCircle2 size={16} /> {test.latency}ms
                        </span>
                      )}
                      {test?.status === "error" && (
                        <span
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--jl-red-700)", fontWeight: 600, fontSize: 13 }}
                          title={test.error}
                        >
                          <XCircle size={16} /> Failed
                          <button
                            type="button"
                            onClick={() => testConnection(company)}
                            style={{ ...jlBtnGhost, height: 28, padding: "0 10px", marginLeft: 6 }}
                          >
                            Retry
                          </button>
                        </span>
                      )}
                      {!test && (
                        <button
                          type="button"
                          onClick={() => testConnection(company)}
                          style={{ ...jlBtnGhost, height: 30, padding: "0 14px" }}
                        >
                          Test
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {companies.length === 0 && (
                <tr>
                  <td style={{ ...jlTd, color: "var(--jl-ink-400)" }} colSpan={4}>
                    No connections configured.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
