import * as React from "react"
import Link from "next/link"

import { cn } from "@/lib/ui/utils"
import { MOTION } from "@/lib/ui/ui-tokens"

/**
 * Breadcrumbs (design-spec-v1 §3.10). Page variant 12.5px, header variant
 * 11.5px; links Faint hover Signal, "/" separators, current crumb 500.
 */
type Crumb = { label: string; href?: string }

function Breadcrumbs({
  items,
  variant = "page",
  className,
}: {
  items: Crumb[]
  variant?: "page" | "header"
  className?: string
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      data-slot="breadcrumbs"
      className={cn(
        "flex flex-wrap items-center gap-2",
        variant === "header" ? "text-[11.5px]" : "text-[12.5px]",
        className
      )}
    >
      {items.map((item, i) => {
        const last = i === items.length - 1
        return (
          <React.Fragment key={`${item.label}-${i}`}>
            {i > 0 && (
              <span aria-hidden className="text-[#C8CACD]">
                /
              </span>
            )}
            {last ? (
              <span
                aria-current="page"
                className={cn(
                  "font-medium",
                  variant === "header" ? "text-[#696F79]" : "text-[#1B1D21]"
                )}
              >
                {item.label}
              </span>
            ) : item.href ? (
              <Link
                href={item.href}
                className={cn(
                  "text-[#9AA0A9] hover:text-[#2A5BD7]",
                  MOTION.settle
                )}
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-[#9AA0A9]">{item.label}</span>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}

export { Breadcrumbs }
export type { Crumb }
