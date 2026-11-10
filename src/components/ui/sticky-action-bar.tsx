import * as React from "react"

import { cn } from "@/lib/ui/utils"
import { SHADOWS } from "@/lib/ui/ui-tokens"

/**
 * Sticky action bar (design-spec-v1 §3.9): the selection bar - r14 white
 * card with the sticky-bar shadow, summary ("3 rows selected", count 600)
 * on the left and toolbar-size actions on the right.
 */
function StickyActionBar({
  summary,
  sticky = true,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  /** Left-side summary, e.g. <><b>3</b> rows selected</>. */
  summary?: React.ReactNode
  /** Pins the bar to the bottom of its scroll container. */
  sticky?: boolean
}) {
  return (
    <div
      data-slot="sticky-action-bar"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#DEE0E3] bg-white px-4 py-3",
        sticky && "sticky bottom-4 z-30",
        className
      )}
      style={{ boxShadow: SHADOWS.stickyBar }}
      {...props}
    >
      <div className="text-[12.5px] text-[#3A3F47] [&_b]:font-semibold [&_strong]:font-semibold">
        {summary}
      </div>
      <div className="flex items-center gap-2.5">{children}</div>
    </div>
  )
}

export { StickyActionBar }
