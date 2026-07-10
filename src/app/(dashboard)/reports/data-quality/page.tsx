"use client";

/**
 * Phase 19 — Data Quality admin report.
 * Table of all stores ranked worst-first: overall score, item count, items with
 * no serial, items with no service date, printers with no condition.
 * Export CSV hits GET /api/reports/data-quality?format=csv.
 * Admin only — store staff see a neutral shell (middleware also enforces this).
 *
 * Reskinned onto the Jetline UI kit: .jl-card, .jl-table-wrap/.jl-table,
 * .jl-badge for scores, .jl-search, .jl-btn for Export CSV. No white-on-white —
 * every surface lifts on canvas via shadow.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Download, Search, X } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { useRole } from "@/lib/use-role";

// ─── API shape ────────────────────────────────────────────────────────────────

interface DataQualityRow {
  store: string;
  group: string | null;
  overallScore: number;
  itemsCount: number;
  itemsNoSerial: number;
  itemsNoServiceDate: number;
  printersNoCondition: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Traffic-light badge variant for a 0–100 completeness score. */
function scoreBadgeClass(score: number): string {
  if (!Number.isFinite(score)) return "jl-badge";
  if (score > 80) return "jl-badge jl-badge--green";
  if (score >= 50) return "jl-badge jl-badge--amber";
  return "jl-badge jl-badge--red";
}

/** A gap-count cell — red and bold when there is a gap, faint when clean. */
function GapCell({ n }: { n: number }) {
  return (
    <td
      className="num"
      style={{ color: n > 0 ? "var(--red-600)" : "var(--ink-300)", fontWeight: n > 0 ? 800 : 500 }}
    >
      {n}
    </td>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DataQualityReportPage() {
  const router = useRouter();
  const { isAdmin, loading: roleLoading } = useRole();

  const [rows, setRows] = useState<DataQualityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [search, setSearch] = useState("");

  // Non-admins are redirected home (middleware enforces at the routing layer).
  useEffect(() => {
    if (!roleLoading && !isAdmin) router.replace("/equipment");
  }, [roleLoading, isAdmin, router]);

  useEffect(() => {
    if (roleLoading || !isAdmin) return;
    let alive = true;
    setLoading(true);
    fetch("/api/reports/data-quality")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: DataQualityRow[]) => { if (alive) setRows(Array.isArray(d) ? d : []); })
      .catch(() => { if (alive) setUnavailable(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [roleLoading, isAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    // API returns worst-first; preserve that order.
    if (!q) return rows;
    return rows.filter((r) =>
      r.store.toLowerCase().includes(q) || (r.group ?? "").toLowerCase().includes(q));
  }, [rows, search]);

  if (roleLoading || !isAdmin) {
    return (
      <AppShell>
        <div />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--s-4)", marginBottom: "var(--s-6)", flexWrap: "wrap" }}>
          <h1 className="jl-h1">Data Quality</h1>
          <a href="/api/reports/data-quality?format=csv" download className="jl-btn jl-btn--secondary jl-btn--sm">
            <Download /> Export CSV
          </a>
        </div>

        {/* Search */}
        <div className="jl-search" style={{ width: 340, maxWidth: "100%", marginBottom: "var(--s-5)" }}>
          <Search />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search stores"
            aria-label="Search stores"
            style={search ? { paddingRight: 40 } : undefined}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ink-400)", display: "grid", placeItems: "center" }}
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Store table */}
        <div className="jl-table-wrap">
          <div style={{ overflowX: "auto" }}>
            <table className="jl-table">
              <thead>
                <tr>
                  <th className="num" style={{ width: 44 }}>#</th>
                  <th>Store</th>
                  <th>Group</th>
                  <th className="num">Score</th>
                  <th className="num">Items</th>
                  <th className="num">No Serial</th>
                  <th className="num">No Service Date</th>
                  <th className="num">Printers No Condition</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ padding: "var(--s-8)", textAlign: "center", color: "var(--ink-400)" }}>Loading</td></tr>
                ) : unavailable ? (
                  <tr><td colSpan={8} style={{ padding: "var(--s-8)", textAlign: "center", color: "var(--ink-400)" }}>Data quality report is not available yet.</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: "var(--s-8)", textAlign: "center", color: "var(--ink-400)" }}>No stores match your search.</td></tr>
                ) : (
                  filtered.map((r, i) => (
                    <tr key={r.store}>
                      <td className="num" style={{ color: "var(--ink-300)", fontWeight: 700 }}>{i + 1}</td>
                      <td>
                        <Link href={`/stores/${encodeURIComponent(r.store)}/completeness`} style={{ color: "var(--red-600)", fontWeight: 700 }}>
                          {r.store}
                        </Link>
                      </td>
                      <td style={{ color: "var(--ink-500)" }}>{r.group ?? ""}</td>
                      <td className="num">
                        <span className={scoreBadgeClass(r.overallScore)}>
                          {Number.isFinite(r.overallScore) ? `${Math.round(r.overallScore)}%` : "Not scored"}
                        </span>
                      </td>
                      <td className="num cell-strong">{r.itemsCount}</td>
                      <GapCell n={r.itemsNoSerial} />
                      <GapCell n={r.itemsNoServiceDate} />
                      <GapCell n={r.printersNoCondition} />
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!loading && !unavailable && filtered.length > 0 && (
            <div style={{ padding: "var(--s-3) var(--s-5)", background: "var(--surface-sunken)", color: "var(--ink-400)", fontSize: "var(--fs-xs)", fontWeight: 600 }}>
              {filtered.length} store{filtered.length !== 1 ? "s" : ""} · sorted worst-first
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
