"use client"

import * as React from "react"
import {
  Dialog as HDialog,
  DialogBackdrop as HDialogBackdrop,
  DialogPanel as HDialogPanel,
  DialogTitle as HDialogTitle,
  Description as HDescription,
} from "@headlessui/react"

import { cn } from "@/lib/ui/utils"
import { RADII, SHADOWS } from "@/lib/ui/ui-tokens"
import { Button, type ButtonProps } from "@/components/ui/button"

type AlertDialogContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
}

const AlertDialogContext = React.createContext<AlertDialogContextValue>({
  open: false,
  setOpen: () => {},
})

function AlertDialog({
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
    <AlertDialogContext.Provider value={ctx}>
      {children}
    </AlertDialogContext.Provider>
  )
}

function AlertDialogTrigger({
  render,
  children,
  onClick,
  ...props
}: React.ComponentProps<"button"> & { render?: React.ReactElement }) {
  const { setOpen } = React.useContext(AlertDialogContext)
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
    <button
      type="button"
      data-slot="alert-dialog-trigger"
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  )
}

function AlertDialogPortal({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}

/** Spec §3.11 scrim: ink at .34, fadeIn .18s. */
function AlertDialogOverlay({ className }: { className?: string }) {
  return (
    <HDialogBackdrop
      transition
      data-slot="alert-dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-[#1B1D21]/[.34] transition-opacity duration-[180ms] ease-standard data-closed:opacity-0",
        className
      )}
    />
  )
}

function AlertDialogContent({
  className,
  children,
  size = "default",
  style,
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  const { open, setOpen } = React.useContext(AlertDialogContext)
  return (
    <HDialog
      open={open}
      onClose={() => setOpen(false)}
      role="alertdialog"
      data-ui="front"
      className="relative z-50"
    >
      <AlertDialogOverlay />
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
        <HDialogPanel
          transition
          data-slot="alert-dialog-content"
          data-size={size}
          style={{ boxShadow: SHADOWS.dialog, ...style }}
          className={cn(
            // Spec §3.11 Popup: 460px card, r20, dialog shadow, popIn entrance.
            "relative grid w-full gap-4 bg-white px-[26px] pt-6 pb-[26px] text-[#1B1D21] transition duration-[220ms] ease-bubble outline-none data-closed:translate-y-2.5 data-closed:scale-[.985] data-closed:opacity-0",
            RADII.overlay,
            size === "sm" ? "max-w-[380px]" : "max-w-[460px]",
            className
          )}
          {...props}
        >
          {children}
        </HDialogPanel>
      </div>
    </HDialog>
  )
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("flex flex-col gap-1.5 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "-mx-[26px] -mb-[26px] flex flex-col-reverse gap-2.5 rounded-b-[20px] border-t border-[#F1F1F2] bg-[#FCFCFD] px-[26px] pt-4 pb-5 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

/** Tone icon square (spec Popup header): 34px, r11, wash bg + tone fg.
 * Neutral by default; pass tone washes via className (e.g. STATUS pairs). */
function AlertDialogMedia({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-media"
      className={cn(
        "mb-2 inline-flex size-[34px] items-center justify-center rounded-[11px] bg-[#F1F2F3] text-[#6E747E] *:[svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<"h2">) {
  return (
    <HDialogTitle
      data-slot="alert-dialog-title"
      className={cn(
        "text-[16.5px] leading-[1.35] font-semibold tracking-[-0.01em] text-[#1B1D21]",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <HDescription
      data-slot="alert-dialog-description"
      className={cn("text-[13px] leading-[1.6] text-[#6E747E]", className)}
      {...props}
    />
  )
}

function AlertDialogAction({ className, ...props }: ButtonProps) {
  return (
    <Button
      data-slot="alert-dialog-action"
      className={cn(className)}
      {...props}
    />
  )
}

function AlertDialogCancel({
  className,
  variant = "outline",
  size = "default",
  onClick,
  ...props
}: ButtonProps) {
  const { setOpen } = React.useContext(AlertDialogContext)
  return (
    <Button
      data-slot="alert-dialog-cancel"
      variant={variant}
      size={size}
      className={cn(className)}
      onClick={(e) => {
        onClick?.(e)
        if (!e.defaultPrevented) setOpen(false)
      }}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
}
