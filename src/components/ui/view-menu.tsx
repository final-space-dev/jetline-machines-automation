"use client"

import * as React from "react"
import { ChevronDown, SlidersHorizontal } from "lucide-react"

import { cn } from "@/lib/ui/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

/**
 * View settings behind one button (UI/UX 2.0): the frequent controls stay in
 * the toolbar, configuration folds into this popover. The trigger summarizes
 * the current state so nothing is hidden, only tidied.
 *
 *   <ViewMenu summary="Month columns · Full year · Collapsed">
 *     <ViewMenuSection label="Columns">...</ViewMenuSection>
 *   </ViewMenu>
 */
function ViewMenu({
  summary,
  children,
  className,
}: {
  summary: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none",
          className
        )}
      >
        <SlidersHorizontal className="size-3.5 text-[#696F79]" />
        View
        <span className="max-w-64 truncate font-normal text-[#696F79]">{summary}</span>
        <ChevronDown className="size-3.5 text-[#696F79]" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <div className="flex flex-col gap-3">{children}</div>
      </PopoverContent>
    </Popover>
  )
}

function ViewMenuSection({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] font-medium tracking-wide text-[#696F79] uppercase">{label}</p>
      {children}
    </div>
  )
}

export { ViewMenu, ViewMenuSection }
