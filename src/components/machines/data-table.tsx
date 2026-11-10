"use client";

import * as React from "react";
import { DataGrid, type DataGridColumn } from "@/components/ui/data-grid";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/ui/utils";
import { Empty } from "./empty";

export type Column<Row> = DataGridColumn<Row> & {
  /** Hidden while the table is narrower than this (phones first). */
  hideBelow?: "sm" | "md" | "lg" | "xl" | "2xl";
};

/** A column shows once the table itself is wide enough, not the screen. */
const HIDE: Record<NonNullable<Column<unknown>["hideBelow"]>, string> = {
  sm: "hidden @xl:table-cell",
  md: "hidden @min-[45rem]:table-cell",
  lg: "hidden @3xl:table-cell",
  xl: "hidden @6xl:table-cell",
  "2xl": "hidden @7xl:table-cell",
};

/**
 * One kind of thing in one table: the kit DataGrid with click-to-sort,
 * secondary columns hidden on a phone, pages when the list is long, and a
 * grid wider than its card scrolling inside itself.
 */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  onRowClick,
  rowClassName,
  empty = "Nothing here",
  pageSize,
  defaultSort,
  onSortChange,
  footer,
  wide = false,
  card = true,
}: {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row, index: number) => string | number;
  onRowClick?: (row: Row) => void;
  rowClassName?: (row: Row) => string | undefined;
  empty?: string;
  /** Rows per page; omitted, every row shows. */
  pageSize?: number;
  defaultSort?: { key: string; dir: 1 | -1 };
  /** The sort the person chose, so a page can export in the order shown. */
  onSortChange?: (key: string, dir: 1 | -1) => void;
  footer?: React.ReactNode;
  /** A report: every column always shows and the card scrolls sideways. */
  wide?: boolean;
  card?: boolean;
}) {
  const [page, setPage] = React.useState(1);
  const [sort, setSort] = React.useState(defaultSort);

  const sorted = React.useMemo(() => {
    const col = sort && columns.find((c) => c.key === sort.key);
    if (!sort || !col?.sortValue || !pageSize) return rows;
    const sv = col.sortValue;
    return [...rows].sort((a, b) => {
      const x = sv(a);
      const y = sv(b);
      const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "en-ZA", { numeric: true });
      return r * sort.dir;
    });
  }, [rows, columns, sort, pageSize]);

  const pageCount = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const current = Math.min(page, pageCount);
  const visible = pageSize ? sorted.slice((current - 1) * pageSize, current * pageSize) : sorted;

  const gridColumns: DataGridColumn<Row>[] = columns.map(({ hideBelow, ...c }) =>
    hideBelow && !wide
      ? { ...c, className: [c.className, HIDE[hideBelow]].filter(Boolean).join(" "), headClassName: [c.headClassName, HIDE[hideBelow]].filter(Boolean).join(" ") }
      : c,
  );

  const grid = (
    <DataGrid
      columns={gridColumns}
      rows={visible}
      rowKey={rowKey}
      onRowClick={onRowClick}
      rowClassName={rowClassName}
      chevron={!!onRowClick}
      card={card}
      defaultSort={defaultSort}
      onSortChange={(key, dir) => {
        setSort({ key, dir: dir === "desc" ? -1 : 1 });
        setPage(1);
        onSortChange?.(key, dir === "desc" ? -1 : 1);
      }}
      footer={footer}
      empty={<Empty title={empty} />}
    />
  );

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {/* The kit's card scrolls a wide grid and takes the keyboard. Without the card (a table inside a panel), this box does. */}
      {card ? (
        <div className={wide ? "min-w-0" : "@container min-w-0"}>{grid}</div>
      ) : (
        <div tabIndex={wide ? 0 : undefined} className={cn("min-w-0 overflow-x-auto outline-none", !wide && "@container")}>{grid}</div>
      )}
      {pageCount > 1 && <Pagination page={current} pageCount={pageCount} onPageChange={setPage} />}
    </div>
  );
}
