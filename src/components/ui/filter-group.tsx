import * as React from "react"
import { cn } from "@/lib/ui/utils"
import { TYPE } from "@/lib/ui/ui-tokens"

/** A labeled filter group (design-spec-v1 §4 Reports blueprint): sentence-case
 * 11.5/500 muted label above its control cluster - never uppercase, never a
 * floating border tag. Wrap every labeled toolbar group in this. */
export function FilterGroup({ label, className, children }: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <span className={cn("inline-flex flex-col items-start", className)}>
      <span className={cn("mb-[7px] leading-none whitespace-nowrap", TYPE.label)}>
        {label}
      </span>
      <span className="inline-flex items-center gap-2">{children}</span>
    </span>
  )
}
