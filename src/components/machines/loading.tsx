import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { TYPE } from "@/lib/ui/ui-tokens";
import { cn } from "@/lib/ui/utils";

/** A page or a panel that is still fetching: the kit spinner and one word. */
export function Loading({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cn("flex flex-1 items-center justify-center gap-2 py-16 text-muted-foreground", TYPE.data, className)}>
      <Spinner />
      {label}
    </div>
  );
}

/** Rows that are on their way: the kit skeleton, as many lines as asked. */
export function LoadingRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2.5 py-2" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} variant="line" />
      ))}
    </div>
  );
}
