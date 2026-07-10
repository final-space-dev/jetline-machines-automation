"use client";

import { useCallback, useEffect, useState } from "react";
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

export function ConnectionsPanel() {
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
    return (
      <div className="jl-card jl-card--pad-lg" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Loader2 size={18} className="animate-spin" style={{ color: "var(--ink-400)" }} />
        <span className="jl-sm jl-muted">Loading connections</span>
      </div>
    );
  }

  return (
    <div>
      <div className="jl-table-wrap" style={{ overflowX: "auto" }}>
        <table className="jl-table" style={{ minWidth: 720 }}>
          <thead>
            <tr>
              <th>Company</th>
              <th className="num">Machines</th>
              <th>Status</th>
              <th className="num">Connection</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => {
              const test = tests[company.id];
              return (
                <tr key={company.id}>
                  <td>
                    <div className="cell-strong">{company.name}</div>
                    <div className="jl-xs jl-faint">
                      {company.bmsSchema}{company.bmsHost ? ` · ${company.bmsHost}` : ""}
                    </div>
                  </td>
                  <td className="num cell-strong">
                    {company._count?.machines ?? 0}
                  </td>
                  <td>
                    {company.isActive ? (
                      <span className="jl-badge jl-badge--green">Active</span>
                    ) : (
                      <span className="jl-badge">Inactive</span>
                    )}
                  </td>
                  <td className="num">
                    {test?.status === "testing" && (
                      <span className="jl-badge">
                        <Loader2 size={12} className="animate-spin" /> Testing
                      </span>
                    )}
                    {test?.status === "success" && (
                      <span className="jl-badge jl-badge--green">
                        <CheckCircle2 size={12} /> {test.latency}ms
                      </span>
                    )}
                    {test?.status === "error" && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--s-2)" }}>
                        <span className="jl-badge jl-badge--red" title={test.error}>
                          <XCircle size={12} /> Failed
                        </span>
                        <button
                          type="button"
                          className="jl-btn jl-btn--secondary jl-btn--sm"
                          onClick={() => testConnection(company)}
                        >
                          Retry
                        </button>
                      </span>
                    )}
                    {!test && (
                      <button
                        type="button"
                        className="jl-btn jl-btn--secondary jl-btn--sm"
                        onClick={() => testConnection(company)}
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
                <td className="jl-sm jl-faint" colSpan={4}>
                  No connections configured.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
