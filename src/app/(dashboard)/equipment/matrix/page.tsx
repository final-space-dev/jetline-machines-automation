"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import Link from "next/link";

interface MatrixData {
  stores: string[];
  types: string[];
  matrix: Record<string, Record<string, number>>;
  storesWithData: string[];
}

function cellBg(count: number, hasData: boolean): string {
  if (!hasData) return "rgba(0,0,0,0)";
  if (count === 0) return "transparent";
  if (count === 1) return "rgba(20,164,77,0.14)";
  if (count === 2) return "rgba(20,164,77,0.26)";
  if (count >= 3) return "rgba(20,164,77,0.42)";
  return "transparent";
}

function cellColor(count: number, hasData: boolean): string {
  if (!hasData || count === 0) return "var(--jl-ink-200)";
  if (count === 1) return "var(--jl-green-700)";
  return "var(--jl-green-700)";
}

export default function EquipmentMatrixPage() {
  const [data, setData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredStore, setHoveredStore] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/equipment/matrix")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <AppShell>
        <div style={{ fontFamily: "var(--jl-font)", background: "var(--jl-canvas)", minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
          <p style={{ fontSize: 13, color: "var(--jl-ink-400)" }}>Loading matrix…</p>
        </div>
      </AppShell>
    );
  }

  if (!data) return <AppShell><div style={{ padding: 24, color: "var(--jl-red-500)", fontSize: 13 }}>Failed to load</div></AppShell>;

  const { stores, types, matrix, storesWithData } = data;
  const withDataSet = new Set(storesWithData);

  const grandTotal = stores.reduce((s, store) => s + types.reduce((t, type) => t + (matrix[store]?.[type] ?? 0), 0), 0);

  return (
    <AppShell>
      <div style={{ fontFamily: "var(--jl-font)", background: "var(--jl-canvas)", minHeight: "100%", padding: "32px 40px" }}>

        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 18, fontSize: 12 }}>
          <Link href="/equipment" style={{ color: "var(--jl-red-500)", fontWeight: 600, textDecoration: "none" }}>Equipment CRM</Link>
          <span style={{ color: "var(--jl-ink-300)" }}>/</span>
          <span style={{ color: "var(--jl-ink-700)", fontWeight: 700 }}>Matrix</span>
        </div>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--jl-ink-900)", lineHeight: 1.1 }}>Equipment Matrix</h1>
          <p style={{ fontSize: 13, color: "var(--jl-ink-400)", marginTop: 6, fontWeight: 500 }}>
            {stores.length} stores × {types.length} equipment types · {grandTotal} total items
          </p>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 14, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--jl-ink-400)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Quantity:</p>
          {[
            { label: "None", bg: "transparent", border: "1px solid var(--jl-ink-200)" },
            { label: "1", bg: "rgba(20,164,77,0.14)", border: "none" },
            { label: "2", bg: "rgba(20,164,77,0.26)", border: "none" },
            { label: "3+", bg: "rgba(20,164,77,0.42)", border: "none" },
          ].map(({ label, bg, border }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 20, height: 20, borderRadius: 4, background: bg, border: border ?? "none", flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--jl-ink-500)" }}>{label}</span>
            </div>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--jl-amber-500)" }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--jl-ink-400)" }}>Dashed row = no data recorded</span>
          </div>
        </div>

        {/* Matrix table */}
        <div style={{
          background: "var(--jl-surface)", borderRadius: "var(--jl-r-lg)",
          boxShadow: "var(--jl-sh-sm)", overflowX: "auto",
        }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{
                  textAlign: "left", padding: "12px 16px", fontSize: 11, fontWeight: 800,
                  letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--jl-ink-400)",
                  borderBottom: "1.5px solid var(--jl-ink-100)", background: "var(--jl-surface-sunken)",
                  position: "sticky", left: 0, zIndex: 2, minWidth: 140,
                }}>Store</th>
                {types.map((type) => (
                  <th key={type} style={{
                    padding: "6px 2px 0", textAlign: "center",
                    borderBottom: "1.5px solid var(--jl-ink-100)", background: "var(--jl-surface-sunken)",
                    height: 110, verticalAlign: "bottom",
                  }}>
                    <div style={{
                      writingMode: "vertical-lr", transform: "rotate(180deg)",
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
                      color: "var(--jl-ink-500)", paddingBottom: 8, whiteSpace: "nowrap",
                    }}>{type}</div>
                  </th>
                ))}
                <th style={{
                  padding: "12px 16px", fontSize: 11, fontWeight: 800, textAlign: "right",
                  letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--jl-ink-400)",
                  borderBottom: "1.5px solid var(--jl-ink-100)", background: "var(--jl-surface-sunken)",
                }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((store) => {
                const hasData = withDataSet.has(store);
                const storeTotal = types.reduce((sum, t) => sum + (matrix[store]?.[t] ?? 0), 0);
                const isHovered = hoveredStore === store;
                return (
                  <tr key={store}
                    onMouseEnter={() => setHoveredStore(store)}
                    onMouseLeave={() => setHoveredStore(null)}
                    style={{
                      borderBottom: "1px solid var(--jl-ink-50)",
                      background: isHovered ? "var(--jl-ink-50)" : "transparent",
                      opacity: !hasData ? 0.55 : 1,
                      transition: "background var(--jl-t-fast), opacity var(--jl-t-fast)",
                    }}
                  >
                    <td style={{
                      padding: "9px 16px", position: "sticky", left: 0, zIndex: 1,
                      background: isHovered ? "var(--jl-ink-50)" : "var(--jl-surface)",
                      borderRight: "1.5px solid var(--jl-ink-100)",
                      transition: "background var(--jl-t-fast)",
                    }}>
                      <Link href={`/equipment/stores/${encodeURIComponent(store)}`} style={{ textDecoration: "none" }}>
                        <span style={{
                          fontSize: 12, fontWeight: hasData ? 700 : 500,
                          color: hasData ? "var(--jl-ink-900)" : "var(--jl-ink-400)",
                          fontStyle: hasData ? "normal" : "italic",
                          cursor: "pointer",
                        }}>{store}</span>
                      </Link>
                      {!hasData && (
                        <span style={{
                          marginLeft: 8, fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                          letterSpacing: "0.06em", color: "var(--jl-amber-700)",
                          background: "var(--jl-amber-tint)", padding: "1px 5px",
                          borderRadius: "var(--jl-r-pill)",
                        }}>no data</span>
                      )}
                    </td>
                    {types.map((type) => {
                      const count = matrix[store]?.[type] ?? 0;
                      return (
                        <td key={type} style={{
                          textAlign: "center", padding: "9px 3px",
                          background: cellBg(count, hasData),
                          color: cellColor(count, hasData),
                          fontSize: 12, fontWeight: count > 0 ? 700 : 400,
                          fontVariantNumeric: "tabular-nums",
                          transition: "background var(--jl-t-fast)",
                        }}>
                          {count > 0 ? count : <span style={{ opacity: 0.25 }}>·</span>}
                        </td>
                      );
                    })}
                    <td style={{
                      padding: "9px 16px", textAlign: "right",
                      fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums",
                      color: storeTotal > 0 ? "var(--jl-ink-900)" : "var(--jl-ink-300)",
                      borderLeft: "1.5px solid var(--jl-ink-100)",
                    }}>{storeTotal > 0 ? storeTotal : "—"}</td>
                  </tr>
                );
              })}
              {/* Totals row */}
              <tr style={{ borderTop: "2px solid var(--jl-ink-200)", background: "var(--jl-surface-sunken)" }}>
                <td style={{
                  padding: "10px 16px", position: "sticky", left: 0, zIndex: 1,
                  background: "var(--jl-surface-sunken)", borderRight: "1.5px solid var(--jl-ink-100)",
                  fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase",
                  color: "var(--jl-ink-500)",
                }}>Fleet Total</td>
                {types.map((type) => {
                  const total = stores.reduce((sum, s) => sum + (matrix[s]?.[type] ?? 0), 0);
                  return (
                    <td key={type} style={{
                      textAlign: "center", padding: "10px 3px",
                      fontSize: 12, fontWeight: 700, color: total > 0 ? "var(--jl-ink-800)" : "var(--jl-ink-300)",
                      fontVariantNumeric: "tabular-nums",
                    }}>{total > 0 ? total : "—"}</td>
                  );
                })}
                <td style={{
                  padding: "10px 16px", textAlign: "right",
                  fontSize: 14, fontWeight: 800, color: "var(--jl-ink-900)",
                  fontVariantNumeric: "tabular-nums",
                  borderLeft: "1.5px solid var(--jl-ink-100)",
                }}>{grandTotal}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 11, color: "var(--jl-ink-300)", marginTop: 12, fontWeight: 500 }}>
          Click any store name to open its full equipment record.
        </p>
      </div>
    </AppShell>
  );
}
