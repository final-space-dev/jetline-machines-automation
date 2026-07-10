"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

export interface JlColumn<T> {
  key: string;
  label: ReactNode;
  align?: "left" | "right";
  sortable?: boolean;
  /** Custom cell renderer. Falls back to `row[key]`. */
  render?: (row: T) => ReactNode;
}

export interface JlTableProps<T> {
  columns: JlColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  actions?: (row: T) => ReactNode;
  empty?: ReactNode;
  loading?: boolean;
}

type SortState = { key: string; dir: "asc" | "desc" } | null;

function defaultCell<T>(row: T, key: string): ReactNode {
  const v = (row as Record<string, unknown>)[key];
  if (v === null || v === undefined) return "";
  return v as ReactNode;
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

/** Real data table: div.jl-table-wrap > table.jl-table, client-side sort. */
export function JlTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  actions,
  empty,
  loading,
}: JlTableProps<T>) {
  const [sort, setSort] = useState<SortState>(null);
  const colSpan = columns.length + (actions ? 1 : 0);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const key = col.key;
    const get = (row: T) => (row as Record<string, unknown>)[key];
    const next = [...rows].sort((x, y) => compare(get(x), get(y)));
    return sort.dir === "asc" ? next : next.reverse();
  }, [rows, sort, columns]);

  function toggleSort(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  return (
    <div className="jl-table-wrap">
      <table className="jl-table">
        <thead>
          <tr>
            {columns.map((col) => {
              const isNum = col.align === "right";
              const active = sort?.key === col.key;
              return (
                <th key={col.key} className={isNum ? "num" : undefined}>
                  {col.sortable ? (
                    <button
                      type="button"
                      className="jl-th-sort"
                      onClick={() => toggleSort(col.key)}
                      aria-label={`Sort by ${
                        typeof col.label === "string" ? col.label : col.key
                      }`}
                    >
                      {col.label}
                      {!active ? (
                        <ChevronsUpDown className="jl-th-sort__icon" />
                      ) : sort?.dir === "asc" ? (
                        <ArrowUp className="jl-th-sort__icon" />
                      ) : (
                        <ArrowDown className="jl-th-sort__icon" />
                      )}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              );
            })}
            {actions ? <th className="num">{""}</th> : null}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={`sk-${i}`}>
                {columns.map((col) => (
                  <td key={col.key} className={col.align === "right" ? "num" : undefined}>
                    <span className="jl-skeleton jl-table__skel" />
                  </td>
                ))}
                {actions ? (
                  <td className="num">
                    <span className="jl-skeleton jl-table__skel" />
                  </td>
                ) : null}
              </tr>
            ))
          ) : sorted.length === 0 ? (
            <tr>
              <td colSpan={colSpan}>
                <div className="jl-table__empty">
                  {empty ?? "No records to display."}
                </div>
              </td>
            </tr>
          ) : (
            sorted.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? "jl-table__row--click" : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={col.align === "right" ? "num" : undefined}
                  >
                    {col.render ? col.render(row) : defaultCell(row, col.key)}
                  </td>
                ))}
                {actions ? <td className="num">{actions(row)}</td> : null}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default JlTable;
