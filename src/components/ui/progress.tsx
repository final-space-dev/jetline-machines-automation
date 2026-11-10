import * as React from "react"

import { cn } from "@/lib/ui/utils"
import { COLORS } from "@/lib/ui/ui-tokens"

/**
 * Progress (design-spec-v1 §3.8): bar - caption row 12.5 with a 600 value,
 * 7px rounded track, tone fill (the meter look = tone "success" with a
 * count caption). Ring - conic fill around a white hole, center 19/700.
 */
type ProgressTone = "accent" | "success" | "danger" | "warning"

const toneFill: Record<ProgressTone, string> = {
  accent: COLORS.signal,
  success: COLORS.proven,
  danger: COLORS.deficit,
  warning: COLORS.pending,
}

function clampFraction(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0
  return Math.min(1, Math.max(0, value / max))
}

function Progress({
  label,
  value,
  max = 100,
  tone = "accent",
  valueLabel,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  label?: React.ReactNode
  value: number
  max?: number
  tone?: ProgressTone
  /** Right-side caption; defaults to the rounded percentage. */
  valueLabel?: React.ReactNode
}) {
  const fraction = clampFraction(value, max)
  return (
    <div data-slot="progress" className={cn("min-w-0", className)} {...props}>
      {(label != null || valueLabel !== null) && (
        <div className="mb-[7px] flex items-baseline justify-between gap-3 text-[12.5px] text-[#3A3F47]">
          <span className="min-w-0 truncate">{label}</span>
          <span className="shrink-0 font-semibold tabular-nums text-[#1B1D21]">
            {valueLabel ?? `${Math.round(fraction * 100)}%`}
          </span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        className="h-[7px] w-full overflow-hidden rounded-full bg-[#ECEDEE]"
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${fraction * 100}%`, background: toneFill[tone] }}
        />
      </div>
    </div>
  )
}

function ProgressRing({
  value,
  max = 100,
  label,
  centerLabel,
  size = 112,
  tone = "accent",
  className,
  ...props
}: React.ComponentProps<"div"> & {
  value: number
  max?: number
  /** Small label under the center figure, 10px header-gray. */
  label?: React.ReactNode
  /** Center figure; defaults to the rounded percentage. */
  centerLabel?: React.ReactNode
  size?: number
  tone?: ProgressTone
}) {
  const fraction = clampFraction(value, max)
  const hole = Math.round(size * (74 / 112))
  return (
    <div
      data-slot="progress-ring"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn("relative shrink-0 rounded-full", className)}
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${toneFill[tone]} 0turn ${fraction}turn, ${COLORS.track} ${fraction}turn 1turn)`,
      }}
      {...props}
    >
      <div
        className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-white text-center"
        style={{ width: hole, height: hole }}
      >
        <span className="text-[19px] font-bold tracking-[-0.02em] tabular-nums text-[#1B1D21]">
          {centerLabel ?? `${Math.round(fraction * 100)}%`}
        </span>
        {label != null && (
          <span className="mt-px text-[10px] text-[#8B9098]">{label}</span>
        )}
      </div>
    </div>
  )
}

export { Progress, ProgressRing }
export type { ProgressTone }
