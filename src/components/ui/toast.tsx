"use client"

import * as React from "react"
import { Check, Info, X } from "lucide-react"

import { cn } from "@/lib/ui/utils"
import { SHADOWS } from "@/lib/ui/ui-tokens"

/**
 * Action confirmations ("Aligned 3 names", "Journal EJ-014 created") slide in
 * bottom-right and dismiss themselves. Success messages stop living in ad-hoc
 * header strips. Errors stay inline where the work happens (R13) - toasts are
 * for confirmations only.
 *
 * Spec §3.13: dark toast (#1B1D21, r14, toastIn), stack bottom-right 26px,
 * max 3 concurrent, auto-dismiss 5200ms.
 */

interface ToastItem {
  id: number
  message: React.ReactNode
  kind: "success" | "info"
}

const ToastContext = React.createContext<{ toast: (message: React.ReactNode, kind?: "success" | "info") => void }>({
  toast: () => {},
})

export function useToast() {
  return React.useContext(ToastContext)
}

let nextId = 1

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([])

  const toast = React.useCallback((message: React.ReactNode, kind: "success" | "info" = "success") => {
    const id = nextId++
    setItems((list) => [...list, { id, message, kind }])
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 5200)
  }, [])

  const ctx = React.useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div data-ui="front" className="pointer-events-none fixed right-[26px] bottom-[26px] z-[95] flex flex-col items-end gap-2.5 print:hidden">
        {items.slice(-3).map((t) => (
          <div
            key={t.id}
            style={{ boxShadow: SHADOWS.toast }}
            className="animate-toast-in pointer-events-auto flex w-[344px] max-w-[calc(100vw-52px)] items-start gap-3 rounded-[14px] bg-[#1B1D21] py-3.5 pr-[15px] pl-[15px] text-white"
          >
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-white",
                t.kind === "success" ? "bg-[#17795B]" : "bg-[#2A5BD7]"
              )}
            >
              {t.kind === "success" ? (
                <Check className="size-3" strokeWidth={3} />
              ) : (
                <Info className="size-3" strokeWidth={2.5} />
              )}
            </span>
            <span className="min-w-0 flex-1 pt-0.5 text-[13px] leading-[1.55] font-semibold text-white">
              {t.message}
            </span>
            <button
              type="button"
              onClick={() => setItems((list) => list.filter((x) => x.id !== t.id))}
              className="mt-0.5 rounded-md p-0.5 text-[#7C8189] transition-colors duration-[180ms] ease-standard hover:text-white"
              aria-label="Dismiss"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
