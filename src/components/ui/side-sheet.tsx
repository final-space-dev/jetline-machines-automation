"use client"

import * as React from "react"
import {
  Dialog as HDialog,
  DialogPanel as HDialogPanel,
  DialogTitle as HDialogTitle,
} from "@headlessui/react"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/ui/utils"
import { SHADOWS } from "@/lib/ui/ui-tokens"

/**
 * Side sheet / drawer (design-spec-v1 §3.11): right-anchored 420px panel on
 * a fading scrim, sheetIn entrance, sheet shadow; header with title 16/600 +
 * subtle close square, scrollable body, optional footer of flex-1 actions.
 * Escape and click-outside close.
 */
function SideSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  footer,
  width = 420,
  className,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Footer actions; each button typically gets flex-1. */
  footer?: React.ReactNode
  width?: number
  className?: string
  children?: React.ReactNode
}) {
  return (
    <HDialog open={open} onClose={() => onOpenChange(false)} data-ui="front" className="relative z-50">
      <div
        aria-hidden
        data-slot="side-sheet-overlay"
        className="fixed inset-0 animate-fade-in bg-[#1B1D21]/30"
      />
      <div className="fixed inset-0 flex justify-end">
        <HDialogPanel
          data-slot="side-sheet"
          className={cn("flex h-full max-w-full animate-sheet-in flex-col bg-white", className)}
          style={{ width, boxShadow: SHADOWS.sheet }}
        >
          <div
            data-slot="side-sheet-header"
            className="flex items-start justify-between gap-3 border-b border-[#F1F1F2] px-6 pt-[22px] pb-4"
          >
            <div className="min-w-0">
              <HDialogTitle className="text-base font-semibold text-[#1B1D21]">
                {title}
              </HDialogTitle>
              {subtitle != null && (
                <p className="mt-1 text-[12.5px] text-[#696F79]">{subtitle}</p>
              )}
            </div>
            <button
              type="button"
              data-slot="side-sheet-close"
              onClick={() => onOpenChange(false)}
              className="flex size-[30px] shrink-0 items-center justify-center rounded-[9px] bg-[#F1F2F3] text-[#696F79] transition-colors duration-[180ms] ease-standard hover:bg-[#E4E6E8]"
            >
              <XIcon className="size-3.5" />
              <span className="sr-only">Close</span>
            </button>
          </div>
          <div data-slot="side-sheet-body" className="min-h-0 flex-1 overflow-y-auto p-2">
            {children}
          </div>
          {footer && (
            <div
              data-slot="side-sheet-footer"
              className="flex items-center gap-2.5 border-t border-[#F1F1F2] px-6 pt-4 pb-5"
            >
              {footer}
            </div>
          )}
        </HDialogPanel>
      </div>
    </HDialog>
  )
}

export { SideSheet }
