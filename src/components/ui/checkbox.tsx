"use client"

import * as React from "react"
import { Check, Minus } from "lucide-react"

import { cn } from "@/lib/ui/utils"

/** The one checkbox. Replaces raw <input type="checkbox"> usage. */
function Checkbox({
  checked,
  onCheckedChange,
  disabled,
  className,
  indeterminate,
  ...props
}: Omit<React.ComponentProps<"button">, "onChange"> & {
  checked: boolean
  indeterminate?: boolean
  onCheckedChange?: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      disabled={disabled}
      data-slot="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      onClick={onCheckedChange ? () => onCheckedChange(!checked) : undefined}
      className={cn(
        "relative inline-flex size-4 shrink-0 items-center justify-center rounded border pointer-coarse:after:absolute pointer-coarse:after:-inset-3.5 pointer-coarse:after:content-[''] transition-colors duration-150 focus-visible:ring-[3px] focus-visible:ring-[#E4EAFB] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        checked || indeterminate ? "border-[#2A5BD7] bg-[#2A5BD7] text-white" : "border-[#DEE0E3] bg-white",
        className
      )}
      {...props}
    >
      {indeterminate ? <Minus className="size-3" strokeWidth={3} /> : checked && <Check className="size-3" strokeWidth={3} />}
    </button>
  )
}

export { Checkbox }
