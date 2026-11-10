"use client";

import { BarChart } from "@/components/ui/bar-chart";
import { DonutChart } from "@/components/ui/donut-chart";
import { compactR, LineChart } from "@/components/ui/line-chart";
import { COLORS, TYPE } from "@/lib/ui/ui-tokens";
import { cn } from "@/lib/ui/utils";

/**
 * The kit charts as Machines' pages use them. The kit charts fill their box,
 * so every chart sits in one of three heights; the formatting is chosen by
 * name so a page hands over plain numbers.
 */
export type ChartFormat = "count" | "rand" | "percent";

const whole = (v: number) => Math.round(v).toLocaleString("en-ZA");

const FORMAT: Record<ChartFormat, { value: (v: number) => string; axis: (v: number) => string }> = {
  count: { value: whole, axis: (v) => compactR(v) },
  rand: { value: (v) => `R ${whole(v)}`, axis: (v) => `R ${compactR(v)}` },
  percent: { value: (v) => `${Math.round(v)}%`, axis: (v) => `${Math.round(v)}%` },
};

/**
 * A bar series' colour and its legend swatch. The kit's bar chart has no
 * legend, so bars take the kit's semantic solids, which the theme also has
 * as classes (globals.css).
 */
const TONES = {
  signal: { color: COLORS.signal, swatch: "bg-signal" },
  proven: { color: COLORS.proven, swatch: "bg-proven" },
  pending: { color: COLORS.pending, swatch: "bg-pending" },
  deficit: { color: COLORS.deficit, swatch: "bg-deficit" },
} as const;
export type Tone = keyof typeof TONES;
const IN_TURN: Tone[] = ["signal", "proven", "pending", "deficit"];

export type Series = { label: string; values: (number | null)[]; dashed?: boolean; tone?: Tone };

type Height = "sm" | "md" | "lg";
const box = (height: Height) => (height === "sm" ? "h-44" : height === "lg" ? "h-80" : "h-60");

/** Nothing to draw: every value missing or zero. */
const blank = (series: Series[]) => series.every((s) => s.values.every((v) => v === null || v === 0));

function Nothing({ height, text }: { height: Height; text: string }) {
  return (
    <div className={cn(box(height), "flex items-center justify-center")}>
      <p className={cn(TYPE.body, "text-muted-foreground")}>{text}</p>
    </div>
  );
}

/** The swatches and names of a chart's series. */
export function Legend({ series }: { series: { label: string; tone: Tone }[] }) {
  return (
    <div className="flex flex-wrap justify-end gap-x-4 gap-y-1">
      {series.map((s) => (
        <span key={s.label} className={cn(TYPE.micro, "inline-flex items-center gap-1.5 text-muted-foreground")}>
          <span className={cn("size-2.5 rounded-sm", TONES[s.tone].swatch)} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

/** Bars for amounts per period; more than one series stands side by side under a legend. */
export function Bars({
  labels,
  series,
  format = "count",
  height = "md",
  empty = "Nothing in the period",
  showValues,
  onBarClick,
  className,
}: {
  labels: string[];
  series: Series[];
  format?: ChartFormat;
  height?: Height;
  empty?: string;
  /** Figures on the bars; by default only when there is one series. */
  showValues?: boolean;
  onBarClick?: (index: number, label: string) => void;
  className?: string;
}) {
  if (blank(series)) return <Nothing height={height} text={empty} />;
  const f = FORMAT[format];
  const tone = (s: Series, i: number): Tone => s.tone ?? IN_TURN[i % IN_TURN.length];
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {series.length > 1 && <Legend series={series.map((s, i) => ({ label: s.label, tone: tone(s, i) }))} />}
      <div className={cn(box(height), className)}>
        <BarChart
          labels={labels}
          series={series.map((s, i) => ({ label: s.label, values: s.values, color: TONES[tone(s, i)].color }))}
          valueFormat={f.value}
          axisFormat={f.axis}
          showValues={showValues ?? series.length === 1}
          // A zero bar has nothing to say; its label would only clutter the axis.
          // Under ten thousand the figure itself fits on the bar ("1 788", not "2k").
          barLabelFormat={(v) => (v === 0 ? "" : format === "percent" ? `${Math.round(v)}%` : Math.abs(v) < 10000 ? whole(v) : compactR(v))}
          onBarClick={onBarClick}
        />
      </div>
    </div>
  );
}

/** Lines for running figures; the kit draws the legend. */
export function Lines({
  labels,
  series,
  format = "count",
  height = "md",
  legend,
  empty = "Nothing in the period",
  className,
}: {
  labels: string[];
  series: Series[];
  format?: ChartFormat;
  height?: Height;
  legend?: boolean;
  empty?: string;
  className?: string;
}) {
  if (blank(series)) return <Nothing height={height} text={empty} />;
  const f = FORMAT[format];
  return (
    <div className={cn(box(height), className)}>
      <LineChart
        labels={labels}
        series={series.map((s) => ({ label: s.label, values: s.values, dashed: s.dashed, color: s.tone ? TONES[s.tone].color : undefined }))}
        valueFormat={f.value}
        axisFormat={f.axis}
        legend={legend ?? series.length > 1}
        showValues={series.length === 1 && labels.length <= 14}
        yIncludeZero
      />
    </div>
  );
}

/** Shares of a whole, with the kit's legend. */
export function Donut({
  segments,
  centerValue,
  centerLabel,
  format = "count",
}: {
  segments: { label: string; value: number; tone?: Tone }[];
  centerValue?: React.ReactNode;
  centerLabel?: React.ReactNode;
  format?: ChartFormat;
}) {
  return (
    <DonutChart
      segments={segments.map((s) => ({ label: s.label, value: s.value, color: s.tone ? TONES[s.tone].color : undefined }))}
      size={148}
      centerValue={centerValue}
      centerLabel={centerLabel}
      legend
      valueFormat={FORMAT[format].value}
    />
  );
}
