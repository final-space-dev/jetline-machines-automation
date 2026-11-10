import { cn } from "@/lib/ui/utils";

export type MixTone = "good" | "fair" | "poor" | "unknown";

const FILL: Record<MixTone, string> = {
  good: "bg-proven",
  fair: "bg-pending",
  poor: "bg-deficit",
  unknown: "bg-track",
};

// The bar is 24 columns; each share takes a whole number of them.
const UNITS = 24;
const SPAN = [
  "", "col-span-1", "col-span-2", "col-span-3", "col-span-4", "col-span-5", "col-span-6", "col-span-7", "col-span-8",
  "col-span-9", "col-span-10", "col-span-11", "col-span-12", "col-span-13", "col-span-14", "col-span-15", "col-span-16",
  "col-span-17", "col-span-18", "col-span-19", "col-span-20", "col-span-21", "col-span-22", "col-span-23", "col-span-24",
];

export interface MixPart {
  tone: MixTone;
  value: number;
  /** What the share is, for the hover: "12 in good condition". */
  label: string;
}

/** How a whole splits: one thin bar, a segment per share, widths in proportion (every share present gets at least one column). */
export function MixBar({ parts, className }: { parts: MixPart[]; className?: string }) {
  const present = parts.filter((p) => p.value > 0);
  const total = present.reduce((sum, p) => sum + p.value, 0);
  if (total <= 0) return null;

  const spans = present.map((p) => Math.max(1, Math.floor((p.value / total) * UNITS)));
  // Hand the columns left over (or take back the ones over) from the largest share.
  let spare = UNITS - spans.reduce((a, b) => a + b, 0);
  while (spare !== 0) {
    const i = spans.indexOf(Math.max(...spans));
    const step = spare > 0 ? 1 : -1;
    spans[i] += step;
    spare -= step;
  }

  return (
    <div role="img" aria-label={present.map((p) => p.label).join(", ")} className={cn("grid h-2 w-full min-w-0 grid-cols-24 gap-0.5", className)}>
      {present.map((p, i) => (
        <span key={p.tone} title={p.label} className={cn("rounded-full", FILL[p.tone], SPAN[spans[i]])} />
      ))}
    </div>
  );
}

/** The condition split every store and group shows. */
export function ConditionBar({ good, fair, poor, unknown, className }: { good: number; fair: number; poor: number; unknown: number; className?: string }) {
  return (
    <MixBar
      className={className}
      parts={[
        { tone: "good", value: good, label: `${good} in good condition` },
        { tone: "fair", value: fair, label: `${fair} in fair condition` },
        { tone: "poor", value: poor, label: `${poor} in poor condition` },
        { tone: "unknown", value: unknown, label: `${unknown} not assessed` },
      ]}
    />
  );
}
