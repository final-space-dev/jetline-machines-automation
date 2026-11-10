"use client"

import * as React from "react"

import { cn } from "@/lib/ui/utils"
import { MOTION } from "@/lib/ui/ui-tokens"

/**
 * Pagination (design-spec-v1 §3.10): bordered r11 container, 30px min-width
 * items, active page 600 Ink on the subtle bubble, windowed page list with
 * an ellipsis, prev/next chevrons.
 */
function pageWindow(page: number, pageCount: number): (number | "ellipsis-l" | "ellipsis-r")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1)
  const pages = new Set<number>([1, pageCount, page - 1, page, page + 1])
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p))
  if (page >= pageCount - 2) [pageCount - 3, pageCount - 2, pageCount - 1].forEach((p) => pages.add(p))
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b)
  const out: (number | "ellipsis-l" | "ellipsis-r")[] = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      out.push(sorted[i] < page ? "ellipsis-l" : "ellipsis-r")
    }
    out.push(sorted[i])
  }
  return out
}

const itemBase =
  "min-w-[30px] rounded-lg px-[9px] py-[7px] text-center text-[12.5px] leading-none pointer-coarse:min-h-11 pointer-coarse:min-w-11"

function Pagination({
  page,
  pageCount,
  onPageChange,
  className,
  ...props
}: React.ComponentProps<"nav"> & {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
}) {
  if (pageCount <= 0) return null
  return (
    <nav
      aria-label="Pagination"
      data-slot="pagination"
      className={cn(
        // Wraps on a narrow screen: with finger-sized pages a long run is wider than a phone.
        "inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-[11px] border border-[#DEE0E3] bg-white p-[3px]",
        className
      )}
      {...props}
    >
      <button
        type="button"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className={cn(
          itemBase,
          MOTION.settle,
          "font-medium",
          page <= 1
            ? "cursor-not-allowed text-[#B4B8BF]"
            : "text-[#696F79] hover:bg-[#F1F2F3] hover:text-[#1B1D21]"
        )}
      >
        &#8249;
      </button>
      {pageWindow(page, pageCount).map((p) =>
        typeof p === "number" ? (
          <button
            key={p}
            type="button"
            aria-label={`Page ${p}`}
            aria-current={p === page ? "page" : undefined}
            onClick={() => onPageChange(p)}
            className={cn(
              itemBase,
              MOTION.settle,
              "tabular-nums",
              p === page
                ? "bg-[#F1F2F3] font-semibold text-[#1B1D21]"
                : "font-medium text-[#696F79] hover:bg-[#F1F2F3] hover:text-[#1B1D21]"
            )}
          >
            {p}
          </button>
        ) : (
          <span
            key={p}
            aria-hidden
            className={cn(itemBase, "font-medium text-[#696F79]")}
          >
            &#8230;
          </span>
        )
      )}
      <button
        type="button"
        aria-label="Next page"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
        className={cn(
          itemBase,
          MOTION.settle,
          "font-medium",
          page >= pageCount
            ? "cursor-not-allowed text-[#B4B8BF]"
            : "text-[#696F79] hover:bg-[#F1F2F3] hover:text-[#1B1D21]"
        )}
      >
        &#8250;
      </button>
    </nav>
  )
}

export { Pagination }
