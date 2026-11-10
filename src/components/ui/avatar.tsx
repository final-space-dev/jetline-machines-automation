import * as React from "react"

import { cn } from "@/lib/ui/utils"

/**
 * Avatar (design-spec-v1 §3.5): circle or squared monogram, initials, 600.
 * Sizes 26 / 28 / 30 / 34; tonal pairs blue, green, violet, neutral,
 * plus the dark Ink monogram square. AvatarStack overlaps 28px circles with
 * a 2px white ring and an overflow bubble.
 */
type AvatarTone = "blue" | "green" | "violet" | "neutral" | "dark"
type AvatarSize = "xs" | "sm" | "md" | "lg"

const toneClasses: Record<AvatarTone, string> = {
  blue: "bg-[#E4EAFB] text-[#2A5BD7]",
  green: "bg-[#E9F4EF] text-[#17795B]",
  violet: "bg-[#F1EDFB] text-[#553BAE]",
  neutral: "bg-[#F4F4F5] text-[#696F79]",
  dark: "bg-[#1B1D21] text-white",
}

const sizeClasses: Record<AvatarSize, string> = {
  /** 26px - sidebar/user rows */
  xs: "size-[26px] text-[10.5px]",
  /** 28px - stacked header avatars */
  sm: "size-7 text-[11px]",
  /** 30px - monogram tiles, feed actors */
  md: "size-[30px] text-[11px]",
  /** 34px - review queue, record headers */
  lg: "size-[34px] text-[11.5px]",
}

/** Squared-variant radii per size (30px tiles r9, 34px r11). */
const squareRadiusClasses: Record<AvatarSize, string> = {
  xs: "rounded-lg",
  sm: "rounded-lg",
  md: "rounded-[9px]",
  lg: "rounded-[11px]",
}

const HASH_TONES: readonly AvatarTone[] = ["blue", "green", "violet", "neutral"]

function initialsOf(name: string): string {
  const source = name.trim()
  if (!source) return "?"
  const words = source.split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

/** Deterministic tonal pair per name (same hash shape as divisionChipClass). */
function avatarTone(name: string): AvatarTone {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return HASH_TONES[h % HASH_TONES.length]
}

function Avatar({
  name,
  size = "md",
  tone,
  square = false,
  className,
  ...props
}: React.ComponentProps<"span"> & {
  name: string
  size?: AvatarSize
  tone?: AvatarTone
  square?: boolean
}) {
  return (
    <span
      data-slot="avatar"
      title={name}
      className={cn(
        "flex shrink-0 select-none items-center justify-center font-semibold tracking-wide",
        sizeClasses[size],
        square ? squareRadiusClasses[size] : "rounded-full",
        toneClasses[tone ?? avatarTone(name)],
        tone === "dark" && "font-bold",
        className
      )}
      {...props}
    >
      {initialsOf(name)}
    </span>
  )
}

function AvatarStack({
  names,
  max = 4,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  names: string[]
  max?: number
}) {
  const shown = names.slice(0, max)
  const overflow = names.length - shown.length
  return (
    <div
      data-slot="avatar-stack"
      className={cn("flex items-center", className)}
      {...props}
    >
      {shown.map((name, i) => (
        <Avatar
          key={`${name}-${i}`}
          name={name}
          size="sm"
          className={cn("border-2 border-white", i > 0 && "-ml-2")}
        />
      ))}
      {overflow > 0 && (
        <span
          data-slot="avatar-overflow"
          className="-ml-2 flex size-7 shrink-0 select-none items-center justify-center rounded-full border-2 border-white bg-[#F4F4F5] text-[11px] font-semibold text-[#696F79]"
        >
          +{overflow}
        </span>
      )}
    </div>
  )
}

export { Avatar, AvatarStack }
export type { AvatarTone, AvatarSize }
