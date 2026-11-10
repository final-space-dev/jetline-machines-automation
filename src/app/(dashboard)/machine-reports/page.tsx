"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsTrigger } from "@/components/ui/tabs";
import { TabStrip } from "@/components/machines/tab-strip";
import { DataTable, type Column } from "@/components/machines/data-table";
import { Loading } from "@/components/machines/loading";
import { Page } from "@/components/machines/page";
import { Muted } from "@/components/machines/panel";
import { Pick } from "@/components/machines/pick";
import { GRID } from "@/lib/ui/ui-tokens";
import { cn } from "@/lib/ui/utils";
import { useAdminGuard } from "@/lib/use-admin-guard";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BaseRow {
  serial_number: string;
  model_name: string;
  store: string | null;
  company_group: string | null;
  printer_type: string | null;
}

interface SummaryRow extends BaseRow {
  max_daily_vol: number;
  avg_daily_vol: number;
  reading_days: number;
  last_reading: string | null;
  min_monthly_vol: number;
  max_monthly_vol: number;
  min_month: string | null;
  max_month: string | null;
  latest_balances: { black_impressions?: number; color_impressions?: number };
  age: string | null;
  condition_notes: string | null;
  bms_installed_date: string | null;
}

interface StatusRow extends BaseRow {
  age: string | null;
  condition_notes: string | null;
  reporting_enabled: boolean | null;
  bms_installed_date: string | null;
}

interface MtdRow extends BaseRow {
  daily_volumes: Record<string, number>;
  period_total: number;
}

interface MonthlyRow extends BaseRow {
  monthly_volumes: Record<string, number>;
  period_total: number;
}

type TabType = "summary" | "mtd" | "weekly" | "monthly" | "ytd" | "status";

interface SortState { key: string; dir: 1 | -1 }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

// Postgres bigint values arrive as STRINGS in JSON. Coerce to number so arithmetic
// (totals via reduce) sums instead of string-concatenating. Returns 0 for
// null/undefined/non-numeric.
function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
// True when a daily/period value is genuinely present (a reading happened),
// distinguishing "read, 0 volume" from "no reading" (undefined key).
function present(v: unknown): boolean {
  return v !== null && v !== undefined;
}

function fmtMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split("-");
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleString("default", { month: "short" }) + " " + y.slice(2);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", { day: "2-digit", month: "short" });
}

// ISO-8601 week number (weeks Mon–Sun; week 1 contains the year's first Thursday).
function isoWeekNum(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;          // Mon=0 … Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3);     // Thursday of this week
  const firstThu = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((date.getTime() - firstThu.getTime()) / (7 * 86400000));
}

// Weekly column header: the key is the week's Sunday end-date (YYYY-MM-DD).
// Rendered as "Wk 32 · 9 Aug 26".
function fmtWeek(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  const end = d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "2-digit" });
  return `Wk ${isoWeekNum(d)} · ${end}`;
}

function fmtInstallDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
}

function bmsAge(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const months = Math.floor(ms / (1000 * 60 * 60 * 24 * 30.44));
  if (months < 1) return "< 1m";
  if (months < 12) return `${months}m`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m > 0 ? `${y}y ${m}m` : `${y}y`;
}

// ── Sort ──────────────────────────────────────────────────────────────────────

const DEFAULT_SORT: SortState = { key: "store", dir: 1 };

/** The rows in the order the table shows them, so an export matches the screen. */
function sortRows<T>(rows: T[], columns: Column<T>[], sort: SortState): T[] {
  const sv = columns.find((c) => c.key === sort.key)?.sortValue;
  if (!sv) return rows;
  return [...rows].sort((a, b) => {
    const x = sv(a);
    const y = sv(b);
    const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    return r * sort.dir;
  });
}

// ── Filter ────────────────────────────────────────────────────────────────────

interface Filters { search: string; store: string; group: string; type: string; model: string }

function useFiltered<T extends BaseRow>(rows: T[], f: Filters): T[] {
  return rows.filter((r) => {
    if (f.search) {
      const s = f.search.toLowerCase();
      if (
        !r.serial_number?.toLowerCase().includes(s) &&
        !r.model_name?.toLowerCase().includes(s) &&
        !(r.store ?? "").toLowerCase().includes(s) &&
        !(r.company_group ?? "").toLowerCase().includes(s)
      ) return false;
    }
    if (f.store !== "all" && (r.store ?? "") !== f.store) return false;
    if (f.group !== "all" && (r.company_group ?? "") !== f.group) return false;
    if (f.type !== "all" && (r.printer_type ?? "") !== f.type) return false;
    if (f.model !== "all" && r.model_name !== f.model) return false;
    return true;
  });
}

// ── Columns every report starts with ──────────────────────────────────────────

const text = (v: string | null | undefined) => v ?? "—";
const figure = (v: React.ReactNode, strong = false) => <span className={cn(GRID.num, strong && "font-semibold")}>{v}</span>;

function baseColumns<T extends BaseRow>(): Column<T>[] {
  return [
    { key: "serial_number", label: "Serial", sortValue: (r) => r.serial_number ?? "", cell: (r) => <span className="whitespace-nowrap tabular-nums">{r.serial_number}</span> },
    { key: "model_name", label: "Model", sortValue: (r) => r.model_name ?? "", cell: (r) => <span className="whitespace-nowrap">{r.model_name}</span> },
    { key: "store", label: "Store", sortValue: (r) => r.store ?? "", cell: (r) => <span className="whitespace-nowrap">{text(r.store)}</span> },
    { key: "company_group", label: "Group", sortValue: (r) => r.company_group ?? "", cell: (r) => <span className="whitespace-nowrap">{text(r.company_group)}</span> },
    { key: "printer_type", label: "Type", sortValue: (r) => r.printer_type ?? "", cell: (r) => <span className="whitespace-nowrap">{text(r.printer_type)}</span> },
  ];
}

/** The totals line under a period report. */
function TotalsRow({ totals, grand }: { totals: number[]; grand: number }) {
  return (
    <tr className={cn(GRID.band, "border-t border-border font-semibold")}>
      <td colSpan={5} className={GRID.td}>Totals</td>
      {totals.map((t, i) => (
        <td key={i} className={cn(GRID.td, GRID.num)}>{fmt(t)}</td>
      ))}
      <td className={cn(GRID.td, GRID.num)}>{fmt(grand)}</td>
    </tr>
  );
}

// ── FilterBar ─────────────────────────────────────────────────────────────────

function FilterBar({ allRows, filters, setFilters, onExport }: {
  allRows: BaseRow[]; filters: Filters; setFilters: (f: Filters) => void; onExport: () => void;
}) {
  const uniq = <K extends keyof BaseRow>(key: K) =>
    Array.from(new Set(allRows.map((r) => r[key] ?? ""))).filter(Boolean).sort() as string[];
  const set = (key: keyof Filters) => (val: string) => setFilters({ ...filters, [key]: val });
  const options = (all: string, values: string[]) => [{ value: "all", label: all }, ...values.map((v) => ({ value: v, label: v }))];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input placeholder="Search serial, model, store, group" aria-label="Search" value={filters.search} onChange={(e) => set("search")(e.target.value)} className="w-full sm:w-64" />
      <Pick aria-label="Store" className="w-40" value={filters.store} onChange={set("store")} options={options("All stores", uniq("store"))} />
      <Pick aria-label="Group" className="w-40" value={filters.group} onChange={set("group")} options={options("All groups", uniq("company_group"))} />
      <Pick aria-label="Type" className="w-40" value={filters.type} onChange={set("type")} options={options("All types", uniq("printer_type"))} />
      <Pick aria-label="Model" className="w-48" value={filters.model} onChange={set("model")} options={options("All models", uniq("model_name"))} />
      <Button variant="outline" size="sm" className="sm:ml-auto" onClick={onExport}>
        <Download /> Export CSV
      </Button>
    </div>
  );
}

// ── CSV ───────────────────────────────────────────────────────────────────────

function exportCsv(filename: string, headers: string[], rows: string[][]): void {
  const csv = [headers, ...rows]
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Summary tab ───────────────────────────────────────────────────────────────

type SummaryShown = SummaryRow & { bw_total_reading: number };

const SUMMARY_COLUMNS: Column<SummaryShown>[] = [
  ...baseColumns<SummaryShown>(),
  { key: "max_daily_vol", label: "Max Daily", align: "right", sortValue: (r) => num(r.max_daily_vol), cell: (r) => figure(fmt(r.max_daily_vol)) },
  { key: "avg_daily_vol", label: "Avg Daily", align: "right", sortValue: (r) => num(r.avg_daily_vol), cell: (r) => figure(fmt(r.avg_daily_vol)) },
  { key: "reading_days", label: "Active Days", align: "right", sortValue: (r) => num(r.reading_days), cell: (r) => figure(fmt(r.reading_days)) },
  { key: "last_reading", label: "Last Read", sortValue: (r) => r.last_reading ?? "", cell: (r) => <span className="whitespace-nowrap">{fmtDate(r.last_reading)}</span> },
  { key: "black", label: "B&W Reading", align: "right", sortValue: (r) => num(r.latest_balances?.black_impressions), cell: (r) => figure(fmt(r.latest_balances?.black_impressions)) },
  { key: "colour", label: "Colour Reading", align: "right", sortValue: (r) => num(r.latest_balances?.color_impressions), cell: (r) => figure(fmt(r.latest_balances?.color_impressions)) },
  {
    key: "bw_total_reading", label: "Total Reading", align: "right", sortValue: (r) => r.bw_total_reading,
    cell: (r) => figure(r.latest_balances?.black_impressions != null || r.latest_balances?.color_impressions != null ? fmt(r.bw_total_reading) : "—"),
  },
  { key: "bms_installed_date", label: "BMS Install Date", sortValue: (r) => r.bms_installed_date ?? "", cell: (r) => <span className="whitespace-nowrap">{fmtInstallDate(r.bms_installed_date)}</span> },
  { key: "bms_age", label: "BMS Age", sortValue: (r) => r.bms_installed_date ?? "", cell: (r) => <span className="whitespace-nowrap">{bmsAge(r.bms_installed_date)}</span> },
  { key: "age", label: "Age", sortValue: (r) => r.age ?? "", cell: (r) => <span className="whitespace-nowrap">{text(r.age)}</span> },
  { key: "condition_notes", label: "Condition", sortValue: (r) => r.condition_notes ?? "", cell: (r) => <span className="block max-w-72 truncate" title={r.condition_notes ?? ""}>{text(r.condition_notes)}</span> },
];

function SummaryTab({ rows, filters, setFilters }: {
  rows: SummaryRow[]; filters: Filters; setFilters: (f: Filters) => void;
}) {
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const filtered = useFiltered(rows, filters);
  const shown = useMemo<SummaryShown[]>(
    () => filtered.map((r) => ({ ...r, bw_total_reading: (r.latest_balances?.black_impressions ?? 0) + (r.latest_balances?.color_impressions ?? 0) })),
    [filtered],
  );

  const exportRows = () =>
    exportCsv("summary.csv",
      ["Serial","Model","Store","Group","Type","Max Daily","Avg Daily","Active Days","Last Reading","B&W Reading","Colour Reading","Total Reading","BMS Install Date","BMS Age","Age","Condition"],
      sortRows(shown, SUMMARY_COLUMNS, sort).map((r) => {
        const bw = r.latest_balances?.black_impressions ?? null;
        const col = r.latest_balances?.color_impressions ?? null;
        return [r.serial_number,r.model_name,r.store??"",r.company_group??"",r.printer_type??"",
          String(r.max_daily_vol),String(r.avg_daily_vol),String(r.reading_days),r.last_reading??"",
          String(bw??""),String(col??""),
          bw!=null||col!=null ? String((bw??0)+(col??0)) : "",
          r.bms_installed_date??"",bmsAge(r.bms_installed_date),
          r.age??"",r.condition_notes??""];
      })
    );

  return (
    <>
      <FilterBar allRows={rows} filters={filters} setFilters={setFilters} onExport={exportRows} />
      <DataTable wide columns={SUMMARY_COLUMNS} rows={shown} rowKey={(r) => r.serial_number} defaultSort={DEFAULT_SORT} onSortChange={(key, dir) => setSort({ key, dir })} empty="No data" />
      <Muted>{shown.length} of {rows.length} machines</Muted>
    </>
  );
}

// ── Period tabs: a column per day, week or month ──────────────────────────────

function PeriodTab<T extends BaseRow & { period_total: number }>({ rows, periods, volumes, header, exportName, footnote, blankWhenMissing = false, filters, setFilters }: {
  rows: T[];
  /** The period keys, in column order. */
  periods: string[];
  /** A row's volumes by period key. */
  volumes: (row: T) => Record<string, number>;
  /** How to label each period column. */
  header: (key: string) => string;
  exportName: string;
  footnote: (periods: number) => string;
  /** A day with no reading shows a dash, not 0 (a reading of 0 is a figure). */
  blankWhenMissing?: boolean;
  filters: Filters;
  setFilters: (f: Filters) => void;
}) {
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const visible = useFiltered(rows, filters);

  const columns = useMemo<Column<T>[]>(
    () => [
      ...baseColumns<T>(),
      ...periods.map((p): Column<T> => ({
        key: `p_${p}`,
        label: header(p),
        align: "right",
        // num() coercion: volumes are bigint strings from Postgres.
        sortValue: (r) => num(volumes(r)[p]),
        cell: (r) => figure(blankWhenMissing && !present(volumes(r)[p]) ? "—" : fmt(num(volumes(r)[p]))),
      })),
      { key: "period_total", label: "Total", align: "right", sortValue: (r) => num(r.period_total), cell: (r) => figure(fmt(num(r.period_total)), true) },
    ],
    [periods, header, volumes, blankWhenMissing],
  );

  const colTotals = periods.map((p) => visible.reduce((s, r) => s + num(volumes(r)[p]), 0));
  const grandTotal = visible.reduce((s, r) => s + num(r.period_total), 0);

  const exportRows = () =>
    exportCsv(`${exportName}.csv`,
      ["Serial","Model","Store","Group","Type",...periods.map(header),"Total"],
      sortRows(visible, columns, sort).map((r) => [r.serial_number,r.model_name,r.store??"",r.company_group??"",r.printer_type??"",
        ...periods.map((p) => String(volumes(r)[p]??0)),String(r.period_total)])
    );

  return (
    <>
      <FilterBar allRows={rows} filters={filters} setFilters={setFilters} onExport={exportRows} />
      <DataTable
        wide
        columns={columns}
        rows={visible}
        rowKey={(r) => r.serial_number}
        defaultSort={DEFAULT_SORT}
        onSortChange={(key, dir) => setSort({ key, dir })}
        empty="No data"
        footer={visible.length > 0 ? <TotalsRow totals={colTotals} grand={grandTotal} /> : undefined}
      />
      <Muted>{visible.length} of {rows.length} machines · {footnote(periods.length)}</Muted>
    </>
  );
}

const dailyVolumes = (r: MtdRow) => r.daily_volumes;
const monthlyVolumes = (r: MonthlyRow) => r.monthly_volumes;

// ── Status tab ────────────────────────────────────────────────────────────────

const STATUS_COLUMNS: Column<StatusRow>[] = (() => {
  const [serial, model, store, group, type] = baseColumns<StatusRow>();
  return [
    store, model, serial, group, type,
    { key: "bms_installed_date", label: "BMS Install Date", sortValue: (r) => r.bms_installed_date ?? "", cell: (r) => <span className="whitespace-nowrap">{fmtInstallDate(r.bms_installed_date)}</span> },
    { key: "bms_age", label: "BMS Age", sortValue: (r) => r.bms_installed_date ?? "", cell: (r) => <span className="whitespace-nowrap">{bmsAge(r.bms_installed_date)}</span> },
    { key: "age", label: "Age", sortValue: (r) => r.age ?? "", cell: (r) => <span className="whitespace-nowrap">{text(r.age)}</span> },
    { key: "condition_notes", label: "Condition", sortValue: (r) => r.condition_notes ?? "", cell: (r) => <span className="block max-w-80 truncate" title={r.condition_notes ?? ""}>{text(r.condition_notes)}</span> },
  ];
})();

function StatusTab({ rows, filters, setFilters }: {
  rows: StatusRow[]; filters: Filters; setFilters: (f: Filters) => void;
}) {
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const visible = useFiltered(rows, filters);

  const exportRows = () =>
    exportCsv("machine-status.csv",
      ["Store","Model","Serial","Group","Type","BMS Install Date","BMS Age","Age","Condition"],
      sortRows(visible, STATUS_COLUMNS, sort).map((r) => [
        r.store ?? "", r.model_name, r.serial_number,
        r.company_group ?? "", r.printer_type ?? "",
        r.bms_installed_date ?? "", bmsAge(r.bms_installed_date),
        r.age ?? "", r.condition_notes ?? "",
      ])
    );

  return (
    <>
      <FilterBar allRows={rows} filters={filters} setFilters={setFilters} onExport={exportRows} />
      <DataTable wide columns={STATUS_COLUMNS} rows={visible} rowKey={(r) => r.serial_number} defaultSort={DEFAULT_SORT} onSortChange={(key, dir) => setSort({ key, dir })} empty="No data" />
      <Muted>{visible.length} machines</Muted>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS: { key: TabType; label: string }[] = [
  { key: "summary",  label: "Summary" },
  { key: "mtd",     label: "Month to Date" },
  { key: "weekly",  label: "Weekly" },
  { key: "monthly", label: "Monthly (6m)" },
  { key: "ytd",     label: "Year to Date" },
  { key: "status",  label: "Machine Status" },
];

interface ApiPayload {
  tab: TabType;
  rows: (SummaryRow | MtdRow | MonthlyRow | StatusRow)[];
  dates?: string[];
  months?: string[];
}

const DEFAULT_FILTERS: Filters = { search: "", store: "all", group: "all", type: "all", model: "all" };

export default function MachineReportsPage() {
  const { allowed, loading: guardLoading } = useAdminGuard("nav:machine-reports");
  const [activeTab, setActiveTab] = useState<TabType>("summary");
  const [cache, setCache] = useState<Partial<Record<TabType, ApiPayload>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const fetchTab = useCallback(async (tab: TabType) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/reports?tab=${tab}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setCache((prev) => ({ ...prev, [tab]: json }));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!cache[activeTab]) fetchTab(activeTab);
  }, [activeTab, cache, fetchTab]);

  function switchTab(tab: string) {
    setActiveTab(tab as TabType);
    setFilters(DEFAULT_FILTERS);
  }

  const current = cache[activeTab];

  // Block non-admins from the render path (they're being redirected to their store).
  if (guardLoading || !allowed) {
    return (
      <Page title="Machine Reports">
        <Loading />
      </Page>
    );
  }

  return (
    <Page title="Machine Reports">
      <Tabs value={activeTab} onValueChange={switchTab}>
        <TabStrip>
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
          ))}
        </TabStrip>
      </Tabs>
      {loading && <Loading />}
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Failed to load: {error}</AlertTitle>
        </Alert>
      )}
      {!loading && !error && current && (
        <>
          {activeTab === "summary" && <SummaryTab rows={current.rows as SummaryRow[]} filters={filters} setFilters={setFilters} />}
          {activeTab === "mtd" && (
            <PeriodTab rows={current.rows as MtdRow[]} periods={current.dates ?? []} volumes={dailyVolumes} header={fmtDate} exportName="mtd" footnote={(n) => `${n} days with readings`} blankWhenMissing filters={filters} setFilters={setFilters} />
          )}
          {activeTab === "weekly" && (
            <PeriodTab rows={current.rows as MonthlyRow[]} periods={current.months ?? []} volumes={monthlyVolumes} header={fmtWeek} exportName="weekly" footnote={(n) => `${n} months`} filters={filters} setFilters={setFilters} />
          )}
          {activeTab === "monthly" && (
            <PeriodTab rows={current.rows as MonthlyRow[]} periods={current.months ?? []} volumes={monthlyVolumes} header={fmtMonth} exportName="monthly" footnote={(n) => `${n} months`} filters={filters} setFilters={setFilters} />
          )}
          {activeTab === "ytd" && (
            <PeriodTab rows={current.rows as MonthlyRow[]} periods={current.months ?? []} volumes={monthlyVolumes} header={fmtMonth} exportName="ytd" footnote={(n) => `${n} months`} filters={filters} setFilters={setFilters} />
          )}
          {activeTab === "status" && <StatusTab rows={current.rows as StatusRow[]} filters={filters} setFilters={setFilters} />}
        </>
      )}
    </Page>
  );
}
