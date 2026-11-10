import Link from "next/link";
import { cn } from "@/lib/ui/utils";

/** A link in running text or a table cell. `quiet` is for the second link in a row: ink, not the primary colour. */
export function TextLink({ href, quiet = false, className, children }: { href: string; quiet?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={(e) => e.stopPropagation()}
      className={cn("rounded-sm font-medium outline-none hover:underline focus-visible:underline pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:items-center", quiet ? "text-foreground" : "text-primary", className)}
    >
      {children}
    </Link>
  );
}
