"use client"

import * as React from "react"

import { cn } from "@/lib/ui/utils"
import { FilterGroup } from "@/components/ui/filter-group"

/**
 * Segmented control (design-spec-v1 §3.3): the travelling-bubble select.
 * Warm #F1F2F3 track (r11, 3px pad), items 12.5/500 - active ink riding a
 * white bubble (r9, segmentedBubble shadow) that glides on the 380ms spring;
 * inactive #7A8087. Tabs now means tabs (underline); this is the filter idiom.
 */
function Segmented({
  label,
  value,
  onValueChange,
  options,
  disabled,
  className,
}: {
  label?: string
  value: string
  onValueChange: (value: string) => void
  options: { value: string; label: React.ReactNode; hidden?: boolean }[]
  disabled?: boolean
  className?: string
}) {
  const visible = options.filter((o) => !o.hidden)
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const [bubble, setBubble] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [ready, setReady] = React.useState(false)

  // Active-mode bubble: measured off the selected item so clicks, keyboard
  // moves and controlled updates all glide instead of snapping (§1.9).
  const measure = React.useCallback(() => {
    const list = listRef.current
    if (!list) return
    const active = list.querySelector<HTMLElement>('[data-seg-item][data-active="true"]')
    setBubble(
      active
        ? { x: active.offsetLeft, y: active.offsetTop, w: active.offsetWidth, h: active.offsetHeight }
        : null
    )
  }, [])

  React.useLayoutEffect(measure, [measure, value, visible.length])

  React.useLayoutEffect(() => {
    const raf = requestAnimationFrame(() => setReady(true))
    const ro = new ResizeObserver(measure)
    if (listRef.current) ro.observe(listRef.current)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [measure])

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled) return
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return
    const i = visible.findIndex((o) => o.value === value)
    let next = i
    if (e.key === "ArrowLeft") next = i <= 0 ? visible.length - 1 : i - 1
    else if (e.key === "ArrowRight") next = i >= visible.length - 1 ? 0 : i + 1
    else if (e.key === "Home") next = 0
    else next = visible.length - 1
    if (next === i || !visible[next]) return
    e.preventDefault()
    onValueChange(visible[next].value)
    listRef.current
      ?.querySelectorAll<HTMLButtonElement>("[data-seg-item]")
      [next]?.focus()
  }

  const control = (
    <div
      ref={listRef}
      role="radiogroup"
      data-slot="segmented"
      onKeyDown={handleKeyDown}
      className={cn(
        "relative inline-flex w-fit items-center rounded-[11px] bg-[#F1F2F3] p-[3px]",
        disabled && "pointer-events-none opacity-40"
      )}
    >
      {bubble && (
        <div
          aria-hidden
          className={cn(
            "absolute left-0 top-0 z-0 rounded-[9px] bg-white shadow-[0_1px_2px_rgba(28,25,23,0.10),0_0_0_1px_rgba(28,25,23,0.04)]",
            ready && "transition-[transform,width,height] duration-[380ms] ease-bubble"
          )}
          style={{ transform: `translate(${bubble.x}px, ${bubble.y}px)`, width: bubble.w, height: bubble.h }}
        />
      )}
      {visible.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            data-seg-item
            data-active={active ? "true" : undefined}
            tabIndex={active ? 0 : -1}
            disabled={disabled}
            onClick={() => onValueChange(o.value)}
            className={cn(
              "relative z-10 inline-flex items-center justify-center gap-1.5 rounded-[9px] px-3 py-[5px] text-[12.5px] font-medium whitespace-nowrap transition-colors duration-[220ms] ease-standard outline-none select-none focus-visible:ring-[3px] focus-visible:ring-[#E4EAFB]",
              active ? "text-[#1B1D21]" : "text-[#7A8087] hover:text-[#1B1D21]"
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )

  if (label) {
    return <FilterGroup label={label} className={className}>{control}</FilterGroup>
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {control}
    </span>
  )
}

export { Segmented }
