import * as React from "react"

import { cn } from "@/lib/ui/utils"
import { geist, jakarta } from "@/lib/ui/fonts"

/**
 * The front-end surface: every front component renders inside one of these.
 * data-ui="front" swaps Archon's tokens for JetlineConsol's (globals.css),
 * forces light, and sets Plus Jakarta Sans; Archon's own look outside it is
 * untouched. The portaled pieces (dialogs, popovers, tooltips, lists, toasts)
 * carry data-ui="front" themselves, so the font variables are declared on the
 * attribute rather than on this element alone.
 */
function FrontScope({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <>
      <style href="front-ui-fonts" precedence="default">
        {`[data-ui="front"]{--font-jakarta:${jakarta.style.fontFamily};--font-geist:${geist.style.fontFamily}}`}
      </style>
      <div
        data-ui="front"
        data-slot="front-scope"
        className={cn(jakarta.variable, geist.variable, "bg-background text-foreground", className)}
        {...props}
      >
        {children}
      </div>
    </>
  )
}

export { FrontScope }
