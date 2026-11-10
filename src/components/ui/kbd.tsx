import * as React from "react"

import { cn } from "@/lib/ui/utils"

/** Keyboard shortcut hint (spec §3.4 kbd chip): <Kbd>⌘K</Kbd> */
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-md border border-[#DEE0E3] border-b-2 bg-[#FCFCFD] px-[7px] py-[3px] font-sans text-[11px] font-medium text-[#696F79]",
        className
      )}
      {...props}
    />
  )
}

export { Kbd }
