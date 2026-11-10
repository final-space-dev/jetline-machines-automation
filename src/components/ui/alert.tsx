import * as React from "react"

import { cn } from "@/lib/ui/utils"

/** Spec §3.12 - the five alert tones (bg / bd / fg / sub from §1.3).
 * `default` maps to the info tone and `destructive` to danger so existing
 * consumers keep working unchanged. */
type AlertVariant =
  | "default"
  | "destructive"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "signal"

const toneInfo =
  "border-[#E8E9EB] bg-[#F7F7F8] text-[#1B1D21] [&_[data-slot=alert-description]]:text-[#6E747E]"
const toneSuccess =
  "border-[#D3E8DC] bg-[#F1F8F4] text-[#124A38] [&_[data-slot=alert-description]]:text-[#3E6E5C]"
const toneWarning =
  "border-[#E8E9EB] bg-[#F7F7F8] text-[#6E4507] [&_[data-slot=alert-description]]:text-[#7C5B25]"
const toneDanger =
  "border-[#EFD1CD] bg-[#FCEFED] text-[#8F2F28] [&_[data-slot=alert-description]]:text-[#94534C]"
const toneSignal =
  "border-[#D5E0F8] bg-[#F3F6FE] text-[#1E3F8F] [&_[data-slot=alert-description]]:text-[#41579B]"

const alertVariantClasses: Record<AlertVariant, string> = {
  default: toneInfo,
  info: toneInfo,
  success: toneSuccess,
  warning: toneWarning,
  destructive: toneDanger,
  danger: toneDanger,
  signal: toneSignal,
}

function Alert({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & { variant?: AlertVariant }) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(
        "relative grid w-full gap-0.5 rounded-xl border px-3.5 py-[13px] text-left text-[13px] has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-[11px] *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
        alertVariantClasses[variant],
        className
      )}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("text-[13px] leading-[1.45] font-semibold", className)}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("mt-0.5 text-[12.5px] leading-[1.6]", className)}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("absolute top-3 right-3", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
