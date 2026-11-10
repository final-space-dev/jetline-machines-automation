"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/ui/utils"
import { SHADOWS } from "@/lib/ui/ui-tokens"

/**
 * The one tooltip. Replaces native title= attributes: instant styling
 * control, readable at data density, works with keyboard focus.
 *
 * Spec §3.11: dark ink bubble (#1B1D21), 11.5px / 1.5, r9, tooltip shadow,
 * popIn .16s ease.
 *
 *   <Tooltip content="Pull all trial balances"><Button .../></Tooltip>
 */
function Tooltip({
  content,
  side = "top",
  delay = 350,
  children,
}: {
  content: React.ReactNode
  side?: "top" | "bottom"
  delay?: number
  children: React.ReactElement
}) {
  const [open, setOpen] = React.useState(false)
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const anchorRef = React.useRef<HTMLElement | null>(null)

  const show = (el: HTMLElement) => {
    anchorRef.current = el
    timer.current = setTimeout(() => {
      const r = el.getBoundingClientRect()
      setPos({ x: r.left + r.width / 2, y: side === "top" ? r.top : r.bottom })
      setOpen(true)
    }, delay)
  }
  const hide = () => {
    if (timer.current) clearTimeout(timer.current)
    setOpen(false)
  }

  const childProps = children.props as {
    onMouseEnter?: (e: React.MouseEvent<HTMLElement>) => void
    onMouseLeave?: (e: React.MouseEvent<HTMLElement>) => void
    onFocus?: (e: React.FocusEvent<HTMLElement>) => void
    onBlur?: (e: React.FocusEvent<HTMLElement>) => void
  }
  const child = React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      show(e.currentTarget)
      childProps.onMouseEnter?.(e)
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      hide()
      childProps.onMouseLeave?.(e)
    },
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      show(e.currentTarget)
      childProps.onFocus?.(e)
    },
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      hide()
      childProps.onBlur?.(e)
    },
  })

  return (
    <>
      {child}
      {open && pos && typeof document !== "undefined" &&
        createPortal(
          // Outer div owns positioning; inner div owns the popIn animation so
          // the keyframe's transform cannot fight the centering translate.
          <div
            role="tooltip"
            data-ui="front"
            className={cn(
              "pointer-events-none fixed z-[60] -translate-x-1/2",
              side === "top" ? "-translate-y-full" : ""
            )}
            style={{
              left: pos.x,
              top: side === "top" ? pos.y - 6 : pos.y + 6,
            }}
          >
            <div
              style={{ boxShadow: SHADOWS.tooltip }}
              className="w-max max-w-[212px] animate-[popIn_.16s_ease] rounded-[9px] bg-[#1B1D21] px-2.5 py-2 text-[11.5px] leading-[1.5] text-white"
            >
              {content}
            </div>
          </div>,
          document.body
        )}
    </>
  )
}

export { Tooltip }
