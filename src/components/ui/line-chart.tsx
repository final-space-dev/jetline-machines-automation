"use client"

import * as React from "react"

import { cn } from "@/lib/ui/utils"
import { COLORS, SHADOWS } from "@/lib/ui/ui-tokens"
import { fmtR0 } from "@/lib/ui/format"
import { useTweenedMatrix } from "@/components/ui/chart-motion"

/**
 * LineChart - hand-built token-driven SVG line chart (no chart library).
 * Smooth monotone-cubic bezier paths, draw-on animation on mount, optional
 * gradient area fill, hover dots with the spec's dark tooltip. Data changes
 * MORPH: the point arrays and the y-scale tween through requestAnimationFrame
 * on the 380ms house curve (chart-motion), axis ticks crossfade into their
 * new positions - a metric or grain switch never remounts blank.
 */

export interface LineSeriesDef {
  label: string
  values: (number | null)[]
  color?: string
  /** Paint a soft gradient area under this line. */
  fill?: boolean
  dashed?: boolean
  /** The line the eye should find first (the latest year): a heavier stroke. */
  bold?: boolean
  /** false = no point labels for this line even when the chart shows values
   * (many lines: label the one that matters, the hover names the rest). */
  labels?: boolean
}

/**
 * MANY LINES ON ONE CHART (user rule 2026-09-18): every line gets its OWN HUE.
 * Shades of one colour cannot be told apart on a working screen. Distinct
 * hues, no yellow or amber; the first colour is the one for the line that
 * matters most (the latest year).
 */
export const SERIES_COLORS = [
  "#2A5BD7", // blue
  "#17795B", // green
  "#BA433A", // red
  "#7A4CC9", // purple
  "#0891B2", // teal
  "#D9730D", // orange
  "#1B1D21", // ink
  "#B0308A", // magenta
  "#696F79", // grey
  "#8B5E3C", // brown (a tenth line keeps its own hue; earlier assignments unchanged)
] as const

/** Chart series palette: blues, greens and greys only (no yellow/amber). */
export const CHART_COLORS = [
  COLORS.signal,
  COLORS.proven,
  "#0B6E9E",
  COLORS.sky,
  COLORS.muted,
  COLORS.deficit,
] as const

/** Axis-compact rand format: "1.2bn", "84.5m", "690k", negatives bracketed.
 * Trailing ".0" is dropped so one axis never mixes "50.0m" with "100m". */
export function compactR(v: number): string {
  const a = Math.abs(v)
  let s =
    a >= 1e9 ? `${(a / 1e9).toFixed(a >= 1e10 ? 1 : 2)}bn`
    : a >= 1e6 ? `${(a / 1e6).toFixed(a >= 1e8 ? 0 : 1)}m`
    : a >= 1e3 ? `${Math.round(a / 1e3)}k`
    : `${Math.round(a)}`
  s = s.replace(/\.0+(?=[a-z])/, "")
  return v < 0 ? `(${s})` : s
}

/** Measure the rendered box of a chart wrapper (responsive, no libraries). */
export function useChartBox(): [React.RefObject<HTMLDivElement | null>, { w: number; h: number }] {
  const ref = React.useRef<HTMLDivElement | null>(null)
  const [box, setBox] = React.useState({ w: 0, h: 0 })
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () =>
      setBox((b) => {
        const w = el.clientWidth
        const h = el.clientHeight
        return b.w === w && b.h === h ? b : { w, h }
      })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, box]
}

/** Spec §3.11 dark tooltip skin, absolutely positioned inside the chart. */
export function ChartTip({
  x,
  y,
  flip,
  children,
}: {
  x: number
  y: number
  flip: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className="pointer-events-none absolute z-20 rounded-[9px] bg-[#1B1D21] px-2.5 py-2 text-[11.5px] leading-[1.5] text-white"
      style={{
        left: x,
        top: y,
        transform: flip ? "translateX(calc(-100% - 10px))" : "translateX(10px)",
        boxShadow: SHADOWS.tooltip,
      }}
    >
      {children}
    </div>
  )
}

const fx = (n: number) => Math.round(n * 100) / 100

/** Monotone cubic interpolation (Fritsch-Carlson): smooth, overshoot-free. */
function monotoneSegment(pts: { x: number; y: number }[]): string {
  const n = pts.length
  if (n === 0) return ""
  if (n === 1) return ""
  const h: number[] = []
  const d: number[] = []
  for (let i = 0; i < n - 1; i++) {
    h.push(pts[i + 1].x - pts[i].x)
    d.push((pts[i + 1].y - pts[i].y) / (pts[i + 1].x - pts[i].x || 1))
  }
  const m: number[] = new Array(n)
  m[0] = d[0]
  m[n - 1] = d[n - 2]
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0
    else {
      const w1 = 2 * h[i] + h[i - 1]
      const w2 = h[i] + 2 * h[i - 1]
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i])
    }
  }
  let path = `M${fx(pts[0].x)} ${fx(pts[0].y)}`
  for (let i = 0; i < n - 1; i++) {
    const c1x = pts[i].x + h[i] / 3
    const c1y = pts[i].y + (m[i] * h[i]) / 3
    const c2x = pts[i + 1].x - h[i] / 3
    const c2y = pts[i + 1].y - (m[i + 1] * h[i]) / 3
    path += ` C${fx(c1x)} ${fx(c1y)}, ${fx(c2x)} ${fx(c2y)}, ${fx(pts[i + 1].x)} ${fx(pts[i + 1].y)}`
  }
  return path
}

export function niceStep(rough: number): number {
  if (!(rough > 0)) return 1
  const pow = Math.pow(10, Math.floor(Math.log10(rough)))
  const f = rough / pow
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return nice * pow
}

/** Shared y-scale math: target min/max + nice ticks from the PROP values, so
 * tick labels stay stable while the tweened scale glides underneath them. */
export function scaleOf(all: number[], includeZero: boolean) {
  let min = all.length ? Math.min(...all) : 0
  let max = all.length ? Math.max(...all) : 1
  if (includeZero) {
    min = Math.min(min, 0)
    max = Math.max(max, 0)
  }
  if (min === max) {
    max = min + (Math.abs(min) || 1)
    min = min - (Math.abs(min) || 1) * 0.2
  }
  const step = niceStep((max - min) / 4)
  const ticks: number[] = []
  for (let t = Math.ceil(min / step) * step; t <= max + step * 0.001; t += step) ticks.push(t)
  return { min, max, step, ticks }
}

export function LineChart({
  series,
  labels,
  height,
  valueFormat = fmtR0,
  axisFormat = compactR,
  yIncludeZero = true,
  showValues = false,
  legend = false,
  onPointClick,
  className,
}: {
  series: LineSeriesDef[]
  labels: string[]
  /** Fixed pixel height; omitted = fill the parent (parent needs a height). */
  height?: number
  /** Tooltip value format (defaults to whole rands). */
  valueFormat?: (v: number) => string
  /** Y-axis tick + point-label format (defaults to compact rands). */
  axisFormat?: (v: number) => string
  yIncludeZero?: boolean
  /** Label EVERY data point of every series with its value (compact),
   * collision-staggered above/below the lines. */
  showValues?: boolean
  /** Compact swatch legend row above the plot, right-aligned. */
  legend?: boolean
  /** A click anywhere on the plot picks the nearest label (the hovered one):
   * its index and label, so a page can open what the point is made of (R1). */
  onPointClick?: (index: number, label: string) => void
  className?: string
}) {
  const [ref, box] = useChartBox()
  const [drawn, setDrawn] = React.useState(false)
  const [hoverI, setHoverI] = React.useState<number | null>(null)
  const gradId = React.useId()

  React.useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)))
    return () => cancelAnimationFrame(raf)
  }, [])

  // Target scale (stable tick labels) + tweened values and tweened scale.
  const all: number[] = []
  for (const s of series) for (const v of s.values) if (v !== null && isFinite(v)) all.push(v)
  const scale = scaleOf(all, yIncludeZero)
  const dispValues = useTweenedMatrix(series.map((s) => s.values))
  const dispScaleRow = useTweenedMatrix([[scale.min, scale.max]])
  const dMin = (dispScaleRow[0]?.[0] as number) ?? scale.min
  const dMax = (dispScaleRow[0]?.[1] as number) ?? scale.max

  const w = box.w
  // The legend is its own flow row ABOVE the plot (never overlaying the SVG),
  // so the SVG area shrinks by the row's height and height-capped panels
  // never overflow. Long label sets WRAP to further rows instead of clipping
  // the leading entries: a greedy width estimate (deliberately generous at
  // ~6px per character plus swatch and gaps, so the estimate never wraps
  // later than the browser does) predicts the row count, and the height
  // budget grows with it - the SVG shrinks by the full wrapped height.
  let legendRows = 1
  if (legend && series.length > 0 && w > 0) {
    const avail = Math.max(40, w - 8) // row width inside the px-1 padding
    let rowW = 0
    for (const s of series) {
      const itemW = 15 + s.label.length * 6 // swatch + gap + estimated text
      const next = rowW === 0 ? itemW : rowW + 10 + itemW // 10 = gap-x-2.5
      if (next > avail && rowW > 0) {
        legendRows++
        rowW = itemW
      } else rowW = next
    }
  }
  const legendH =
    legend && series.length > 0 ? (legendRows === 1 ? 18 : legendRows * 16 + 4) : 0
  const h = Math.max(0, (height ?? box.h) - legendH)
  const padL = 46
  const padR = 16
  const padT = showValues ? 14 : 10
  // EVERY x tick carries a label (no decimation): tight domains tilt instead.
  const slotEstimate = labels.length > 1 ? (w - padL - padR) / (labels.length - 1) : w
  const maxLabelPx = Math.max(0, ...labels.map((l) => l.length)) * 5.6
  const tilt = labels.length > 1 && maxLabelPx > slotEstimate * 0.92
  const padB = tilt ? Math.min(56, Math.max(26, Math.round(maxLabelPx * 0.5))) : 20
  const plotW = Math.max(0, w - padL - padR)
  const plotH = Math.max(0, h - padT - padB)
  const n = labels.length

  const xAt = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW)
  const yAt = (v: number) => padT + (dMax === dMin ? 0.5 : (dMax - v) / (dMax - dMin)) * plotH
  const clampY = (y: number) => Math.max(padT - 6, Math.min(padT + plotH + 6, y))
  const baselineY = clampY(yAt(Math.max(dMin, Math.min(dMax, 0))))

  const paths = series.map((s, si) => {
    const color = s.color ?? CHART_COLORS[si % CHART_COLORS.length]
    const disp = dispValues[si] ?? s.values
    // Nulls split the line into contiguous runs - gaps stay gaps.
    const runs: { x: number; y: number }[][] = []
    let run: { x: number; y: number }[] = []
    disp.forEach((v, i) => {
      if (v === null || !isFinite(v)) {
        if (run.length) runs.push(run)
        run = []
      } else run.push({ x: xAt(i), y: clampY(yAt(v)) })
    })
    if (run.length) runs.push(run)
    const d = runs.filter((r) => r.length > 1).map(monotoneSegment).join(" ")
    const area = runs
      .filter((r) => r.length > 1)
      .map((r) => `${monotoneSegment(r)} L${fx(r[r.length - 1].x)} ${fx(baselineY)} L${fx(r[0].x)} ${fx(baselineY)} Z`)
      .join(" ")
    let lastI = -1
    for (let i = s.values.length - 1; i >= 0; i--) {
      const v = s.values[i]
      if (v !== null && isFinite(v)) { lastI = i; break }
    }
    const lastDisp = lastI >= 0 && disp[lastI] !== null && isFinite(disp[lastI] as number)
      ? (disp[lastI] as number)
      : lastI >= 0 ? (s.values[lastI] as number) : 0
    return { s, color, d, area, lastI, lastDisp }
  })

  // Value labels at EVERY data point: text from the TARGET data (crisp while
  // tweening), position from the tweened point. Per x-slot the topmost series
  // labels above its point, the rest sit below theirs, pushed apart 10px+.
  const pointLabels: { x: number; y: number; text: string; color: string; anchor: "start" | "middle" | "end" }[] = []
  if (showValues && n > 0) {
    for (let i = 0; i < n; i++) {
      const cands = series
        .map((s, si) => {
          const v = s.values[i]
          if (v === null || !isFinite(v) || s.labels === false) return null
          const dv = dispValues[si]?.[i]
          const y = clampY(yAt(dv !== null && dv !== undefined && isFinite(dv) ? dv : v))
          return { si, y, text: axisFormat(v), color: s.color ?? CHART_COLORS[si % CHART_COLORS.length] }
        })
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .sort((a, b) => a.y - b.y)
      const anchor: "start" | "middle" | "end" = i === 0 ? "start" : i === n - 1 ? "end" : "middle"
      const x = xAt(i)
      // Tight slots (label wider than the x-step) zig-zag alternate points
      // further from the line so neighbours never touch.
      const slotStep = n > 1 ? plotW / (n - 1) : plotW
      const maxTextW = Math.max(...cands.map((c) => c.text.length)) * 5.4
      const zig = slotStep < maxTextW + 6 && i % 2 === 1
      const slot: typeof pointLabels = []
      cands.forEach((c, ci) => {
        let ly = ci === 0 ? c.y - 7 - (zig ? 10 : 0) : c.y + 14 + (zig ? 10 : 0)
        if (ci === 0) {
          // A steeply rising line can stroke through the topmost label at
          // y-7: estimate the path's height across the label's width toward
          // each higher neighbour (monotone segments stay between their end
          // points, so a linear estimate capped at the neighbour is safe)
          // and lift the label a few px clear of it.
          const halfW = (c.text.length * 5.6) / 2
          const spanL = anchor === "start" ? 0 : anchor === "end" ? halfW * 2 : halfW
          const spanR = anchor === "end" ? 0 : anchor === "start" ? halfW * 2 : halfW
          for (const [j, span] of [
            [i - 1, spanL],
            [i + 1, spanR],
          ] as const) {
            if (j < 0 || j >= n || span <= 0) continue
            const tv = series[c.si].values[j]
            if (tv === null || !isFinite(tv)) continue
            const dv = dispValues[c.si]?.[j]
            const ny = clampY(yAt(dv !== null && dv !== undefined && isFinite(dv) ? dv : tv))
            if (ny >= c.y) continue // segment is flat or falling on this side
            const pathY = c.y + ((ny - c.y) / slotStep) * Math.min(span, slotStep)
            if (pathY < ly + 2) ly = pathY - 4
          }
        }
        // Re-space against EVERY label already placed in this slot, not just
        // the previous one: two series nearly coinciding at the same x (a
        // shared dip) put natural spots within 9px of each other - the later
        // label goes below its point and keeps stepping down until it clears
        // every placed label by 10px.
        const clashes = (yy: number) => slot.some((p) => Math.abs(p.y - yy) < 10)
        if (ci > 0 && clashes(ly)) ly = c.y + 14 + (zig ? 10 : 0)
        let steps = 0
        while (clashes(ly) && steps++ < 12) ly += 10.5
        // Never into the x tick row: the tick text sits below padT + plotH + 4.
        ly = Math.min(Math.max(9, ly), padT + plotH + 1)
        slot.push({ x, y: ly, text: c.text, color: c.color, anchor })
      })
      // Bottom-clamped labels collapse onto one another (series diving off the
      // scale together): walk back up and re-space them 10px apart.
      for (let k = slot.length - 2; k >= 0; k--) {
        if (slot[k].y > slot[k + 1].y - 10) slot[k].y = slot[k + 1].y - 10
      }
      pointLabels.push(...slot)
    }
  }

  const ticksKey = scale.ticks.map((t) => Math.round(t)).join("|")
  const xKey = labels.join("|")

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!n || !plotW) return
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const i = Math.round(((mx - padL) / plotW) * (n - 1))
    setHoverI(Math.max(0, Math.min(n - 1, i)))
  }

  return (
    <div
      ref={ref}
      data-slot="line-chart"
      className={cn("relative w-full", height === undefined && "h-full", className)}
      style={height !== undefined ? { height } : undefined}
    >
      <style>{`@keyframes chartAxisFade { from { opacity: 0 } to { opacity: 1 } }`}</style>
      {legend && series.length > 0 && (
        <div
          className="flex flex-wrap content-start items-center justify-end gap-x-2.5 gap-y-0.5 overflow-hidden px-1"
          style={{ height: legendH }}
        >
          {series.map((s, si) => (
            <span key={si} className="flex items-center gap-1 whitespace-nowrap text-[10.5px] font-medium text-[#696F79]">
              <span
                aria-hidden
                className="inline-block h-[7px] w-[7px] rounded-[2px]"
                style={{ background: s.color ?? CHART_COLORS[si % CHART_COLORS.length] }}
              />
              {s.label}
            </span>
          ))}
        </div>
      )}
      {w > 0 && h > 0 && (
        <svg
          width={w}
          height={h}
          onMouseMove={onMove}
          onMouseLeave={() => setHoverI(null)}
          onClick={
            onPointClick
              ? (e) => {
                  if (!n || !plotW) return
                  const rect = e.currentTarget.getBoundingClientRect()
                  const i = Math.max(0, Math.min(n - 1, Math.round(((e.clientX - rect.left - padL) / plotW) * (n - 1))))
                  onPointClick(i, labels[i])
                }
              : undefined
          }
          className={cn("block", onPointClick && "cursor-pointer")}
        >
          <defs>
            {paths.map((p, i) =>
              p.s.fill ? (
                <linearGradient key={i} id={`${gradId}-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={p.color} stopOpacity="0.16" />
                  <stop offset="100%" stopColor={p.color} stopOpacity="0.01" />
                </linearGradient>
              ) : null
            )}
          </defs>
          {/* Gridlines + y ticks: keyed on the target tick set so a scale
              change fades the new axis in while it glides into place. */}
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
                <text
                  x={padL - 7}
                  y={clampY(yAt(t)) + 3}
                  textAnchor="end"
                  className="fill-[#696F79] text-[10px]"
                >
                  {axisFormat(t)}
                </text>
              </g>
            ))}
          </g>
          {/* x labels crossfade when the domain changes (grain switches).
              Every tick is labelled; tight domains tilt, never drop labels. */}
          <g key={`x-${xKey}`} style={{ animation: "chartAxisFade .38s ease" }}>
            {labels.map((l, i) => {
              const x = xAt(i)
              const y = tilt ? padT + plotH + 12 : h - 5
              return (
                <text
                  key={i}
                  x={x}
                  y={y}
                  textAnchor={tilt ? "end" : "middle"}
                  transform={tilt ? `rotate(-30 ${x} ${y})` : undefined}
                  className="fill-[#696F79] text-[10px]"
                >
                  {l}
                </text>
              )
            })}
          </g>
          {/* Areas */}
          {paths.map((p, i) =>
            p.s.fill && p.area ? (
              <path
                key={`a${i}`}
                d={p.area}
                fill={`url(#${gradId}-${i})`}
                style={{ opacity: drawn ? 1 : 0, transition: "opacity .7s ease .15s" }}
              />
            ) : null
          )}
          {/* Lines: pathLength normalized to 1 so dashoffset 1 -> 0 draws in */}
          {paths.map((p, i) =>
            p.d ? (
              <path
                key={`l${i}`}
                d={p.d}
                pathLength={1}
                fill="none"
                stroke={p.color}
                strokeWidth={p.s.bold ? 3.2 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={p.s.dashed ? "0.016 0.011" : "1 0"}
                strokeDashoffset={drawn ? 0 : 1}
                style={{ transition: "stroke-dashoffset .8s cubic-bezier(.2,.9,.2,1)" }}
              />
            ) : null
          )}
          {/* Latest-point dots + end labels */}
          {paths.map((p, i) =>
            p.lastI >= 0 ? (
              <circle
                key={`e${i}`}
                cx={xAt(p.lastI)}
                cy={clampY(yAt(p.lastDisp))}
                r={3}
                fill={p.color}
                style={{ opacity: drawn ? 1 : 0, transition: "opacity .4s ease .6s" }}
              />
            ) : null
          )}
          {pointLabels.map((l, i) => (
            <text
              key={`pl${i}`}
              x={l.x}
              y={l.y}
              textAnchor={l.anchor}
              className="text-[10px] font-semibold tabular-nums"
              style={{ fill: l.color, opacity: drawn ? 1 : 0, transition: "opacity .4s ease .4s" }}
            >
              {l.text}
            </text>
          ))}
          {/* Hover guide + dots */}
          {hoverI !== null && (
            <g>
              <line
                x1={xAt(hoverI)}
                x2={xAt(hoverI)}
                y1={padT}
                y2={padT + plotH}
                stroke="#C8CACD"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              {paths.map((p, i) => {
                const v = dispValues[i]?.[hoverI] ?? p.s.values[hoverI]
                return v !== null && isFinite(v) ? (
                  <circle
                    key={i}
                    cx={xAt(hoverI)}
                    cy={clampY(yAt(v))}
                    r={3.5}
                    fill="#FFFFFF"
                    stroke={p.color}
                    strokeWidth={2}
                  />
                ) : null
              })}
            </g>
          )}
        </svg>
      )}
      {hoverI !== null && w > 0 && (
        <ChartTip x={xAt(hoverI)} y={padT + legendH} flip={xAt(hoverI) > w * 0.62}>
          <div className="mb-1 font-semibold">{labels[hoverI]}</div>
          {paths.map((p, i) => {
            const v = p.s.values[hoverI]
            return (
              <div key={i} className="flex items-center gap-1.5 whitespace-nowrap">
                <span
                  aria-hidden
                  className="inline-block h-[7px] w-[7px] rounded-[2px]"
                  style={{ background: p.color }}
                />
                <span className="text-[#A8ADB5]">{p.s.label}</span>
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
