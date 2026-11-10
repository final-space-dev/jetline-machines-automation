"use client"

import * as React from "react"

import { cn } from "@/lib/ui/utils"
import { RADII } from "@/lib/ui/ui-tokens"

type ButtonVariant =
  | "default"
  | "outline"
  | "secondary"
  | "ghost"
  | "destructive"
  | "link"
  | "excel"

type ButtonSize =
  | "default"
  | "xs"
  | "sm"
  | "lg"
  | "icon"
  | "icon-xs"
  | "icon-sm"
  | "icon-lg"

/** Spec §3.1: weight 500, transition all .2s ease, hover lift, spec focus ring;
 * disabled = #F7F7F8 / #B4B8BF inside an #ECEDEE inset ring (no layout shift). */
const baseClasses =
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-all duration-200 ease-standard outline-none select-none focus-visible:ring-[3px] focus-visible:ring-[#E4EAFB] disabled:pointer-events-none disabled:bg-[#F7F7F8] disabled:text-[#B4B8BF] disabled:shadow-none disabled:ring-1 disabled:ring-inset disabled:ring-[#ECEDEE] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

const variantClasses: Record<ButtonVariant, string> = {
  // Primary: Signal blue, rest/hover shadows per spec §1.5.
  default:
    "bg-[#2A5BD7] text-white shadow-[0_1px_2px_rgba(42,91,215,.3)] hover:bg-[#1E44A8] hover:-translate-y-px hover:shadow-[0_8px_20px_rgba(42,91,215,.24)]",
  // Secondary (spec "Secondary"): hairline control border on paper.
  outline:
    "border border-[#DEE0E3] bg-white text-[#3A3F47] hover:border-[#C8CACD] hover:bg-[#F7F7F8] hover:-translate-y-px",
  // Subtle (spec "Subtle"): warm tint fill.
  secondary:
    "bg-[#F1F2F3] text-[#3A3F47] hover:bg-[#E4E6E8] hover:-translate-y-px",
  // Ghost: Signal text, wash tint on hover (tints instead of lifting).
  ghost: "text-[#2A5BD7] hover:bg-[#EEF2FE]",
  // Destructive outline (spec "Reverse" grammar).
  destructive:
    "border border-[#F0D5D2] bg-white text-[#B03E36] hover:border-[#E5B7B2] hover:bg-[#FBEDEB] focus-visible:ring-[#FBEDEB]",
  // USER HARD RULE: the Excel button stays green - spec geometry only.
  excel:
    "bg-[#107C41] text-white shadow-[0_1px_2px_rgba(16,124,65,.3)] hover:bg-[#0E6A37] hover:-translate-y-px hover:shadow-[0_8px_20px_rgba(16,124,65,.22)] focus-visible:ring-[#DCEDE4]",
  link: "text-[#2A5BD7] underline-offset-4 hover:text-[#1E44A8] hover:underline",
}

/** Spec sizes: small 12/6x11/r8 · medium 13/10x15/r10 · large 14/13x19/r12;
 * icon button 36x36 r10. Radius rides the size (spec §1.4). */
const sizeClasses: Record<ButtonSize, string> = {
  // `pointer-coarse` is a finger: 44 px there, the spec's sizes under a mouse.
  default: `${RADII.button} px-[15px] py-2.5 text-[13px] pointer-coarse:min-h-11`,
  xs: `${RADII.chip} px-2.5 py-[5px] text-[12px] pointer-coarse:min-h-11 [&_svg:not([class*='size-'])]:size-3`,
  sm: `${RADII.chip} px-[11px] py-1.5 text-[12px] pointer-coarse:min-h-11 [&_svg:not([class*='size-'])]:size-3.5`,
  lg: "rounded-xl px-[19px] py-[13px] text-[14px] pointer-coarse:min-h-11",
  icon: `${RADII.button} size-9 pointer-coarse:size-11`,
  "icon-xs": `${RADII.chip} size-6 pointer-coarse:size-11 [&_svg:not([class*='size-'])]:size-3`,
  "icon-sm": `${RADII.control} size-7 pointer-coarse:size-11 [&_svg:not([class*='size-'])]:size-3.5`,
  "icon-lg": "rounded-xl size-10 pointer-coarse:size-11",
}

function buttonVariants({
  variant = "default",
  size = "default",
  className,
}: {
  variant?: ButtonVariant | null
  size?: ButtonSize | null
  className?: string
} = {}) {
  return cn(
    baseClasses,
    variantClasses[variant ?? "default"],
    sizeClasses[size ?? "default"],
    className
  )
}

type ButtonProps = React.ComponentProps<"button"> & {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Render a custom element (e.g. an anchor) carrying the button styles. */
  render?: React.ReactElement
  /** Compatibility flag: set false when `render` is not a native button. Accepted and ignored. */
  nativeButton?: boolean
}

function Button({
  className,
  variant = "default",
  size = "default",
  render,
  nativeButton: _nativeButton,
  children,
  type,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className)

  if (render) {
    const el = render as React.ReactElement<Record<string, unknown>>
    return React.cloneElement(el, {
      ...props,
      "data-slot": "button",
      className: cn(classes, el.props.className as string | undefined),
      children: children ?? (el.props.children as React.ReactNode),
    })
  }

  return (
    <button
      type={type ?? "button"}
      data-slot="button"
      className={classes}
      {...props}
    >
      {children}
    </button>
  )
}

export { Button, buttonVariants }
export type { ButtonProps, ButtonVariant, ButtonSize }
