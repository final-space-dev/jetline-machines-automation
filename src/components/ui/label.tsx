"use client"

import * as React from "react"

import { cn } from "@/lib/ui/utils"
import { TYPE } from "@/lib/ui/ui-tokens"

/** Field label (design-spec-v1 §3.2): 11.5/500 muted, sentence case -
 * never uppercase. Callers own the 7px label-to-control gap. */
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 leading-none select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        TYPE.label,
        className
      )}
      {...props}
    />
  )
}

export { Label }
