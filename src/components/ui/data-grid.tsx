"use client"

import * as React from "react"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/ui/utils"
import { GRID } from "@/lib/ui/ui-tokens"
import { fmtR0 } from "@/lib/ui/format"
import { GlideRows } from "@/components/ui/glide-rows"

/**
 * DataGrid - the ONE record table (uniformity by construction, R36).
 * Every list screen (entities, journals, recon board, documents, alignment,
 * intercompany, consolidation runs, settings) renders through this: one
 * header style, one density, one hover, one sort affordance, keyboard rows.
 *
 * Columns define everything; pages never hand-roll <table> again.
 */

export interface DataGridColumn<Row> {
  key: string
  label: React.ReactNode
  align?: "left" | "right"
  width?: string
  /** Enables click-to-sort; return the comparable value. */
  sortValue?: (row: Row) => string | number
  cell: (row: Row, index: number) => React.ReactNode
  /** Extra classes on every cell of this column. */
  className?: string
  headClassName?: string
}

export function DataGrid<Row>({
  columns,
  rows,
  rowKey,
  onRowClick,
  rowClassName,
  card = true,
  stickyHeader = true,
  chevron = false,
  empty,
  defaultSort,
  onSortChange,
  footer,
  className,
}: {
  columns: DataGridColumn<Row>[]
  rows: Row[]
  rowKey: (row: Row, index: number) => string | number
  onRowClick?: (row: Row) => void
  rowClassName?: (row: Row) => string | undefined
  /** Card wrapper (rounded border). Working screens can set false for full-bleed. */
  card?: boolean
  stickyHeader?: boolean
  /** Trailing chevron on clickable rows. */
  chevron?: boolean
  /** Rendered when rows is empty (post-filter). */
  empty?: React.ReactNode
  defaultSort?: { key: string; dir: 1 | -1 }
  /** Fires whenever the user sorts (R6: lets the page mirror sort into exports).
   * When a third click clears the sort, fires with defaultSort if one exists. */
  onSortChange?: (key: string, dir: "asc" | "desc") => void
  /** Optional footer row(s): full <tr> elements. */
  footer?: React.ReactNode
  className?: string
}) {
  const [sort, setSort] = React.useState<{ key: string; dir: 1 | -1 } | null>(defaultSort ?? null)

  const sorted = React.useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return rows
    const sv = col.sortValue
    return [...rows].sort((a, b) => {
      const x = sv(a)
      const y = sv(b)
      const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))
      return r * sort.dir
    })
  }, [rows, sort, columns])

  function toggleSort(col: DataGridColumn<Row>) {
    if (!col.sortValue) return
    // Spec 3.6: first click sorts DESCENDING, second ascending, third clears.
    const next: { key: string; dir: 1 | -1 } | null =
      sort?.key !== col.key ? { key: col.key, dir: -1 } : sort.dir === -1 ? { key: col.key, dir: 1 } : null
    setSort(next)
    const effective = next ?? defaultSort ?? null
    if (effective) onSortChange?.(effective.key, effective.dir === -1 ? "desc" : "asc")
  }

  const clickable = !!onRowClick
  const table = (
    <table className={cn("w-full", !card && "text-xs", className)}>
      <thead className={cn(stickyHeader && GRID.thead, !stickyHeader && "bg-[#FAFAFB]")}>
        <tr className="border-b border-[#E8E9EB]">
          {columns.map((c) => (
            <th
              key={c.key}
              onClick={() => toggleSort(c)}
              className={cn(
                GRID.th,
                c.align === "right" && GRID.thRight,
                c.sortValue && "cursor-pointer select-none hover:text-[#1B1D21]",
                c.width,
                c.headClassName
              )}
            >
              {c.label}
              {sort?.key === c.key && (
                <span className="ml-1 text-[9px] leading-none text-[#9AA0A9]">
                  {sort.dir === -1 ? "\u25BC" : "\u25B2"}
                </span>
              )}
            </th>
          ))}
          {chevron && <th className={cn(GRID.th, "w-8")} />}
        </tr>
      </thead>
      <tbody className="divide-y divide-[#F4F4F5]">
        {sorted.length === 0 && empty !== undefined ? (
          <tr>
            <td colSpan={columns.length + (chevron ? 1 : 0)} className="px-4 py-10 text-center text-[12.5px] text-[#8B9098]">
              {empty}
            </td>
          </tr>
        ) : (
          sorted.map((row, i) => (
            <tr
              key={rowKey(row, i)}
              data-glide
              tabIndex={clickable ? 0 : undefined}
              onClick={clickable ? () => onRowClick(row) : undefined}
              onKeyDown={clickable ? (e) => { if (e.key === "Enter") onRowClick(row) } : undefined}
              className={cn(clickable && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2A5BD7]/30", rowClassName?.(row))}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(GRID.td, c.align === "right" && GRID.num, c.className)}
                >
                  {c.cell(row, i)}
                </td>
              ))}
              {chevron && (
                <td className={cn(GRID.td, "w-8 text-[#B4B8BF]")}>
                  <ChevronRight className="size-3.5" />
                </td>
              )}
            </tr>
          ))
        )}
      </tbody>
      {footer && <tfoot>{footer}</tfoot>}
    </table>
  )

  const body = <GlideRows>{table}</GlideRows>
  return card ? <div className={GRID.card}>{body}</div> : body
}

/** Right-aligned whole-rand amount with red brackets (the one money cell).
 * Display-zero renders the spec's nil glyph (U+2014 in #C3C7CD) - never a
 * zero, never blank (design-spec-v1 1.2). */
export function Amount({ value, className }: { value: number; className?: string }) {
  const nil = Math.abs(value) < 0.5
  return (
    <span className={cn("tabular-nums", nil ? "text-[#C3C7CD]" : value < 0 && GRID.neg, className)}>
      {nil ? "–" : fmtR0(value)}
    </span>
  )
}

/** Stacked identity cell: primary name with secondary line beneath (one recipe). */
export function Identity({ primary, secondary }: { primary: React.ReactNode; secondary?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="truncate font-medium text-[#1B1D21]">{primary}</div>
      {secondary && <div className="truncate text-[11px] text-[#9AA0A9]">{secondary}</div>}
    </div>
  )
}
