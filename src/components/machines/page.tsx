import { Breadcrumbs, type Crumb } from "@/components/ui/breadcrumbs";
import { PageShell } from "@/components/ui/page-shell";
import { cn } from "@/lib/ui/utils";
import { NotificationBell } from "./notification-bell";

/**
 * The page: a title that stands alone, actions on the right, an optional
 * toolbar band and context bar (the kit's PageShell), then the working area
 * with the system's gutters. The working area scrolls; the page never does,
 * and wide content scrolls inside its own panel. On a wide screen the bell
 * sits at the end of the actions; on a phone it is in the top bar instead,
 * and the actions move under the header so the title keeps its line.
 */
export function Page({
  title,
  subtitle,
  titleExtra,
  actions,
  toolbar,
  contextBar,
  crumbs,
  className,
  children,
}: {
  title: React.ReactNode;
  /** One middot-joined line of context under the title. */
  subtitle?: React.ReactNode;
  titleExtra?: React.ReactNode;
  actions?: React.ReactNode;
  toolbar?: React.ReactNode;
  contextBar?: React.ReactNode;
  /** Where the page sits: the way back up, under the title. */
  crumbs?: Crumb[];
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <PageShell
      title={title}
      subtitle={subtitle}
      titleExtra={titleExtra}
      actions={
        <>
          {actions && <div className="flex items-center gap-2.5 max-sm:hidden">{actions}</div>}
          <span className="max-lg:hidden print:hidden">
            <NotificationBell />
          </span>
        </>
      }
      toolbar={toolbar}
      contextBar={contextBar ?? (crumbs ? <Breadcrumbs variant="header" items={crumbs} className="mt-2" /> : undefined)}
    >
      <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pt-5 pb-10 *:shrink-0 sm:px-7", className)}>
        {/* On a phone the header keeps the title; the actions come first in the working area. */}
        {actions && <div className="flex flex-wrap items-center gap-2 sm:hidden print:hidden">{actions}</div>}
        {children}
      </div>
    </PageShell>
  );
}
