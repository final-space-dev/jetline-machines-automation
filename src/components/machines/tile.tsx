import * as React from "react";
import Link from "next/link";
import { KpiStatCard } from "@/components/ui/kpi-stat-card";
import { cn } from "@/lib/ui/utils";

/** A figure with its label; with `href` the card opens the list it counts; `prior` is the line under the value. */
export function Tile({
  label,
  value,
  href,
  tone,
  prior,
  delta,
}: {
  label: string;
  value: React.ReactNode;
  href?: string;
  tone?: "default" | "danger";
  prior?: React.ReactNode;
  delta?: React.ReactNode;
}) {
  const card = <KpiStatCard label={label} value={value} tone={tone} prior={prior} delta={delta ?? <span aria-hidden className="block h-5 w-0" />} />;
  if (!href) return <div className="h-full [&>*]:h-full">{card}</div>;
  return (
    <Link href={href} className="block h-full rounded-2xl transition-transform duration-200 ease-out outline-none hover:-translate-y-px focus-visible:ring-[3px] focus-visible:ring-ring/30 [&>*]:h-full">
      {card}
    </Link>
  );
}

const ROW: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-4",
  // Five never leave a hole: on a phone two columns with the last across the row; on a tablet
  // three above two (a six-column grid: the first three take two columns each, the last two
  // three each); on a wide screen all five in a line.
  5: "grid-cols-2 max-md:*:last:col-span-2 md:max-xl:grid-cols-6 md:max-xl:*:col-span-2 md:max-xl:*:nth-[n+4]:col-span-3 xl:grid-cols-5",
  6: "grid-cols-2 md:grid-cols-3 xl:grid-cols-6",
};

/** A row of Tiles: columns by how many there are, so a wrapped row never leaves a hole. */
export function TileRow({ children, className }: { children: React.ReactNode; className?: string }) {
  const n = Math.min(React.Children.toArray(children).length, 6);
  if (!n) return null;
  return <div className={cn("grid gap-3", ROW[n], className)}>{children}</div>;
}
