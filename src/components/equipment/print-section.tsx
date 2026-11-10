"use client";

/**
 * Phase 18: Print Volumes section for the store detail page.
 * A bar chart of the last 6 months (Black / Colour / A3 / A3 Colour),
 * this month against last month as a percentage, the number of active
 * printers, and a filter to one printer.
 *
 * Data comes from GET /api/stores/[store]/print-report. If that route 404s
 * the section says the data is not available.
 */

import { useEffect, useState } from "react";
import { Delta } from "@/components/ui/delta";
import { Bars, type Series } from "@/components/machines/charts";
import { Loading } from "@/components/machines/loading";
import { Muted, Panel } from "@/components/machines/panel";
import { Pick } from "@/components/machines/pick";
import { TYPE } from "@/lib/ui/ui-tokens";
import { cn } from "@/lib/ui/utils";

// ─── API shape ────────────────────────────────────────────────────────────────

interface PrintMonth {
  month: string;
  black: number;
  colour: number;
  a3: number;
  a3colour: number;
  total: number;
}

interface PrintReport {
  store: string;
  serial: string | null;
  serials: { serial: string; model: string }[];
  months: PrintMonth[];
  thisMonthTotal: number;
  lastMonthTotal: number;
  pctChange: number;
  topPrinter: { serial: string; model: string; volume: number } | null;
  printers: { active: number; replaceFlagged: number };
  lastSync: string | null;
  billing: { xeroxVolume: number; bmsVolume: number; variancePct: number } | null;
}

const ALL = "__all__";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** 23400 -> "23.4k", 980 -> "980". */
export function formatK(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 1000) {
    const v = n / 1000;
    return `${v >= 100 ? Math.round(v) : v.toFixed(1)}k`;
  }
  return `${Math.round(n)}`;
}

/** Format a month key like "2026-06" or ISO date to "Jun". */
function shortMonth(m: string): string {
  const d = new Date(m.length === 7 ? `${m}-01` : m);
  if (Number.isNaN(d.getTime())) return m;
  return d.toLocaleDateString("en-ZA", { month: "short" });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PrintSection({ store }: { store: string }) {
  const [data, setData] = useState<PrintReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  // "" = All printers (whole store). Any other value filters to that serial.
  const [selectedSerial, setSelectedSerial] = useState("");
  // Printer list persists across filter changes (it's store-wide, not per-filter),
  // so the dropdown never empties while a filtered fetch is in flight.
  const [serials, setSerials] = useState<{ serial: string; model: string }[]>([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setUnavailable(false);
    const qs = selectedSerial ? `?serial=${encodeURIComponent(selectedSerial)}` : "";
    fetch(`/api/stores/${encodeURIComponent(store)}/print-report${qs}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: PrintReport) => {
        if (!alive) return;
        setData(d);
        if (Array.isArray(d.serials) && d.serials.length) setSerials(d.serials);
      })
      .catch(() => { if (alive) setUnavailable(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [store, selectedSerial]);

  const months = data?.months ?? [];
  const series: Series[] = [
    { label: "Black", tone: "pending", values: months.map((m) => m.black) },
    { label: "Colour", tone: "signal", values: months.map((m) => m.colour) },
    { label: "A3", tone: "proven", values: months.map((m) => m.a3) },
    { label: "A3 Colour", tone: "deficit", values: months.map((m) => m.a3colour) },
  ].filter((s) => s.values.some((v) => v > 0)) as Series[];

  const pct = data?.pctChange ?? 0;

  return (
    <Panel
      caption="Print Volumes"
      right={
        serials.length > 0 && (
          <Pick
            aria-label="Filter by printer"
            size="sm"
            className="w-56"
            value={selectedSerial || ALL}
            onChange={(v) => setSelectedSerial(v === ALL ? "" : v)}
            options={[{ value: ALL, label: "All printers" }, ...serials.map((p) => ({ value: p.serial, label: p.model ? `${p.serial} · ${p.model}` : p.serial }))]}
          />
        )
      }
    >
      {loading ? (
        <Loading label="Loading print data" />
      ) : unavailable || !data || data.months.length === 0 ? (
        <div className="flex justify-center py-10">
          <Muted>{unavailable ? "Print data is not available for this store yet" : "No print volume recorded in the last 6 months"}</Muted>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div className="flex flex-col gap-1">
              <span className={TYPE.label}>This month</span>
              <span className="flex items-center gap-2.5" title={`Last month ${formatK(data.lastMonthTotal)}`}>
                <span className={cn(TYPE.display, "tabular-nums")}>{formatK(data.thisMonthTotal)}</span>
                <Delta value={pct / 100} />
              </span>
            </div>
            <Muted>
              {data.printers.active} active
              {data.printers.replaceFlagged > 0 && <span className="text-destructive">{" · "}{data.printers.replaceFlagged} replace</span>}
            </Muted>
          </div>
          <Bars labels={months.map((m) => shortMonth(m.month))} series={series} format="count" height="md" empty="No print volume recorded in the last 6 months" />
        </div>
      )}
    </Panel>
  );
}
