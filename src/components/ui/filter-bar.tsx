import * as React from "react"

import { cn } from "@/lib/ui/utils"

/**
 * FilterBar - the standard toolbar arrangement (R36), dressed as the spec's
 * toolbar card (design-spec-v1 §3.9): #FCFCFD inset card, #EEEFF0 hairline,
 * r14, 12/14px padding, 10px gaps, wrapping rows aligned to control baselines.
 * Pages pass FilterGroups and Segmented controls; anything after
 * <FilterBarSpacer /> pushes right.
 */

export function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex w-full flex-wrap items-end gap-2.5 rounded-[14px] border border-[#EEEFF0] bg-[#FCFCFD] px-3.5 py-3",
        className
      )}
    >
      {children}
    </div>
  )
}

export function FilterBarRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex w-full flex-wrap items-end gap-2.5", className)}>{children}</div>
}

export function FilterBarSpacer() {
  return <span className="flex-1" />
}
