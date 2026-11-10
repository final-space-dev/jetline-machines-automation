"use client"

import * as React from "react"

import { cn } from "@/lib/ui/utils"

/** The one switch. Replaces the hand-rolled role="switch" copies. */
function Switch({
  checked,
  onCheckedChange,
  disabled,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "onChange"> & {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      data-slot="switch"
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-[21px] w-9 shrink-0 cursor-pointer items-center rounded-full pointer-coarse:after:absolute pointer-coarse:after:-inset-x-1 pointer-coarse:after:-inset-y-3 pointer-coarse:after:content-[''] transition-colors duration-[240ms] ease-standard focus-visible:ring-[3px] focus-visible:ring-[#E4EAFB] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-[#2A5BD7]" : "bg-[#D8DADE]",
        className
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block size-[17px] rounded-full bg-white shadow-[0_1px_3px_rgba(28,25,23,.3)] transition-transform duration-[280ms] ease-bubble",
          checked ? "translate-x-[17px]" : "translate-x-[2px]"
        )}
      />
    </button>
  )
}

export { Switch }
