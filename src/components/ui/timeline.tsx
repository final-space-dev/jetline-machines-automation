import * as React from "react"

import { cn } from "@/lib/ui/utils"

/**
 * Activity timeline (design-spec-v1 §3.8): 22px left gutter with a 9px tone
 * dot over a 1px hairline rail (hidden on the last item), content 12.5px
 * with the date 11px Faint underneath.
 */
type TimelineTone = "success" | "action" | "system" | "flag"

const toneDotClasses: Record<TimelineTone, string> = {
  /** Things that completed or proved out */
  success: "bg-[#17795B]",
  /** Human actions (notes, journals, edits) */
  action: "bg-[#2A5BD7]",
  /** System events */
  system: "bg-[#C2C4C8]",
  /** Flags and failures */
  flag: "bg-[#BA433A]",
}

function Timeline({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="timeline"
      className={cn(
        "[&>[data-slot=timeline-item]:last-child_[data-slot=timeline-line]]:hidden",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function TimelineItem({
  tone = "system",
  date,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  tone?: TimelineTone
  date?: React.ReactNode
}) {
  return (
    <div
      data-slot="timeline-item"
      className={cn("flex", className)}
      {...props}
    >
      <div aria-hidden className="flex w-[22px] shrink-0 flex-col items-center">
        <span
          data-slot="timeline-dot"
          className={cn("mt-[5px] size-[9px] shrink-0 rounded-full", toneDotClasses[tone])}
        />
        <span data-slot="timeline-line" className="my-1 w-px flex-1 bg-[#ECEDEE]" />
      </div>
      <div className="min-w-0 flex-1 pb-4 pl-2.5">
        <div className="text-[12.5px] leading-relaxed text-[#3A3F47]">{children}</div>
        {date != null && (
          <div className="mt-[3px] text-[11px] text-[#696F79]">{date}</div>
        )}
      </div>
    </div>
  )
}

export { Timeline, TimelineItem }
export type { TimelineTone }
