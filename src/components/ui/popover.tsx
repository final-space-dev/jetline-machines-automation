"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/ui/utils"

type Align = "start" | "center" | "end"
type Side = "top" | "bottom"

type PopoverContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLElement | null>
}

const PopoverContext = React.createContext<PopoverContextValue>({
  open: false,
  setOpen: () => {},
  triggerRef: { current: null },
})

function Popover({
  open,
  onOpenChange,
  children,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}) {
  const [innerOpen, setInnerOpen] = React.useState(false)
  const controlled = open !== undefined
  const actualOpen = controlled ? open : innerOpen
  const triggerRef = React.useRef<HTMLElement | null>(null)
  const setOpen = React.useCallback(
    (o: boolean) => {
      if (!controlled) setInnerOpen(o)
      onOpenChange?.(o)
    },
    [controlled, onOpenChange]
  )
  const ctx = React.useMemo(
    () => ({ open: actualOpen, setOpen, triggerRef }),
    [actualOpen, setOpen]
  )
  return (
    <PopoverContext.Provider value={ctx}>{children}</PopoverContext.Provider>
  )
}

function PopoverTrigger({
  render,
  children,
  className,
  onClick,
  disabled,
  ...props
}: React.ComponentProps<"button"> & { render?: React.ReactElement }) {
  const { open, setOpen, triggerRef } = React.useContext(PopoverContext)
  const setNode = (node: HTMLElement | null) => {
    triggerRef.current = node
  }
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e)
    if (!e.defaultPrevented) setOpen(!open)
  }
  if (render) {
    const el = render as React.ReactElement<Record<string, unknown>>
    return React.cloneElement(el, {
      ...props,
      ref: setNode,
      onClick: handleClick,
      disabled,
      "aria-expanded": open,
      "data-slot": "popover-trigger",
      className: cn(className, el.props.className as string | undefined),
      children: children ?? (el.props.children as React.ReactNode),
    })
  }
  return (
    <button
      type="button"
      ref={setNode}
      data-slot="popover-trigger"
      aria-expanded={open}
      onClick={handleClick}
      disabled={disabled}
      className={className}
      {...props}
    >
      {children}
    </button>
  )
}

function PopoverContent({
  className,
  align = "center",
  side = "bottom",
  sideOffset = 4,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  align?: Align
  side?: Side
  sideOffset?: number
}) {
  const { open, setOpen, triggerRef } = React.useContext(PopoverContext)
  const panelRef = React.useRef<HTMLDivElement | null>(null)
  const [style, setStyle] = React.useState<React.CSSProperties>()
  // Until the first measurement runs, keep the panel invisible so it never
  // paints at its unpositioned (right-drifting) location for a frame.
  const resolvedStyle = style ?? { position: "fixed" as const, visibility: "hidden" as const }

  const position = React.useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    // Measured offsets, never transforms: entry animations (animate-pop-in)
    // override an inline transform while they play, which made end-aligned
    // panels sit unshifted to the right until the animation finished.
    const panelW = panelRef.current?.offsetWidth ?? 0
    const panelH = panelRef.current?.offsetHeight ?? 0
    const next: React.CSSProperties = { position: "fixed", zIndex: 50 }
    if (side === "bottom") next.top = rect.bottom + sideOffset
    else next.top = rect.top - sideOffset - panelH
    if (align === "start") next.left = rect.left
    else if (align === "end") next.left = rect.right - panelW
    else next.left = rect.left + rect.width / 2 - panelW / 2
    setStyle(next)
  }, [align, side, sideOffset, triggerRef])

  React.useLayoutEffect(() => {
    if (!open) return
    position()
    window.addEventListener("resize", position)
    window.addEventListener("scroll", position, true)
    return () => {
      window.removeEventListener("resize", position)
      window.removeEventListener("scroll", position, true)
    }
  }, [open, position])

  React.useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node
      if (panelRef.current?.contains(target)) return
      if (triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open, setOpen, triggerRef])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div
      ref={panelRef}
      style={resolvedStyle}
      data-ui="front"
      data-slot="popover-content"
      className={cn(
        // Spec §3.11 Popover: 250px, r14, 14px padding, menu shadow, popIn.
        "z-50 w-[250px] rounded-[14px] border border-[#EEEFF0] bg-white p-[14px] text-[13px] text-[#1B1D21] shadow-[0_16px_40px_rgba(28,25,23,0.14)] outline-none animate-pop-in",
        className
      )}
      {...props}
    >
      {children}
    </div>,
    document.body
  )
}

export { Popover, PopoverTrigger, PopoverContent }
