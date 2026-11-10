import * as React from "react"

import { cn } from "@/lib/ui/utils"
import { TYPE } from "@/lib/ui/ui-tokens"

/**
 * The one page anatomy (design-spec-v1 §2.2/§2.3). White header bar on the
 * hairline: title 22/600 display type left, actions right (ONE primary button
 * per screen by convention), optional toolbar row on the subtle wash, optional
 * context bar, then the working area fills the rest over the warm canvas.
 *
 *   <PageShell title="Reports" actions={<Button>Export</Button>}
 *     toolbar={<>...controls...</>}>
 *     {content}
 *   </PageShell>
 */
function PageShell({
  title,
  titleExtra,
  subtitle,
  actions,
  toolbar,
  contextBar,
  className,
  children,
}: {
  title: React.ReactNode
  /** Inline additions to the title row (live spinner, balance badge). */
  titleExtra?: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  toolbar?: React.ReactNode
  contextBar?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <>
      <div className="flex-shrink-0 border-b border-[#E8E9EB] bg-white px-[30px] pt-4 pb-[15px] print:hidden">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className={cn("flex items-center gap-2", TYPE.display)}>
              {title}
              {titleExtra}
            </h1>
            {subtitle && <p className="mt-[5px] text-[13px] text-[#6E747E]">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-none items-center gap-2.5">{actions}</div>}
        </div>
        {toolbar && (
          <div className="-mx-[30px] mt-3 flex flex-wrap items-end gap-2.5 border-t border-[#F1F1F2] bg-[#FAFAFB] px-[30px] pt-2.5 pb-3">
            {toolbar}
          </div>
        )}
        {contextBar}
      </div>
      <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden bg-[#F7F7F8]", className)}>{children}</div>
    </>
  )
}

export { PageShell }
