import * as React from "react"

import { cn } from "@/lib/ui/utils"
import { RADII } from "@/lib/ui/ui-tokens"

/**
 * Loading shimmer (spec §3.8): warm gradient sweeping via the shimmer
 * keyframe. Two shapes:
 *   - "line" (default): a 12px text bar, r6 - vary widths via className
 *     (spec suggests 78/56/66% stacks with 9px gaps).
 *   - "block": a card/tile placeholder, r14 - size via className.
 */
type SkeletonVariant = "line" | "block"

function Skeleton({
  variant = "line",
  className,
  ...props
}: React.ComponentProps<"div"> & { variant?: SkeletonVariant }) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        "animate-shimmer bg-[linear-gradient(90deg,#F1F2F3_0%,#F6F6F7_40%,#F1F2F3_80%)] bg-[length:320px_100%]",
        variant === "line" ? "h-3 rounded-md" : cn("h-24", RADII.card),
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
export type { SkeletonVariant }
