import { Breadcrumbs, type Crumb } from "@/components/ui/breadcrumbs";
import { PageShell } from "@/components/ui/page-shell";
import { cn } from "@/lib/ui/utils";

/**
 * The page: a title that stands alone, actions on the right, an optional
 * toolbar band and context bar (the kit's PageShell), then the working area
 * with the system's gutters. The working area scrolls; the page never does,
 * and wide content scrolls inside its own panel. The kit header wraps on a
 * phone, so the actions drop under the title there.
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
      // On a wide screen the bell sits at the header's right edge (machines-shell); the actions leave it room.
      actions={actions ? <div className="flex flex-wrap items-center gap-2.5 lg:mr-14">{actions}</div> : undefined}
      toolbar={toolbar}
      contextBar={contextBar ?? (crumbs ? <Breadcrumbs variant="header" items={crumbs} className="mt-2" /> : undefined)}
    >
      {/* The working area scrolls, so the keyboard must be able to reach it: tabIndex 0. */}
      <div tabIndex={0} role="region" aria-label="Page content" className={cn("flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pt-5 pb-10 outline-none *:shrink-0 sm:px-7", className)}>
        {children}
      </div>
    </PageShell>
  );
}
