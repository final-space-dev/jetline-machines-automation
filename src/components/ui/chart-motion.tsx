"use client"

import * as React from "react"

import { fmtR0 } from "@/lib/ui/format"

/**
 * Chart motion kit - the shared animation engine behind the hand-built SVG
 * charts and KPI numbers. Everything tweens through requestAnimationFrame on
 * the house curve cubic-bezier(.2,.9,.2,1) at 380ms (R35), so metric/grain/
 * period switches MORPH between states instead of remounting blank.
 */

/** Numerically solved CSS cubic-bezier easing (Newton iteration on x(t)). */
export function cubicBezierEase(p1x: number, p1y: number, p2x: number, p2y: number) {
  const cx = 3 * p1x
  const bx = 3 * (p2x - p1x) - cx
  const ax = 1 - cx - bx
  const cy = 3 * p1y
  const by = 3 * (p2y - p1y) - cy
  const ay = 1 - cy - by
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t
  const sy = (t: number) => ((ay * t + by) * t + cy) * t
  const dxdt = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  return (x: number): number => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 8; i++) {
      const err = sx(t) - x
      if (Math.abs(err) < 1e-6) break
      const d = dxdt(t)
      if (Math.abs(d) < 1e-6) break
      t -= err / d
    }
    return sy(Math.max(0, Math.min(1, t)))
  }
}

/** The house curve: cubic-bezier(.2,.9,.2,1), 380ms (ui-tokens MOTION spring). */
export const EASE_HOUSE = cubicBezierEase(0.2, 0.9, 0.2, 1)
export const MOTION_MS = 380

export type TweenRow = (number | null)[]

/** Nearest-index resample so a 12-point series can morph into a 4-point one
 * (grain switches) without snapping. */
function resample(row: TweenRow | undefined, n: number): TweenRow {
  if (!row || row.length === 0) return new Array(n).fill(null)
  if (row.length === n) return row
  if (n === 1) return [row[row.length - 1]]
  return Array.from({ length: n }, (_, i) => row[Math.round((i * (row.length - 1)) / (n - 1))])
}

/**
 * Tween a matrix of series values toward `target`. Interrupting changes tween
 * from the currently DISPLAYED state, never from the stale start. Nulls stay
 * nulls (gaps never animate); a value appearing where none was snaps in.
 * `initialZero` grows the first render from zero (bar-chart load animation).
 */
export function useTweenedMatrix(
  target: TweenRow[],
  opts?: { initialZero?: boolean; duration?: number }
): TweenRow[] {
  const duration = opts?.duration ?? MOTION_MS
  const initialZero = opts?.initialZero ?? false
  const [disp, setDisp] = React.useState<TweenRow[]>(() =>
    initialZero ? target.map((r) => r.map((v) => (v === null ? null : 0))) : target
  )
  const dispRef = React.useRef(disp)
  const firstRef = React.useRef(true)
  const key = JSON.stringify(target)

  React.useEffect(() => {
    const first = firstRef.current
    firstRef.current = false
    if (first && !initialZero) {
      dispRef.current = target
      setDisp(target)
      return
    }
    const start = dispRef.current
    const from = target.map((row, si) => {
      const old = resample(start[si], row.length)
      return row.map((v, i) => {
        if (v === null) return null
        const f = old[i]
        return f === null || f === undefined || !isFinite(f) ? v : f
      })
    })
    // First mount growing from zero: force the zero baseline even if state
    // shape drifted (defensive; state was initialized to zeros already).
    if (first && initialZero) {
      for (let si = 0; si < from.length; si++)
        for (let i = 0; i < from[si].length; i++) if (from[si][i] !== null) from[si][i] = 0
    }
    let raf = 0
    const t0 = performance.now()
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / duration)
      const e = EASE_HOUSE(p)
      const cur =
        p >= 1
          ? target
          : target.map((row, si) =>
              row.map((v, i) => {
                if (v === null) return null
                const f = from[si][i] as number
                return f + (v - f) * e
              })
            )
      dispRef.current = cur
      setDisp(cur)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return disp
}

/** KPI number tween: counts from the previous figure to the new one (~400ms). */
export function CountUp({
  value,
  format = fmtR0,
  duration = 400,
  className,
}: {
  value: number
  format?: (v: number) => string
  duration?: number
  className?: string
}) {
  const [disp, setDisp] = React.useState(value)
  const dispRef = React.useRef(value)
  const firstRef = React.useRef(true)

  React.useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false
      dispRef.current = value
      setDisp(value)
      return
    }
    const from = dispRef.current
    if (from === value) return
    let raf = 0
    const t0 = performance.now()
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / duration)
      const v = p >= 1 ? value : from + (value - from) * EASE_HOUSE(p)
      dispRef.current = v
      setDisp(v)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return <span className={className}>{format(disp)}</span>
}
