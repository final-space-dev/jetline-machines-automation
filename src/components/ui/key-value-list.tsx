import * as React from "react"

import { cn } from "@/lib/ui/utils"

/**
 * Key-value list (design-spec-v1 §3.8): r14 card of hairline-separated rows,
 * key 12.5 header-gray, value 12.5/500 right-aligned tabular; good/bad tones
 * for figures that prove out or don't.
 */
type KeyValueItem = {
  label: React.ReactNode
  value: React.ReactNode
  tone?: "good" | "bad"
}

function KeyValueList({
  items,
  className,
  ...props
}: React.ComponentProps<"dl"> & { items: KeyValueItem[] }) {
  return (
    <dl
      data-slot="key-value-list"
      className={cn(
        "rounded-[14px] border border-[#EEEFF0] bg-white px-3.5 py-1",
        className
      )}
      {...props}
    >
      {items.map((item, i) => (
        <div
          key={i}
          data-slot="key-value-row"
          className="flex items-baseline justify-between gap-3 border-b border-[#F4F4F5] py-2.5 last:border-b-0"
        >
          <dt className="shrink-0 text-[12.5px] text-[#696F79]">{item.label}</dt>
          <dd
            className={cn(
              "min-w-0 text-right text-[12.5px] font-medium tabular-nums",
              item.tone === "good"
                ? "text-[#17795B]"
                : item.tone === "bad"
                  ? "text-[#BA433A]"
                  : "text-[#1B1D21]"
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export { KeyValueList }
export type { KeyValueItem }
