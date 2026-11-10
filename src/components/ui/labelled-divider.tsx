import * as React from "react"

import { cn } from "@/lib/ui/utils"
import { TYPE } from "@/lib/ui/ui-tokens"

/**
 * Labelled divider (design-spec-v1 §3.9): hairline rules flanking an
 * uppercase micro label, 12px gaps.
 */
function LabelledDivider({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="labelled-divider"
      role="separator"
      className={cn("flex items-center gap-3", className)}
      {...props}
    >
      <span aria-hidden className="h-px flex-1 bg-[#E8E9EB]" />
      <span className={TYPE.microLabel}>{children}</span>
      <span aria-hidden className="h-px flex-1 bg-[#E8E9EB]" />
    </div>
  )
}

export { LabelledDivider }
