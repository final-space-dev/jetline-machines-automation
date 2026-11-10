import * as React from "react"

import { cn } from "@/lib/ui/utils"
import { RADII, STATUS } from "@/lib/ui/ui-tokens"

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "ghost"
  | "link"

/** Spec §3.4 status chip: 12/500, 6x10 padding, chip radius (r8). */
const badgeBase = cn(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden border border-transparent px-2.5 py-1.5 text-[12px] font-medium leading-none whitespace-nowrap transition-colors duration-[180ms] ease-standard [&>svg]:pointer-events-none [&>svg]:size-3",
  RADII.chip
)

const badgeVariantClasses: Record<BadgeVariant, string> = {
  /** Signal solid */
  default: "bg-[#2A5BD7] text-white",
  /** Neutral wash */
  secondary: STATUS.neutral,
  destructive: STATUS.danger,
  /** Spec outline tag: hairline border, muted text, no fill */
  outline: "border-[#DEE0E3] bg-transparent text-[#696F79]",
  ghost: "text-[#696F79]",
  link: "text-[#2A5BD7] underline-offset-4 hover:underline",
}

function badgeVariants({
  variant = "default",
  className,
}: {
  variant?: BadgeVariant | null
  className?: string
} = {}) {
  return cn(badgeBase, badgeVariantClasses[variant ?? "default"], className)
}

/** The one blessed color pair per status meaning (STATUS token, spec §3.4).
 * Custom color classNames on Badge are a convention violation - use status. */
type BadgeStatus = "success" | "warning" | "danger" | "info" | "elim" | "neutral"

const badgeStatusClasses: Record<BadgeStatus, string> = {
  success: STATUS.success,
  warning: STATUS.warning,
  danger: STATUS.danger,
  info: STATUS.info,
  elim: STATUS.elim,
  neutral: STATUS.neutral,
}

function Badge({
  className,
  variant = "default",
  status,
  ...props
}: React.ComponentProps<"span"> & { variant?: BadgeVariant; status?: BadgeStatus }) {
  return (
    <span
      data-slot="badge"
      className={cn(
        status ? cn(badgeBase, badgeStatusClasses[status]) : badgeVariants({ variant }),
        className
      )}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
export type { BadgeVariant, BadgeStatus }
