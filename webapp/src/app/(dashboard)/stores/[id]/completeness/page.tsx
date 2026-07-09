"use client";

/**
 * Phase 19 — Store completeness breakdown.
 * Lists every equipment item's completeness score and exactly which fields are
 * missing. Each missing field links to /equipment/items/[id]?highlight=<field>
 * so the item page can scroll to and highlight that field. A "Fill in all
 * missing fields" CTA jumps to the first incomplete item.
 *
 * The [id] route segment carries the store NAME (the equipment CRM links to
 * /stores/<name>/... throughout).
 *
 * Reskinned onto the Jetline UI kit: .jl-breadcrumb, .jl-kpi score summary,
 * .jl-card sections, .jl-table-wrap/.jl-table, .jl-badge for scores, missing
 * fields as red .jl-badge pills linking to the item form with ?highlight=.
 */

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { CompletenessBadge } from "@/components/equipment/completeness-badge";
import { ArrowRight, ChevronRight } from "lucide-react";

// ─── API shape ────────────────────────────────────────────────────────────────

interface ItemRow {
  id: number;
  type: string;
  score: number;
  missing: string[];
}
interface PrinterRow {
  serial: string;
  score: number;
  missing: string[];
}
interface Completeness {
  store: string;
  equipmentScore: number;
  printerScore: number;
  overallScore: number;
  itemBreakdown: ItemRow[];
  printerBreakdown: PrinterRow[];
}

// Human labels for the raw field keys returned in `missing`.
const FIELD_LABELS: Record<string, string> = {
  make_model: "Make / Model",
  serial: "Serial number",
  condition: "Condition",
  status: "Status",
  purchase_date: "Purchase date",
  warranty_expiry: "Warranty expiry",
  last_serviced: "Last serviced",
  next_service_due: "Next service due",
  machine_type: "Type",
  age: "Age",
  replace_flag: "Replace flag",
};

function fieldLabel(f: string): string {
  return FIELD_LABELS[f] ?? f.replace(/_/g, " ");
}

/** Traffic-light colour token for a 0–100 score (matches CompletenessBadge). */
function scoreColor(score: number): string {
  if (score > 80) return "var(--green-700)";
  if (score >= 50) return "var(--amber-700)";
  return "var(--red-600)";
}

// ─── Missing-field pills ────────────────────────────────────────────────────────

/**
 * Render the "Missing Fields" cell: either a green Complete badge, or a row of
 * red .jl-badge pills, each linking to the item/printer form with ?highlight=.
 */
function MissingCell({ missing, hrefFor }: { missing: string[]; hrefFor: (field: string) => string }) {
  if (missing.length === 0) {
    return <span className="jl-badge jl-badge--green">Complete</span>;
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {missing.map((f) => (
        <Link
          key={f}
          href={hrefFor(f)}
          className="jl-badge jl-badge--red"
          title={`Fill in ${fieldLabel(f)}`}
        >
          {fieldLabel(f)} <ArrowRight />
        </Link>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StoreCompletenessPage() {
  const params = useParams();
  const storeName = decodeURIComponent(params.id as string);

  const [data, setData] = useState<Completeness | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/stores/${encodeURIComponent(storeName)}/completeness`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Completeness) => { if (alive) setData(d); })
      .catch(() => { if (alive) setUnavailable(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [storeName]);

  // First item that still has missing fields — target of the "Fill in" CTA.
  const firstIncomplete = useMemo(() => {
    if (!data) return null;
    return data.itemBreakdown.find((it) => it.missing.length > 0) ?? null;
  }, [data]);

  const incompleteCount = data?.itemBreakdown.filter((it) => it.missing.length > 0).length ?? 0;

  return (
    <AppShell>
      {/* Breadcrumb */}
      <nav className="jl-breadcrumb" style={{ marginBottom: "var(--s-5)" }}>
        <Link href={`/stores/${encodeURIComponent(storeName)}`}>{storeName}</Link>
        <span className="sep">/</span>
        <span className="current">Completeness</span>
      </nav>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--s-4)", flexWrap: "wrap", marginBottom: "var(--s-6)" }}>
        <h1 className="jl-h1">Data Completeness</h1>
        {data && <CompletenessBadge score={data.overallScore} size="md" />}
        {firstIncomplete && (
          <Link
            href={`/equipment/items/${firstIncomplete.id}?highlight=${encodeURIComponent(firstIncomplete.missing[0])}`}
            className="jl-btn jl-btn--primary jl-btn--sm"
            style={{ marginLeft: "auto" }}
          >
            Fill in all missing fields <ArrowRight />
          </Link>
        )}
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160 }}>
          <p className="jl-sm jl-faint">Loading completeness</p>
        </div>
      ) : unavailable || !data ? (
        <div className="jl-card" style={{ textAlign: "center", color: "var(--ink-400)" }}>
          Completeness scoring is not available for this store yet.
        </div>
      ) : (
        <>
          {/* Score summary — KPI row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--s-4)", marginBottom: "var(--s-6)" }}>
            <div className="jl-kpi">
              <p className="jl-kpi__value" style={{ color: scoreColor(data.overallScore) }}>{Math.round(data.overallScore)}%</p>
              <p className="jl-kpi__label">Overall</p>
            </div>
            <div className="jl-kpi">
              <p className="jl-kpi__value" style={{ color: "var(--ink-900)" }}>{Math.round(data.equipmentScore)}%</p>
              <p className="jl-kpi__label">Equipment</p>
            </div>
            <div className="jl-kpi">
              <p className="jl-kpi__value" style={{ color: "var(--ink-900)" }}>{Math.round(data.printerScore)}%</p>
              <p className="jl-kpi__label">Printers</p>
            </div>
            <div className="jl-kpi">
              <p className="jl-kpi__value" style={{ color: incompleteCount > 0 ? "var(--amber-700)" : "var(--green-700)" }}>{incompleteCount}</p>
              <p className="jl-kpi__label">Incomplete</p>
            </div>
          </div>

          {/* Equipment breakdown */}
          <div className="jl-card" style={{ marginBottom: "var(--s-5)" }}>
            <p className="jl-h3" style={{ marginBottom: "var(--s-4)" }}>Equipment Items</p>
            <div className="jl-table-wrap">
              <div style={{ overflowX: "auto" }}>
                <table className="jl-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th className="num" style={{ width: 90 }}>Score</th>
                      <th>Missing Fields</th>
                      <th style={{ width: 44 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {data.itemBreakdown.length === 0 ? (
                      <tr><td colSpan={4} style={{ padding: "var(--s-8)", textAlign: "center", color: "var(--ink-400)" }}>No equipment recorded for this store</td></tr>
                    ) : (
                      data.itemBreakdown.map((it) => (
                        <tr key={it.id}>
                          <td className="cell-strong">{it.type}</td>
                          <td className="num"><CompletenessBadge score={it.score} /></td>
                          <td>
                            <MissingCell
                              missing={it.missing}
                              hrefFor={(f) => `/equipment/items/${it.id}?highlight=${encodeURIComponent(f)}`}
                            />
                          </td>
                          <td className="num">
                            <Link href={`/equipment/items/${it.id}`} style={{ color: "var(--ink-300)", display: "inline-flex" }} title="Open item">
                              <ChevronRight />
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Printer breakdown */}
          <div className="jl-card">
            <p className="jl-h3" style={{ marginBottom: "var(--s-4)" }}>Printers</p>
            <div className="jl-table-wrap">
              <div style={{ overflowX: "auto" }}>
                <table className="jl-table">
                  <thead>
                    <tr>
                      <th>Serial</th>
                      <th className="num" style={{ width: 90 }}>Score</th>
                      <th>Missing Fields</th>
                      <th style={{ width: 44 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {data.printerBreakdown.length === 0 ? (
                      <tr><td colSpan={4} style={{ padding: "var(--s-8)", textAlign: "center", color: "var(--ink-400)" }}>No Xerox printers mapped to this store</td></tr>
                    ) : (
                      data.printerBreakdown.map((pr) => (
                        <tr key={pr.serial}>
                          <td><span className="jl-mono" style={{ fontSize: "var(--fs-xs)", color: "var(--ink-600)" }}>{pr.serial}</span></td>
                          <td className="num"><CompletenessBadge score={pr.score} /></td>
                          <td>
                            <MissingCell
                              missing={pr.missing}
                              hrefFor={(f) => `/equipment/printers/${encodeURIComponent(pr.serial)}?highlight=${encodeURIComponent(f)}`}
                            />
                          </td>
                          <td className="num">
                            <Link href={`/equipment/printers/${encodeURIComponent(pr.serial)}`} style={{ color: "var(--ink-300)", display: "inline-flex" }} title="Open printer">
                              <ChevronRight />
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
