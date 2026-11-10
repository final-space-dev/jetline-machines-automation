"use client"

import * as React from "react"

import { cn } from "@/lib/ui/utils"

type TabsContextValue = {
  value?: string
  onValueChange?: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue>({})

function Tabs({
  value,
  onValueChange,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange"> & {
  value?: string
  onValueChange?: (value: string) => void
}) {
  const ctx = React.useMemo(
    () => ({ value, onValueChange }),
    [value, onValueChange]
  )
  return (
    <TabsContext.Provider value={ctx}>
      <div
        data-slot="tabs"
        className={cn("flex flex-col gap-2", className)}
        {...props}
      >
        {children}
      </div>
    </TabsContext.Provider>
  )
}

function TabsList({
  className,
  onKeyDown,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const ctx = React.useContext(TabsContext)
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const [indicator, setIndicator] = React.useState<{ x: number; w: number } | null>(null)
  const [ready, setReady] = React.useState(false)

  // The sliding underline (design-spec-v1 §3.3 Tabs): measured off the active
  // trigger, so value changes (clicks, keyboard, controlled updates) all glide
  // instead of snapping.
  const measure = React.useCallback(() => {
    const list = listRef.current
    if (!list) return
    const active = list.querySelector<HTMLElement>('[role=tab][aria-selected="true"]')
    setIndicator(active ? { x: active.offsetLeft, w: active.offsetWidth } : null)
  }, [])

  React.useLayoutEffect(measure, [measure, ctx.value])

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
    onKeyDown?.(e)
    if (e.defaultPrevented) return
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return
    const tabs = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>(
        "[role=tab]:not(:disabled)"
      )
    )
    if (!tabs.length) return
    const current = tabs.indexOf(document.activeElement as HTMLButtonElement)
    let next = current
    if (e.key === "ArrowLeft") next = current <= 0 ? tabs.length - 1 : current - 1
    else if (e.key === "ArrowRight") next = current >= tabs.length - 1 ? 0 : current + 1
    else if (e.key === "Home") next = 0
    else next = tabs.length - 1
    e.preventDefault()
    tabs[next]?.focus()
    tabs[next]?.click()
  }
  return (
    <div
      ref={listRef}
      role="tablist"
      data-slot="tabs-list"
      onKeyDown={handleKeyDown}
      className={cn(
        "relative inline-flex w-fit items-stretch gap-0.5 border-b border-[#E8E9EB] text-[#696F79]",
        className
      )}
      {...props}
    >
      {indicator && (
        <div
          aria-hidden
          className={cn(
            "absolute -bottom-px left-0 h-[2px] rounded-[2px] bg-[#2A5BD7]",
            ready && "transition-[transform,width] duration-[380ms] ease-bubble"
          )}
          style={{ transform: `translateX(${indicator.x}px)`, width: indicator.w }}
        />
      )}
      {children}
    </div>
  )
}

function TabsTrigger({
  value,
  className,
  onClick,
  ...props
}: React.ComponentProps<"button"> & { value: string }) {
  const ctx = React.useContext(TabsContext)
  const active = ctx.value === value
  return (
    <button
      type="button"
      role="tab"
      data-slot="tabs-trigger"
      aria-selected={active}
      data-active={active || undefined}
      tabIndex={active ? 0 : -1}
      onClick={(e) => {
        onClick?.(e)
        if (!e.defaultPrevented) ctx.onValueChange?.(value)
      }}
      className={cn(
        // Spec §3.3 Tabs: 13.5px, 11/15/13px padding, active 600 ink on the
        // 2px Signal underline, inactive 500 #696F79.
        "relative inline-flex items-center justify-center gap-1.5 rounded-t-[6px] px-[15px] pt-[11px] pb-[13px] text-[13.5px] font-medium whitespace-nowrap text-[#696F79] transition-colors duration-[180ms] ease-standard outline-none select-none hover:text-[#1B1D21] focus-visible:ring-[3px] focus-visible:ring-[#E4EAFB] disabled:pointer-events-none disabled:opacity-50 data-active:font-semibold data-active:text-[#1B1D21] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  value,
  className,
  ...props
}: React.ComponentProps<"div"> & { value: string }) {
  const ctx = React.useContext(TabsContext)
  if (ctx.value !== value) return null
  return (
    <div
      role="tabpanel"
      data-slot="tabs-content"
      className={cn("flex-1 text-[13.5px] outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
