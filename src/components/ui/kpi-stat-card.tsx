import * as React from "react"

import { cn } from "@/lib/ui/utils"
import { SURFACE } from "@/lib/ui/ui-tokens"

/**
 * KPI / stat card (design-spec-v1 §3.7): r14 hairline card, label 12/500
 * header-gray with an optional delta pill, value 26/700, optional explicit
 * prior line under the value ("was R 22.9m") so every delta names its base.
 * No sparklines: trends are shown as explicit numbers, never unlabeled squiggles.
 */
/** A string prior "FY2025 through Sep: R 217m (-9.9%) · note" never splits
 * its figure across lines: the figure after ": " (up to a " · " note) stays
 * whole, the label and any note wrap like prose. A string without ": " is a
 * note and wraps as it is. */
function priorParts(prior: React.ReactNode): React.ReactNode {
  if (typeof prior !== "string") return prior
  const at = prior.indexOf(": ")
  if (at < 0) return prior
  const rest = prior.slice(at + 2)
  const dot = rest.indexOf(" · ")
  const figure = dot < 0 ? rest : rest.slice(0, dot)
  return (
    <>
      {prior.slice(0, at + 2)}
      <span className="whitespace-nowrap">{figure}</span>
      {dot < 0 ? null : rest.slice(dot)}
    </>
  )
}

function KpiStatCard({
  label,
  value,
  delta,
  tone = "default",
  prior,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  label: React.ReactNode
  value: React.ReactNode
  /** Trend/delta pill rendered top-right (compose a Badge or trend pill). */
  delta?: React.ReactNode
  tone?: "default" | "danger"
  /** Explicit prior/basis line rendered under the value, e.g. "was R 22.9m". */
  prior?: React.ReactNode
}) {
  return (
    <div
      data-slot="kpi-stat-card"
      className={cn(SURFACE.card, "px-[18px] py-4", className)}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs font-medium text-[#8B9098]">
          {label}
        </span>
        {delta}
      </div>
      <div
        className={cn(
          "mt-2.5 text-[26px] leading-[1.05] font-bold tracking-[-0.025em] tabular-nums",
          tone === "danger" ? "text-[#C0453C]" : "text-[#1B1D21]"
        )}
      >
        {value}
      </div>
      {prior != null && prior !== "" && (
        <div
          data-slot="kpi-prior"
          className="mt-1.5 text-[11px] leading-4 text-[#8B9098] tabular-nums"
        >
          {priorParts(prior)}
        </div>
      )}
    </div>
  )
}

export { KpiStatCard }
