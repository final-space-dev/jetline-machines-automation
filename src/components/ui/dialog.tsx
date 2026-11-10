"use client"

import * as React from "react"
import {
  Dialog as HDialog,
  DialogBackdrop as HDialogBackdrop,
  DialogPanel as HDialogPanel,
  DialogTitle as HDialogTitle,
  Description as HDescription,
} from "@headlessui/react"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/ui/utils"
import { RADII, SHADOWS } from "@/lib/ui/ui-tokens"

type DialogContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
}

const DialogContext = React.createContext<DialogContextValue>({
  open: false,
  setOpen: () => {},
})

function Dialog({
  open = false,
  onOpenChange,
  children,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}) {
  const setOpen = React.useCallback(
    (o: boolean) => onOpenChange?.(o),
    [onOpenChange]
  )
  const ctx = React.useMemo(() => ({ open, setOpen }), [open, setOpen])
  return (
    <DialogContext.Provider value={ctx}>{children}</DialogContext.Provider>
  )
}

function DialogTrigger({
  render,
  children,
  onClick,
  ...props
}: React.ComponentProps<"button"> & { render?: React.ReactElement }) {
  const { setOpen } = React.useContext(DialogContext)
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e)
    if (!e.defaultPrevented) setOpen(true)
  }
  if (render) {
    const el = render as React.ReactElement<Record<string, unknown>>
    return React.cloneElement(el, {
      ...props,
      onClick: handleClick,
      children: children ?? (el.props.children as React.ReactNode),
    })
  }
  return (
    <button type="button" data-slot="dialog-trigger" onClick={handleClick} {...props}>
      {children}
    </button>
  )
}

function DialogPortal({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}

function DialogClose({
  render,
  children,
  onClick,
  ...props
}: React.ComponentProps<"button"> & { render?: React.ReactElement }) {
  const { setOpen } = React.useContext(DialogContext)
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e)
    if (!e.defaultPrevented) setOpen(false)
  }
  if (render) {
    const el = render as React.ReactElement<Record<string, unknown>>
    return React.cloneElement(el, {
      ...props,
      onClick: handleClick,
      children: children ?? (el.props.children as React.ReactNode),
    })
  }
  return (
    <button type="button" data-slot="dialog-close" onClick={handleClick} {...props}>
      {children}
    </button>
  )
}

/** Spec §3.11 scrim: ink at .34, fadeIn .18s. */
function DialogOverlay({ className }: { className?: string }) {
  return (
    <HDialogBackdrop
      transition
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-[#1B1D21]/[.34] transition-opacity duration-[180ms] ease-standard data-closed:opacity-0",
        className
      )}
    />
  )
}

/** The three dialog sizes (UI/UX 2.0): confirm (small yes/no), form (one
 * focused task), workspace (the user works IN it - R27). Ad-hoc width
 * classNames are a convention violation once a size fits. */
const dialogSizeClasses = {
  confirm: "sm:max-w-[460px]",
  form: "sm:max-w-[560px]",
  workspace: "flex w-[70vw] min-h-[60vh] max-h-[85vh] flex-col sm:max-w-[70vw]",
} as const

function DialogContent({
  className,
  children,
  showCloseButton = true,
  size,
  style,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
  size?: keyof typeof dialogSizeClasses
}) {
  const { open, setOpen } = React.useContext(DialogContext)
  return (
    <HDialog
      open={open}
      onClose={() => setOpen(false)}
      data-ui="front"
      className="relative z-50"
    >
      <DialogOverlay />
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
        <HDialogPanel
          transition
          data-slot="dialog-content"
          style={{ boxShadow: SHADOWS.dialog, ...style }}
          className={cn(
            // Spec §3.11 working dialog: r20, dialog shadow, popIn entrance.
            "relative grid w-full max-w-[calc(100%-2rem)] gap-4 bg-white px-[26px] pt-6 pb-[26px] text-[13.5px] text-[#1B1D21] transition duration-[220ms] ease-bubble outline-none data-closed:translate-y-2.5 data-closed:scale-[.985] data-closed:opacity-0 sm:max-w-[520px]",
            RADII.overlay,
            size && dialogSizeClasses[size],
            className
          )}
          {...props}
        >
          {children}
          {showCloseButton && (
            <button
              type="button"
              data-slot="dialog-close"
              onClick={() => setOpen(false)}
              className="absolute top-[18px] right-[18px] inline-flex size-7 items-center justify-center rounded-[9px] pointer-coarse:after:absolute pointer-coarse:after:-inset-2 pointer-coarse:after:content-[''] bg-[#F1F2F3] text-[#696F79] transition-colors duration-[180ms] ease-standard outline-none hover:bg-[#E4E6E8] hover:text-[#3A3F47] focus-visible:ring-[3px] focus-visible:ring-[#E4EAFB]"
            >
              <XIcon className="size-3.5" />
              <span className="sr-only">Close</span>
            </button>
          )}
        </HDialogPanel>
      </div>
    </HDialog>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "-mx-[26px] flex flex-col gap-1.5 border-b border-[#F1F1F2] px-[26px] pr-14 pb-[18px]",
        className
      )}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & { showCloseButton?: boolean }) {
  const { setOpen } = React.useContext(DialogContext)
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-[26px] -mb-[26px] flex flex-col-reverse gap-2.5 rounded-b-[20px] border-t border-[#F1F1F2] bg-[#FCFCFD] px-[26px] pt-4 pb-5 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex items-center justify-center rounded-[10px] border border-[#DEE0E3] bg-white px-[15px] py-2.5 text-[13px] font-medium text-[#3A3F47] transition-all duration-200 ease-standard outline-none hover:border-[#C8CACD] hover:bg-[#F7F7F8] focus-visible:ring-[3px] focus-visible:ring-[#E4EAFB]"
        >
          Close
        </button>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<"h2">) {
  return (
    <HDialogTitle
      data-slot="dialog-title"
      className={cn(
        "text-[17px] leading-snug font-semibold tracking-[-0.01em] text-[#1B1D21]",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <HDescription
      data-slot="dialog-description"
      className={cn("text-[12.5px] leading-[1.6] text-[#696F79]", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
