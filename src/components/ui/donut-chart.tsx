"use client"

import * as React from "react"

import { cn } from "@/lib/ui/utils"
import { fmtR0 } from "@/lib/ui/format"
import { CHART_COLORS } from "@/components/ui/line-chart"

/**
 * DonutChart - hand-built token-driven SVG ring (design-spec-v1 §3.8 ring
 * chart geometry: 112px ring, 74px hole). Segments sweep in on mount via a
 * stroke-dasharray transition; center carries a headline value; optional
 * legend rows (9px r3 swatch, name, 600 value).
 */

export interface DonutSegment {
  label: string
  value: number
  color?: string
}

export function DonutChart({
  segments,
  size = 112,
  centerValue,
  centerLabel,
  legend = false,
  valueFormat = fmtR0,
  className,
}: {
  segments: DonutSegment[]
  size?: number
  centerValue?: React.ReactNode
  centerLabel?: React.ReactNode
  /** Render legend rows beside the ring. */
  legend?: boolean
  valueFormat?: (v: number) => string
  className?: string
}) {
  const [swept, setSwept] = React.useState(false)
  React.useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setSwept(true)))
    return () => cancelAnimationFrame(raf)
  }, [])

  const stroke = size * (19 / 112)
  const r = (size - stroke) / 2
  const total = segments.reduce((a, s) => a + Math.max(0, s.value), 0)
  let start = 0
  const arcs = segments.map((s, i) => {
    const frac = total > 0 ? Math.max(0, s.value) / total : 0
    const arc = { ...s, frac, start, color: s.color ?? CHART_COLORS[i % CHART_COLORS.length] }
    start += frac
    return arc
  })

  return (
    <div data-slot="donut-chart" className={cn("flex items-center gap-4", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#ECEDEE"
            strokeWidth={stroke}
          />
          {arcs.map((a, i) =>
            a.frac > 0 ? (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={a.color}
                strokeWidth={stroke}
                pathLength={1}
                strokeDasharray={`${swept ? Math.max(a.frac - 0.004, 0.001) : 0.001} 1`}
                strokeDashoffset={-a.start}
                style={{
                  transition: `stroke-dasharray .6s cubic-bezier(.2,.9,.2,1) ${i * 60}ms, stroke-dashoffset .6s cubic-bezier(.2,.9,.2,1)`,
                }}
              />
            ) : null
          )}
        </svg>
        {(centerValue !== undefined || centerLabel !== undefined) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            {centerValue !== undefined && (
              <div className="text-[19px] font-bold tracking-[-0.02em] text-[#1B1D21] tabular-nums">
                {centerValue}
              </div>
            )}
            {centerLabel !== undefined && (
              <div className="text-[10px] text-[#8B9098]">{centerLabel}</div>
            )}
          </div>
        )}
      </div>
      {legend && (
        <div className="min-w-0 flex-1 space-y-1.5">
          {arcs.map((a, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span
                aria-hidden
                className="h-[9px] w-[9px] shrink-0 rounded-[3px]"
                style={{ background: a.color }}
              />
              <span className="min-w-0 flex-1 truncate text-[#3A3F47]">{a.label}</span>
              <span className="font-semibold text-[#1B1D21] tabular-nums">
                {valueFormat(a.value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
