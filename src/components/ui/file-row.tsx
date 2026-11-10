"use client"

import * as React from "react"

import { cn } from "@/lib/ui/utils"
import { MOTION, STATUS } from "@/lib/ui/ui-tokens"

/**
 * File rows (design-spec-v1 §3.8): r14 list card, hover-wash rows with a
 * 30px ext badge, ellipsized name 12.5/500, meta 11 Faint, and a trailing
 * status chip slot (FileChip - Parsed green, Read blue, Unassigned grey).
 */
function FileRowList({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="file-row-list"
      className={cn("rounded-[14px] border border-[#EEEFF0] bg-white p-1.5", className)}
      {...props}
    >
      {children}
    </div>
  )
}

function FileRow({
  ext,
  name,
  meta,
  chip,
  onClick,
  className,
}: {
  /** Short file-kind badge text, e.g. "PDF" or "XLS". */
  ext: string
  name: React.ReactNode
  meta?: React.ReactNode
  /** Status chip slot (compose a FileChip). */
  chip?: React.ReactNode
  onClick?: () => void
  className?: string
}) {
  const inner = (
    <>
      <span
        aria-hidden
        data-slot="file-row-ext"
        className="flex size-[30px] shrink-0 items-center justify-center rounded-[9px] bg-[#F4F4F5] text-[9.5px] font-bold tracking-wide text-[#696F79]"
      >
        {ext}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium text-[#1B1D21]">
          {name}
        </span>
        {meta != null && (
          <span className="mt-px block truncate text-[11px] text-[#696F79]">{meta}</span>
        )}
      </span>
      {chip}
    </>
  )
  const rowClasses = cn(
    "flex w-full items-center gap-[11px] rounded-[11px] p-2.5 text-left hover:bg-[#FAFAFB]",
    MOTION.settle,
    className
  )
  if (onClick) {
    return (
      <button type="button" data-slot="file-row" onClick={onClick} className={cn(rowClasses, "cursor-pointer")}>
        {inner}
      </button>
    )
  }
  return (
    <div data-slot="file-row" className={rowClasses}>
      {inner}
    </div>
  )
}

type FileChipTone = keyof typeof STATUS

function FileChip({
  tone = "neutral",
  className,
  children,
  ...props
}: React.ComponentProps<"span"> & { tone?: FileChipTone }) {
  return (
    <span
      data-slot="file-chip"
      className={cn(
        "shrink-0 rounded-[7px] px-2 py-1 text-[11px] font-medium whitespace-nowrap",
        STATUS[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}

export { FileRowList, FileRow, FileChip }
export type { FileChipTone }
