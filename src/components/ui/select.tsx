"use client"

import * as React from "react"
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/react"
import { CheckIcon, ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/ui/utils"

function Select({
  value,
  onValueChange,
  disabled,
  children,
}: {
  value?: string | null
  onValueChange?: (value: string | null) => void
  disabled?: boolean
  children?: React.ReactNode
}) {
  return (
    <Listbox
      value={value ?? null}
      onChange={(v: string | null) => onValueChange?.(v)}
      disabled={disabled}
    >
      {children}
    </Listbox>
  )
}

function SelectGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="select-group"
      className={cn("p-1", className)}
      {...props}
    />
  )
}

function SelectValue({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="select-value"
      className={cn("flex flex-1 truncate text-left", className)}
      {...props}
    />
  )
}

/** Select trigger (design-spec-v1 §3.2): same box as Input - r10, #DEE0E3
 * border, 13px value, #B4B8BF caret, hover border #C8CACD, focus ring #E4EAFB. */
function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<"button"> & { size?: "sm" | "default" }) {
  return (
    <ListboxButton
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex w-fit items-center justify-between gap-1.5 rounded-[10px] border border-[#DEE0E3] bg-white px-2.5 text-[13px] whitespace-nowrap text-[#1B1D21] transition-[color,background-color,border-color,box-shadow,opacity] duration-[180ms] ease-standard outline-none select-none hover:border-[#C8CACD] focus-visible:border-[#2A5BD7] focus-visible:ring-[3px] focus-visible:ring-[#E4EAFB] data-open:border-[#2A5BD7] data-open:ring-[3px] data-open:ring-[#E4EAFB] disabled:cursor-not-allowed disabled:border-[#ECEDEE] disabled:bg-[#F7F7F8] disabled:text-[#B4B8BF]",
        size === "sm" ? "h-7 text-[12.5px] pointer-coarse:h-11" : "h-8 pointer-coarse:h-11",
        className
      )}
      {...props}
    >
      <span className="flex flex-1 items-center gap-1.5 truncate text-left">
        {children}
      </span>
      <ChevronDownIcon className="pointer-events-none size-3.5 shrink-0 text-[#B4B8BF]" />
    </ListboxButton>
  )
}

/** Dropdown list (design-spec-v1 §3.2 multi-select panel): r12, #EEEFF0
 * border, floating shadow, popIn entrance. */
function SelectContent({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <ListboxOptions
      transition
      anchor={{ to: "bottom start", gap: 6 }}
      data-ui="front"
      data-slot="select-content"
      className={cn(
        "z-50 origin-top max-h-64 min-w-(--button-width) overflow-y-auto rounded-[12px] border border-[#EEEFF0] bg-white p-1.5 text-[#1B1D21] shadow-[0_12px_30px_rgba(28,25,23,0.1)] outline-none transition duration-150 ease-bubble data-closed:scale-95 data-closed:opacity-0",
        className
      )}
      {...props}
    >
      {children}
    </ListboxOptions>
  )
}

function SelectLabel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="select-label"
      className={cn("px-2.5 py-1 text-[11px] font-medium text-[#696F79]", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  value,
  disabled,
}: {
  className?: string
  children?: React.ReactNode
  value: string
  disabled?: boolean
}) {
  return (
    <ListboxOption
      value={value}
      disabled={disabled}
      data-slot="select-item"
      className={cn(
        "flex w-full cursor-default items-center gap-2 rounded-[9px] px-2.5 py-1.5 pointer-coarse:min-h-11 text-[13px] text-[#3A3F47] select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-focus:bg-[#F4F4F5] data-focus:text-[#1B1D21]",
        className
      )}
    >
      {({ selected }: { selected: boolean }) => (
        <>
          <span className="flex flex-1 items-center gap-2 truncate">
            {children}
          </span>
          {selected && <CheckIcon className="size-3.5 shrink-0 text-[#2A5BD7]" />}
        </>
      )}
    </ListboxOption>
  )
}

function SelectSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="select-separator"
      className={cn("pointer-events-none my-1 h-px bg-[#F1F1F2]", className)}
      {...props}
    />
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
