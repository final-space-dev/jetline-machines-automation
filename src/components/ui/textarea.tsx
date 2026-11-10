import * as React from "react"

import { cn } from "@/lib/ui/utils"

/** Multiline field, same grammar as Input (design-spec-v1 §3.2): r10,
 * #DEE0E3 border, 13px ink, line-height 1.55, vertical resize. */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full resize-y rounded-[10px] border border-[#DEE0E3] bg-white px-2.5 py-2 text-[13px] leading-[1.55] text-[#1B1D21] transition-[color,background-color,border-color,box-shadow,opacity] duration-[180ms] ease-standard outline-none placeholder:text-[#A8ADB5] hover:border-[#C8CACD] focus-visible:border-[#2A5BD7] focus-visible:ring-[3px] focus-visible:ring-[#E4EAFB] focus-visible:hover:border-[#2A5BD7] disabled:cursor-not-allowed disabled:border-[#ECEDEE] disabled:bg-[#F7F7F8] disabled:text-[#B4B8BF] aria-invalid:border-[#E5B7B2] aria-invalid:ring-[3px] aria-invalid:ring-[#FBEDEB]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
