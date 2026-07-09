"use client";

import { useMemo, useState } from "react";

export interface AttentionColumn<T> {
  key: string;
  label: string;
  align?: "left" | "right";
  sortable?: boolean;
  /** Value used for sorting. Falls back to the raw value at row[key]. */
  sortValue?: (row: T) => string | number;
  render?: (row: T) => React.ReactNode;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface AttentionTab<T = any> {
  key: string;
  label: string;
  rows: T[];
  columns: AttentionColumn<T>[];
  rowKey: (row: T) => string;
}

interface AttentionListProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tabs: AttentionTab<any>[];
  activeKey: string;
  onTabChange: (key: string) => void;
}

type SortDir = "asc" | "desc";

export function AttentionList({ tabs, activeKey, onTabChange }: AttentionListProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const active = tabs.find((t) => t.key === activeKey) ?? tabs[0];

  const sortedRows = useMemo(() => {
    if (!active) return [];
    if (!sortKey) return active.rows;
    const col = active.columns.find((c) => c.key === sortKey);
    if (!col) return active.rows;
    const getVal = (row: Record<string, unknown>): string | number => {
      if (col.sortValue) return col.sortValue(row);
      const v = row[col.key];
      if (v == null) return "";
      return typeof v === "number" ? v : String(v);
    };
    const copy = [...active.rows];
    copy.sort((a, b) => {
      const av = getVal(a);
      const bv = getVal(b);
      let cmp: number;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [active, sortKey, sortDir]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  if (!active) return null;

  return (
    <div>
      {/* Tabs — kit pill tabs with a count badge per tab */}
      <div className="jl-tabs" style={{ marginBottom: "var(--s-5)", flexWrap: "wrap" }}>
        {tabs.map((t) => {
          const isActive = t.key === active.key;
          return (
            <button
              key={t.key}
              aria-selected={isActive}
              onClick={() => onTabChange(t.key)}
              style={{ display: "inline-flex", alignItems: "center", gap: "var(--s-2)" }}
            >
              {t.label}
              <span className={`jl-badge${isActive ? " jl-badge--red" : ""}`}>{t.rows.length}</span>
            </button>
          );
        })}
      </div>

      {/* Table — kit banded table inside an elevated wrap */}
      {sortedRows.length === 0 ? (
        <div className="jl-card jl-card--pad-lg" style={{ textAlign: "center", color: "var(--ink-400)" }}>
          <p className="jl-sm">Nothing needs attention here right now</p>
        </div>
      ) : (
        <div className="jl-table-wrap" style={{ overflowX: "auto" }}>
          <table className="jl-table">
            <thead>
              <tr>
                {active.columns.map((c) => {
                  const isSorted = sortKey === c.key;
                  const canSort = c.sortable !== false;
                  return (
                    <th
                      key={c.key}
                      className={c.align === "right" ? "num" : undefined}
                      onClick={canSort ? () => toggleSort(c.key) : undefined}
                      style={{
                        cursor: canSort ? "pointer" : "default",
                        userSelect: "none",
                        color: isSorted ? "var(--ink-700)" : undefined,
                      }}
                    >
                      {c.label}
                      {canSort && (
                        <span style={{ marginLeft: 5, fontSize: 10, opacity: isSorted ? 1 : 0.35 }}>
                          {isSorted ? (sortDir === "asc" ? "▲" : "▼") : "▲"}
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={active.rowKey(row)}>
                  {active.columns.map((c) => (
                    <td key={c.key} className={c.align === "right" ? "num" : undefined}>
                      {c.render ? c.render(row) : String(row[c.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
