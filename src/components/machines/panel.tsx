import { SURFACE, TYPE } from "@/lib/ui/ui-tokens";
import { cn } from "@/lib/ui/utils";

/**
 * The one section card: a caption (a plain name, never a sentence) at the
 * left, controls at the right, the body below. Wide bodies scroll inside the
 * panel, never the page.
 */
export function Panel({
  caption,
  right,
  className,
  bodyClassName,
  children,
}: {
  caption?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn(SURFACE.card, "flex min-w-0 shrink-0 flex-col px-4 pt-3 pb-4", className)}>
      {(caption || right) && (
        <div className="mb-3 flex flex-none flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          {caption ? <h2 className={TYPE.microLabel}>{caption}</h2> : <span />}
          {right && <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">{right}</div>}
        </div>
      )}
      <div className={cn("min-w-0", bodyClassName)}>{children}</div>
    </section>
  );
}

/** A heading inside a panel or a page: 15/600. */
export function SectionHeading({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn(TYPE.section, className)}>{children}</h3>;
}

/** Secondary words: 13 px muted. */
export function Muted({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn(TYPE.data, "text-muted-foreground", className)}>{children}</span>;
}
