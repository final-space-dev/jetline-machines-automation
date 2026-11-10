import * as React from "react"

import { cn } from "@/lib/ui/utils"
import { GRID } from "@/lib/ui/ui-tokens"
import { fmtR0 } from "@/lib/ui/format"

/**
 * GridShell - single-sourced styling for the ANALYTICAL grids whose engines
 * stay bespoke (reports, trial balances, workbench, entity aggregation,
 * consolidation worksheet). These helpers make their headers and cells read
 * from ui-tokens without rewriting tree/focus/drill logic.
 */

export function Th({ right, band, className, ...props }: React.ComponentProps<"th"> & { right?: boolean; band?: boolean }) {
  return (
    <th
      data-slot="grid-th"
      className={cn(GRID.th, right && GRID.thRight, band && GRID.bandHeader, className)}
      {...props}
    />
  )
}

export function LabelCell({ className, ...props }: React.ComponentProps<"td">) {
  return <td data-slot="grid-label" className={cn(GRID.td, className)} {...props} />
}

export function NumCell({
  value,
  band,
  className,
  children,
  ...props
}: React.ComponentProps<"td"> & { value?: number; band?: boolean }) {
  const v = value ?? 0
  return (
    <td
      data-slot="grid-num"
      className={cn(GRID.td, GRID.num, value !== undefined && v < 0 && GRID.neg, band && GRID.band, className)}
      {...props}
    >
      {/* Nil glyph per spec 1.2: U+2013 in #C3C7CD (en dash: R25 forbids em dashes) - never zero, never blank. */}
      {children ?? (value === undefined ? null : Math.abs(v) < 0.5 ? <span className="text-[#C3C7CD]">–</span> : fmtR0(v))}
    </td>
  )
}

export { GRID }
