"use client"

import * as React from "react"

import { cn } from "@/lib/ui/utils"
import { fmtR0 } from "@/lib/ui/format"
import { CHART_COLORS, ChartTip, compactR, scaleOf, useChartBox } from "@/components/ui/line-chart"
import { useTweenedMatrix } from "@/components/ui/chart-motion"

/**
 * BarChart - hand-built token-driven SVG column chart (no chart library).
 * Bars grow in on load AND morph on every data change: heights ride the
 * 380ms house-curve requestAnimationFrame tween (chart-motion), the y-scale
 * glides, axis ticks crossfade. Grouped series supported, negatives hang
 * below the baseline, optional value labels in compact rand notation, hover
 * slot highlight with the spec's dark tooltip.
 */

export interface BarSeriesDef {
  label: string
  values: (number | null)[]
  color?: string
}

export function BarChart({
  series,
  labels,
  height,
  valueFormat = fmtR0,
  axisFormat = compactR,
  showValues = false,
  barLabelFormat,
  onBarClick,
  className,
}: {
  series: BarSeriesDef[]
  labels: string[]
  /** Fixed pixel height; omitted = fill the parent (parent needs a height). */
  height?: number
  valueFormat?: (v: number) => string
  axisFormat?: (v: number) => string
  /** Value labels above the bars (compact); auto-thins when bars get narrow. */
  showValues?: boolean
  /** Format for the bar value labels (defaults to the axis format). */
  barLabelFormat?: (v: number) => string
  /** A click on a column picks its label: index and label, so a page can
   * open what the column is made of (R1). */
  onBarClick?: (index: number, label: string) => void
  className?: string
}) {
  const [ref, box] = useChartBox()
  const [hoverI, setHoverI] = React.useState<number | null>(null)

  const all: number[] = [0]
  for (const s of series) for (const v of s.values) if (v !== null && isFinite(v)) all.push(v)
  const scale = scaleOf(all, true)
  const dispValues = useTweenedMatrix(series.map((s) => s.values), { initialZero: true })
  const dispScaleRow = useTweenedMatrix([[scale.min, scale.max]])
  const dMin = (dispScaleRow[0]?.[0] as number) ?? scale.min
  const dMax = (dispScaleRow[0]?.[1] as number) ?? scale.max

  const w = box.w
  const h = height ?? box.h
  const padL = 46
  const padR = 10
  const padT = showValues ? 16 : 10
  // Long category labels (division names) tilt instead of colliding.
  const slotEstimate = labels.length ? (w - padL - padR) / labels.length : 0
  const maxLabelLen = Math.max(0, ...labels.map((l) => l.length))
  const maxLabelPx = maxLabelLen * 5.6
  const tiltLong = labels.length > 0 && maxLabelPx > slotEstimate * 0.92
  // SHORT labels (3-char months) in many narrow slots never trip the tilt
  // test yet still abut ("AugSepOctNovDec" in a ~319px panel). Guard with
  // the value labels' deliberately generous 6.2px/char estimate: when a
  // slot cannot hold its tick label plus a 4px gap, label alternate slots
  // instead (odd indexes skipped, see the tick row). Alternating beats tilt
  // here because upright text at 3 chars stays more legible than rotated
  // text at this size; tilt keeps its existing long-label trigger and
  // returns as the fallback in the extreme where even every-other-slot
  // labelling cannot fit.
  const tickEstPx = maxLabelLen * 6.2
  const cramped = labels.length > 0 && !tiltLong && slotEstimate < tickEstPx + 4
  const altTicksFit = slotEstimate * 2 >= tickEstPx + 4
  const alternateTicks = cramped && altTicksFit
  const tilt = tiltLong || (cramped && !altTicksFit)
  // A label tilted 30 degrees drops half its length below the axis, plus its
  // own line height: anything less clips the START of the longest labels.
  const padB = tilt ? Math.min(66, Math.max(26, Math.round(maxLabelLen * 6.1 * 0.5) + 12)) : 20
  const plotW = Math.max(0, w - padL - padR)
  const plotH = Math.max(0, h - padT - padB)
  const n = labels.length

  const yAt = (v: number) => padT + (dMax === dMin ? 0.5 : (dMax - v) / (dMax - dMin)) * plotH
  const clampY = (y: number) => Math.max(padT, Math.min(padT + plotH, y))
  const baseY = clampY(yAt(0))
  const slotW = n ? plotW / n : 0
  const groupW = slotW * 0.62
  const barGap = 2
  const barW = Math.max(2, (groupW - barGap * (series.length - 1)) / Math.max(1, series.length))
  const rx = Math.min(3, barW / 2)
  const slotX = (i: number) => padL + i * slotW + (slotW - groupW) / 2

  const fmtBar = barLabelFormat ?? axisFormat
  // Deliberately generous (~6.2px per character at the 10px label font) so
  // the collision test always sees a box at least as wide as the rendered
  // text - an underestimate here is exactly how adjacent-slot labels wider
  // than their slots ended up abutting ("17.6m15.4m").
  const estLabelW = (t: string) => t.length * 6.2
  // Labels placed so far across the WHOLE chart (rebuilt every render), so
  // neighbouring labels in adjacent slots keep a minimum gap too.
  const placedLabels: { x: number; y: number; w: number }[] = []
  const ticksKey = scale.ticks.map((t) => Math.round(t)).join("|")
  const xKey = labels.join("|")

  return (
    <div
      ref={ref}
      data-slot="bar-chart"
      className={cn("relative w-full", height === undefined && "h-full", className)}
      style={height !== undefined ? { height } : undefined}
    >
      <style>{`@keyframes chartAxisFade { from { opacity: 0 } to { opacity: 1 } }`}</style>
      {w > 0 && h > 0 && (
        <svg
          width={w}
          height={h}
          className={cn("block", onBarClick && "cursor-pointer")}
          onMouseMove={(e) => {
            if (!n || !plotW) return
            const rect = e.currentTarget.getBoundingClientRect()
            const i = Math.floor((e.clientX - rect.left - padL) / slotW)
            setHoverI(i >= 0 && i < n ? i : null)
          }}
          onMouseLeave={() => setHoverI(null)}
          onClick={
            onBarClick
              ? (e) => {
                  if (!n || !plotW) return
                  const rect = e.currentTarget.getBoundingClientRect()
                  const i = Math.floor((e.clientX - rect.left - padL) / slotW)
                  if (i >= 0 && i < n) onBarClick(i, labels[i])
                }
              : undefined
          }
        >
          <g key={ticksKey} style={{ animation: "chartAxisFade .38s ease" }}>
            {scale.ticks.map((t, i) => (
              <g key={i}>
                <line
                  x1={padL}
                  x2={w - padR}
                  y1={clampY(yAt(t))}
                  y2={clampY(yAt(t))}
                  stroke={Math.abs(t) < scale.step * 0.001 ? "#DEE0E3" : "#F1F1F2"}
                  strokeWidth={1}
                />
                <text x={padL - 7} y={clampY(yAt(t)) + 3} textAnchor="end" className="fill-[#9AA0A9] text-[10px]">
                  {axisFormat(t)}
                </text>
              </g>
            ))}
          </g>
          <g key={`x-${xKey}`} style={{ animation: "chartAxisFade .38s ease" }}>
            {/* Every x tick is labelled when it fits; tight domains alternate
                (short labels) or tilt (long labels), never drop silently -
                a skipped slot keeps a hover title carrying its label. */}
            {labels.map((l, i) => {
              const x = padL + i * slotW + slotW / 2
              const y = padT + plotH + 12
              // Alternating: even indexes labelled, odd skipped - EXCEPT the
              // first and last slots, which are ALWAYS labelled (no current/
              // emphasized-slot prop exists on this component; if one is ever
              // added, it must be kept labelled here too). When the last
              // index is odd it is force-labelled and its even neighbour
              // skips instead, so the final two ticks never abut.
              const skipped =
                alternateTicks &&
                i !== 0 &&
                i !== n - 1 &&
                ((n - 1) % 2 === 1 ? i % 2 === 1 || i === n - 2 : i % 2 === 1)
              if (skipped) {
                return (
                  <rect
                    key={i}
                    x={padL + i * slotW}
                    y={padT + plotH + 2}
                    width={slotW}
                    height={14}
                    fill="transparent"
                  >
                    <title>{l}</title>
                  </rect>
                )
              }
              return (
                <text
                  key={i}
                  x={x}
                  y={y}
                  textAnchor={tilt ? "end" : "middle"}
                  transform={tilt ? `rotate(-30 ${x} ${y})` : undefined}
                  className="fill-[#9AA0A9] text-[10px]"
                >
                  {l}
                </text>
              )
            })}
          </g>
          {hoverI !== null && (
            <rect
              x={padL + hoverI * slotW}
              y={padT}
              width={slotW}
              height={plotH}
              fill="rgba(42,91,215,.05)"
              rx={6}
            />
          )}
          {labels.map((_, i) => {
            // EVERY bar carries its value label. Whenever a label's box would
            // horizontally overlap ANY already placed label's box (under a
            // 3px gap) at a vertical distance under 10px - its own slot, the
            // adjacent one, anywhere - it staggers vertically (10.5px steps)
            // away from the baseline instead of abutting or dropping.
            return series.map((s, si) => {
              const target = s.values[i]
              if (target === null || !isFinite(target ?? NaN)) return null
              const v = (dispValues[si]?.[i] as number | null) ?? target
              if (v === null) return null
              const color = s.color ?? CHART_COLORS[si % CHART_COLORS.length]
              const yTop = clampY(yAt(Math.max(0, v)))
              const yBot = clampY(yAt(Math.min(0, v)))
              const barH = Math.max(yBot - yTop, 1)
              const x = slotX(i) + si * (barW + barGap)
              const text = fmtBar(target)
              let labelY: number | null = null
              let labelInside = false
              if (showValues) {
                const tw = estLabelW(text)
                const cx = x + barW / 2
                const dir = target >= 0 ? -1 : 1
                let ly = target >= 0 ? yTop - 4 : yBot + 11
                // Touching = closer horizontally than half the two label
                // widths plus a 3px minimum gap, at overlapping heights.
                const touches = (yy: number) =>
                  placedLabels.some(
                    (p) => Math.abs(p.x - cx) < (p.w + tw) / 2 + 3 && Math.abs(p.y - yy) < 10
                  )
                while (touches(ly)) ly += dir * 10.5
                // A negative label may never land on the x tick row: bars tall
                // and wide enough carry it inside their tail (white), the rest
                // lift it above their start so the tick labels stay clean.
                if (target < 0 && ly > padT + plotH - 2) {
                  if (barH > 16 && tw <= barW + 2) { ly = yBot - 5; labelInside = true }
                  else {
                    ly = yTop - 4
                    while (touches(ly)) ly -= 10.5
                  }
                }
                ly = Math.min(Math.max(ly, 10), h - padB + 12)
                // The edge clamp can UNDO the stagger (equal-height tall bars
                // in adjacent slots all clamp to the same y and read as one
                // run-on string): step back toward the plot interior until
                // the box clears every placed label again.
                let steps = 0
                while (touches(ly) && steps++ < 12) ly -= dir * 10.5
                ly = Math.min(Math.max(ly, 10), h - padB + 12)
                placedLabels.push({ x: cx, y: ly, w: tw })
                labelY = ly
              }
              return (
                <g key={`${i}-${si}`}>
                  <rect x={x} y={target >= 0 ? yTop : baseY} width={barW} height={barH} rx={rx} fill={color} />
                  {labelY !== null && (
                    <text
                      x={x + barW / 2}
                      y={labelY}
                      textAnchor="middle"
                      className={cn(
                        "text-[10px] font-medium tabular-nums",
                        labelInside ? "fill-white" : "fill-[#5A6068]"
                      )}
                    >
                      {text}
                    </text>
                  )}
                </g>
              )
            })
          })}
        </svg>
      )}
      {hoverI !== null && w > 0 && (
        <ChartTip
          x={padL + hoverI * slotW + slotW / 2}
          y={padT}
          flip={padL + hoverI * slotW > w * 0.62}
        >
          <div className="mb-1 font-semibold">{labels[hoverI]}</div>
          {series.map((s, si) => {
            const v = s.values[hoverI]
            return (
              <div key={si} className="flex items-center gap-1.5 whitespace-nowrap">
                <span
                  aria-hidden
                  className="inline-block h-[7px] w-[7px] rounded-[2px]"
                  style={{ background: s.color ?? CHART_COLORS[si % CHART_COLORS.length] }}
                />
                <span className="text-[#A8ADB5]">{s.label}</span>
                <span className="ml-auto pl-3 font-semibold tabular-nums">
                  {v === null || !isFinite(v ?? NaN) ? "n/a" : valueFormat(v)}
                </span>
              </div>
            )
          })}
        </ChartTip>
      )}
    </div>
  )
}
