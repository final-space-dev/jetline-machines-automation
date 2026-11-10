"use client"

import * as React from "react"

import { cn } from "@/lib/ui/utils"

/** The filter-chip toggle ("Unmapped only"): spec §3.3 filter chips -
 * hairline chip, Signal wash + accent border when active. */
function Toggle({
  pressed,
  onPressedChange,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"button">, "onChange"> & {
  pressed: boolean
  onPressedChange: (pressed: boolean) => void
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      data-slot="toggle"
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "rounded-[9px] border px-3 py-2 text-[12.5px] font-medium transition-all duration-200 ease-standard focus-visible:ring-[3px] focus-visible:ring-[#E4EAFB] focus-visible:outline-none",
        pressed
          ? "border-[#2A5BD7] bg-[#EEF2FE] text-[#2148AE]"
          : "border-[#DEE0E3] bg-transparent text-[#4A5058] hover:bg-[#F1F2F3]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export { Toggle }
