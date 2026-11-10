import * as React from "react"

import { cn } from "@/lib/ui/utils"

/**
 * Delta chip (design-spec-v1 §3.4 trend pills): a compact +x.x% / -x.x%
 * movement marker. Up rides the Proven green wash, down the Deficit red wash,
 * no-comparison renders neutral. `value` is a FRACTIONAL change
 * (0.142 -> "▲ 14.2%"). `invert` flips the tone for metrics where rising is
 * bad (costs, debtor days) - the arrow still points the true direction.
 */
const chipBase =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-[7px] px-2 py-1 text-[11.5px] leading-none font-semibold tabular-nums"

function Delta({
  value,
  flatLabel = "n/a",
  invert = false,
  className,
}: {
  value: number | null | undefined
  /** Shown when no meaningful prior base exists. */
  flatLabel?: string
  /** Rising is bad (costs, days): flips green/red, keeps the arrow honest. */
  invert?: boolean
  className?: string
}) {
  if (value === null || value === undefined || !isFinite(value)) {
    return (
      <span data-slot="delta" className={cn(chipBase, "bg-[#F4F4F5] text-[#5A6068]", className)}>
        {flatLabel}
      </span>
    )
  }
  const pct = Math.abs(value) * 100
  if (Math.round(pct * 10) === 0) {
    return (
      <span data-slot="delta" className={cn(chipBase, "bg-[#F4F4F5] text-[#5A6068]", className)}>
        0.0%
      </span>
    )
  }
  const up = value > 0
  const good = invert ? !up : up
  const text = pct >= 1000 ? `${Math.round(pct).toLocaleString("en-ZA")}%` : `${pct.toFixed(1)}%`
  return (
    <span
      data-slot="delta"
      className={cn(
        chipBase,
        good ? "bg-[#E9F4EF] text-[#17795B]" : "bg-[#FBEDEB] text-[#C0453C]",
        className
      )}
    >
      <span aria-hidden className="text-[8px] leading-none">
        {up ? "▲" : "▼"}
      </span>
      {text}
    </span>
  )
}

/** YoY fractional change with the division-by-zero guard: null when the prior
 * base is missing or rounds to nothing - the chip then shows its flat label. */
function deltaPct(cur: number, prior: number | null | undefined): number | null {
  if (prior === null || prior === undefined || Math.abs(prior) < 0.5) return null
  return (cur - prior) / Math.abs(prior)
}

export { Delta, deltaPct }
