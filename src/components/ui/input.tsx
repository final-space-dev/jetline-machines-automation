import * as React from "react"

import { cn } from "@/lib/ui/utils"

/** The one text field (design-spec-v1 §3.2): r10, #DEE0E3 border, 13px ink,
 * #A8ADB5 placeholder, focus = Signal border + 3px #E4EAFB ring. */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-[10px] border border-[#DEE0E3] bg-white px-2.5 py-1 text-[13px] text-[#1B1D21] transition-[color,background-color,border-color,box-shadow,opacity] duration-[180ms] ease-standard outline-none placeholder:text-[#A8ADB5] file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-[12.5px] file:font-medium file:text-[#1B1D21] hover:border-[#C8CACD] focus-visible:border-[#2A5BD7] focus-visible:ring-[3px] focus-visible:ring-[#E4EAFB] focus-visible:hover:border-[#2A5BD7] disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-[#ECEDEE] disabled:bg-[#F7F7F8] disabled:text-[#B4B8BF] aria-invalid:border-[#E5B7B2] aria-invalid:ring-[3px] aria-invalid:ring-[#FBEDEB]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
