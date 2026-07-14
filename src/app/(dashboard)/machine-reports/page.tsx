"use client";

import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAdminGuard } from "@/lib/use-admin-guard";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

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

type TabType = "summary" | "mtd" | "monthly" | "ytd" | "status";

interface SortState { col: string; dir: "asc" | "desc" }

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

function getVal(row: unknown, path: string): unknown {
  return path.split(".").reduce(
    (obj, key) => obj != null ? (obj as Record<string, unknown>)[key] : undefined,
    row
  );
}

function useSorted<T extends BaseRow>(rows: T[], sort: SortState): T[] {
  return [...rows].sort((a, b) => {
    const av = getVal(a, sort.col);
    const bv = getVal(b, sort.col);
    const an = Number(av), bn = Number(bv);
    const cmp = (!isNaN(an) && !isNaN(bn))
      ? an - bn
      : String(av ?? "").localeCompare(String(bv ?? ""));
    return sort.dir === "asc" ? cmp : -cmp;
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

// ── SortableTh ────────────────────────────────────────────────────────────────

function Th({
  col, sort, onSort, children, className,
}: {
  col: string; sort: SortState; onSort: (c: string) => void;
  children: React.ReactNode; className?: string;
}) {
  const active = sort.col === col;
  return (
    <TableHead
      className={`cursor-pointer select-none whitespace-nowrap ${className ?? ""}`}
      onClick={() => onSort(col)}
    >
      {children}
      <span className={`ml-1 ${active ? "" : "text-gray-300"}`}>
        {active ? (sort.dir === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </TableHead>
  );
}

// ── FilterBar ─────────────────────────────────────────────────────────────────

function FilterBar({ allRows, filters, setFilters }: {
  allRows: BaseRow[]; filters: Filters; setFilters: (f: Filters) => void;
}) {
  const uniq = <K extends keyof BaseRow>(key: K) =>
    Array.from(new Set(allRows.map((r) => r[key] ?? ""))).filter(Boolean).sort() as string[];
  const set = (key: keyof Filters) => (val: string) => setFilters({ ...filters, [key]: val });
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Input placeholder="Search serial, model, store, group..." value={filters.search}
        onChange={(e) => set("search")(e.target.value)} className="w-64 h-8 text-sm" />
      <Select value={filters.store} onValueChange={set("store")}>
        <SelectTrigger className="h-8 w-36 text-sm"><SelectValue placeholder="Store" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All stores</SelectItem>
          {uniq("store").map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.group} onValueChange={set("group")}>
        <SelectTrigger className="h-8 w-36 text-sm"><SelectValue placeholder="Group" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All groups</SelectItem>
          {uniq("company_group").map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.type} onValueChange={set("type")}>
        <SelectTrigger className="h-8 w-36 text-sm"><SelectValue placeholder="Type" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {uniq("printer_type").map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.model} onValueChange={set("model")}>
        <SelectTrigger className="h-8 w-44 text-sm"><SelectValue placeholder="Model" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All models</SelectItem>
          {uniq("model_name").map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
        </SelectContent>
      </Select>
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

function SummaryTab({ rows, filters, setFilters }: {
  rows: SummaryRow[]; filters: Filters; setFilters: (f: Filters) => void;
}) {
  const [sort, setSort] = useState<SortState>({ col: "store", dir: "asc" });
  const toggle = (col: string) =>
    setSort((s) => ({ col, dir: s.col === col && s.dir === "asc" ? "desc" : "asc" }));

  const augmented = useFiltered(rows, filters).map((r) => ({
    ...r,
    bw_total_reading: (r.latest_balances?.black_impressions ?? 0) + (r.latest_balances?.color_impressions ?? 0),
  }));
  const visible = useSorted(augmented, sort);

  const th = (col: string, label: string, cls?: string) =>
    <Th col={col} sort={sort} onSort={toggle} className={cls}>{label}</Th>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <FilterBar allRows={rows} filters={filters} setFilters={setFilters} />
        <Button variant="outline" size="sm" onClick={() =>
          exportCsv("summary.csv",
            ["Serial","Model","Store","Group","Type","Max Daily","Avg Daily","Active Days","Last Reading","B&W Reading","Colour Reading","Total Reading","BMS Install Date","BMS Age","Age","Condition"],
            visible.map((r) => {
              const bw = r.latest_balances?.black_impressions ?? null;
              const col = r.latest_balances?.color_impressions ?? null;
              return [r.serial_number,r.model_name,r.store??"",r.company_group??"",r.printer_type??"",
                String(r.max_daily_vol),String(r.avg_daily_vol),String(r.reading_days),r.last_reading??"",
                String(bw??""),String(col??""),
                bw!=null||col!=null ? String((bw??0)+(col??0)) : "",
                r.bms_installed_date??"",bmsAge(r.bms_installed_date),
                r.age??"",r.condition_notes??""];
            })
          )
        }>Export CSV</Button>
      </div>
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {th("serial_number","Serial")}
              {th("model_name","Model")}
              {th("store","Store")}
              {th("company_group","Group")}
              {th("printer_type","Type")}
              {th("max_daily_vol","Max Daily","text-right")}
              {th("avg_daily_vol","Avg Daily","text-right")}
              {th("reading_days","Active Days","text-right")}
              {th("last_reading","Last Read")}
              {th("latest_balances.black_impressions","B&W Reading","text-right")}
              {th("latest_balances.color_impressions","Colour Reading","text-right")}
              {th("bw_total_reading","Total Reading","text-right")}
              {th("bms_installed_date","BMS Install Date")}
              {th("bms_installed_date","BMS Age")}
              {th("age","Age")}
              {th("condition_notes","Condition")}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow><TableCell colSpan={16} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow>
            ) : visible.map((r) => (
              <TableRow key={r.serial_number}>
                <TableCell className="font-mono text-xs">{r.serial_number}</TableCell>
                <TableCell className="text-xs">{r.model_name}</TableCell>
                <TableCell className="text-xs">{r.store ?? "—"}</TableCell>
                <TableCell className="text-xs">{r.company_group ?? "—"}</TableCell>
                <TableCell className="text-xs">{r.printer_type ?? "—"}</TableCell>
                <TableCell className="text-right font-mono text-xs">{fmt(r.max_daily_vol)}</TableCell>
                <TableCell className="text-right font-mono text-xs">{fmt(r.avg_daily_vol)}</TableCell>
                <TableCell className="text-right text-xs">{fmt(r.reading_days)}</TableCell>
                <TableCell className="text-xs">{fmtDate(r.last_reading)}</TableCell>
                <TableCell className="text-right font-mono text-xs">{fmt(r.latest_balances?.black_impressions)}</TableCell>
                <TableCell className="text-right font-mono text-xs">{fmt(r.latest_balances?.color_impressions)}</TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {(r.latest_balances?.black_impressions != null || r.latest_balances?.color_impressions != null)
                    ? fmt(r.bw_total_reading) : "—"}
                </TableCell>
                <TableCell className="text-xs whitespace-nowrap">{fmtInstallDate(r.bms_installed_date)}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{bmsAge(r.bms_installed_date)}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{r.age ?? "—"}</TableCell>
                <TableCell className="text-xs max-w-[280px] truncate" title={r.condition_notes ?? ""}>{r.condition_notes ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">{visible.length} of {rows.length} machines</p>
    </div>
  );
}

// ── MTD tab ───────────────────────────────────────────────────────────────────

function MtdTab({ rows, dates, filters, setFilters }: {
  rows: MtdRow[]; dates: string[]; filters: Filters; setFilters: (f: Filters) => void;
}) {
  const [sort, setSort] = useState<SortState>({ col: "store", dir: "asc" });
  const toggle = (col: string) =>
    setSort((s) => ({ col, dir: s.col === col && s.dir === "asc" ? "desc" : "asc" }));

  // Flatten date volumes onto row so useSorted can reach them via dot-notation key "d_2026-06-01"
  const augmented = useFiltered(rows, filters).map((r) => {
    const extra: Record<string, number> = {};
    dates.forEach((d) => { extra[`d_${d}`] = num(r.daily_volumes[d]); });
    return { ...r, ...extra };
  });
  const visible = useSorted(augmented, sort);

  // num() coercion — daily_volumes/period_total are bigint strings from Postgres.
  const colTotals = dates.map((d) => visible.reduce((s, r) => s + num(r.daily_volumes[d]), 0));
  const grandTotal = visible.reduce((s, r) => s + num(r.period_total), 0);

  const th = (col: string, label: string, cls?: string) =>
    <Th col={col} sort={sort} onSort={toggle} className={cls}>{label}</Th>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <FilterBar allRows={rows} filters={filters} setFilters={setFilters} />
        <Button variant="outline" size="sm" onClick={() =>
          exportCsv("mtd.csv",
            ["Serial","Model","Store","Group","Type",...dates.map(fmtDate),"Total"],
            visible.map((r) => [r.serial_number,r.model_name,r.store??"",r.company_group??"",r.printer_type??"",
              ...dates.map((d) => String(r.daily_volumes[d]??0)),String(r.period_total)])
          )
        }>Export CSV</Button>
      </div>
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {th("serial_number","Serial")}
              {th("model_name","Model")}
              {th("store","Store")}
              {th("company_group","Group")}
              {th("printer_type","Type")}
              {dates.map((d) => (
                <Th key={d} col={`d_${d}`} sort={sort} onSort={toggle} className="text-right text-xs">
                  {fmtDate(d)}
                </Th>
              ))}
              {th("period_total","Total","text-right")}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow><TableCell colSpan={6+dates.length+1} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow>
            ) : (
              <>
                {visible.map((r) => (
                  <TableRow key={r.serial_number}>
                    <TableCell className="font-mono text-xs">{r.serial_number}</TableCell>
                    <TableCell className="text-xs">{r.model_name}</TableCell>
                    <TableCell className="text-xs">{r.store ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.company_group ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.printer_type ?? "—"}</TableCell>
                    {dates.map((d) => (
                      <TableCell key={d} className="text-right font-mono text-xs">
                        {present(r.daily_volumes[d]) ? fmt(num(r.daily_volumes[d])) : "—"}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-mono text-xs font-semibold">{fmt(num(r.period_total))}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40 font-semibold border-t-2">
                  <TableCell colSpan={5} className="text-xs">Totals</TableCell>
                  {colTotals.map((t, i) => (
                    <TableCell key={i} className="text-right font-mono text-xs">{fmt(t)}</TableCell>
                  ))}
                  <TableCell className="text-right font-mono text-xs">{fmt(grandTotal)}</TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">{visible.length} of {rows.length} machines · {dates.length} days with readings</p>
    </div>
  );
}

// ── Monthly / YTD shared tab ──────────────────────────────────────────────────

function MonthColumnsTab({ rows, months, filters, setFilters, exportName }: {
  rows: MonthlyRow[]; months: string[]; filters: Filters;
  setFilters: (f: Filters) => void; exportName: string;
}) {
  const [sort, setSort] = useState<SortState>({ col: "store", dir: "asc" });
  const toggle = (col: string) =>
    setSort((s) => ({ col, dir: s.col === col && s.dir === "asc" ? "desc" : "asc" }));

  // Flatten month volumes onto row so useSorted can reach them via "m_2026-01"
  const augmented = useFiltered(rows, filters).map((r) => {
    const extra: Record<string, number> = {};
    months.forEach((m) => { extra[`m_${m}`] = num(r.monthly_volumes[m]); });
    return { ...r, ...extra };
  });
  const visible = useSorted(augmented, sort);

  // num() coercion — bigint strings from Postgres would otherwise concatenate.
  const colTotals = months.map((m) => visible.reduce((s, r) => s + num(r.monthly_volumes[m]), 0));
  const grandTotal = visible.reduce((s, r) => s + num(r.period_total), 0);

  const th = (col: string, label: string, cls?: string) =>
    <Th col={col} sort={sort} onSort={toggle} className={cls}>{label}</Th>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <FilterBar allRows={rows} filters={filters} setFilters={setFilters} />
        <Button variant="outline" size="sm" onClick={() =>
          exportCsv(`${exportName}.csv`,
            ["Serial","Model","Store","Group","Type",...months.map(fmtMonth),"Total"],
            visible.map((r) => [r.serial_number,r.model_name,r.store??"",r.company_group??"",r.printer_type??"",
              ...months.map((m) => String(r.monthly_volumes[m]??0)),String(r.period_total)])
          )
        }>Export CSV</Button>
      </div>
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {th("serial_number","Serial")}
              {th("model_name","Model")}
              {th("store","Store")}
              {th("company_group","Group")}
              {th("printer_type","Type")}
              {months.map((m) => (
                <Th key={m} col={`m_${m}`} sort={sort} onSort={toggle} className="text-right text-xs">
                  {fmtMonth(m)}
                </Th>
              ))}
              {th("period_total","Total","text-right")}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow><TableCell colSpan={6+months.length+1} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow>
            ) : (
              <>
                {visible.map((r) => (
                  <TableRow key={r.serial_number}>
                    <TableCell className="font-mono text-xs">{r.serial_number}</TableCell>
                    <TableCell className="text-xs">{r.model_name}</TableCell>
                    <TableCell className="text-xs">{r.store ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.company_group ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.printer_type ?? "—"}</TableCell>
                    {months.map((m) => (
                      <TableCell key={m} className="text-right font-mono text-xs">{fmt(num(r.monthly_volumes[m]))}</TableCell>
                    ))}
                    <TableCell className="text-right font-mono text-xs font-semibold">{fmt(num(r.period_total))}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40 font-semibold border-t-2">
                  <TableCell colSpan={5} className="text-xs">Totals</TableCell>
                  {colTotals.map((t, i) => (
                    <TableCell key={i} className="text-right font-mono text-xs">{fmt(t)}</TableCell>
                  ))}
                  <TableCell className="text-right font-mono text-xs">{fmt(grandTotal)}</TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">{visible.length} of {rows.length} machines · {months.length} months</p>
    </div>
  );
}

// ── Status tab ────────────────────────────────────────────────────────────────

function StatusTab({ rows, filters, setFilters }: {
  rows: StatusRow[]; filters: Filters; setFilters: (f: Filters) => void;
}) {
  const [sort, setSort] = useState<SortState>({ col: "store", dir: "asc" });
  const toggle = (col: string) =>
    setSort((s) => ({ col, dir: s.col === col && s.dir === "asc" ? "desc" : "asc" }));

  const visible = useSorted(useFiltered(rows, filters), sort);

  const th = (col: string, label: string, cls?: string) =>
    <Th col={col} sort={sort} onSort={toggle} className={cls}>{label}</Th>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <FilterBar allRows={rows} filters={filters} setFilters={setFilters} />
        <Button variant="outline" size="sm" onClick={() =>
          exportCsv("machine-status.csv",
            ["Store","Model","Serial","Group","Type","BMS Install Date","BMS Age","Age","Condition"],
            visible.map((r) => [
              r.store ?? "", r.model_name, r.serial_number,
              r.company_group ?? "", r.printer_type ?? "",
              r.bms_installed_date ?? "", bmsAge(r.bms_installed_date),
              r.age ?? "", r.condition_notes ?? "",
            ])
          )
        }>Export CSV</Button>
      </div>
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {th("store","Store")}
              {th("model_name","Model")}
              {th("serial_number","Serial")}
              {th("company_group","Group")}
              {th("printer_type","Type")}
              {th("bms_installed_date","BMS Install Date")}
              {th("bms_installed_date","BMS Age")}
              {th("age","Age")}
              {th("condition_notes","Condition")}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow>
            ) : visible.map((r) => (
              <TableRow key={r.serial_number}>
                <TableCell className="text-xs">{r.store ?? "—"}</TableCell>
                <TableCell className="text-xs">{r.model_name}</TableCell>
                <TableCell className="font-mono text-xs">{r.serial_number}</TableCell>
                <TableCell className="text-xs">{r.company_group ?? "—"}</TableCell>
                <TableCell className="text-xs">{r.printer_type ?? "—"}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{fmtInstallDate(r.bms_installed_date)}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{bmsAge(r.bms_installed_date)}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{r.age ?? "—"}</TableCell>
                <TableCell className="text-xs max-w-[320px] truncate" title={r.condition_notes ?? ""}>{r.condition_notes ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">{visible.length} machines</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS: { key: TabType; label: string }[] = [
  { key: "summary",  label: "Summary" },
  { key: "mtd",     label: "Month to Date" },
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
  const { allowed, loading: guardLoading } = useAdminGuard(); // admin-only
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

  function switchTab(tab: TabType) {
    setActiveTab(tab);
    setFilters(DEFAULT_FILTERS);
  }

  const current = cache[activeTab];

  // Block non-admins from the render path (they're being redirected to their store).
  if (guardLoading || !allowed) {
    return (
      <AppShell>
        <div style={{ display: "grid", placeItems: "center", height: 160 }}>
          <div className="jl-spinner jl-spinner--lg" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col h-full space-y-4 px-8 py-4" style={{ maxWidth: 1720, marginInline: "auto", width: "100%" }}>
        <h1 className="jl-h1">Machine Reports</h1>
        <div className="jl-tabs">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => switchTab(t.key)} aria-selected={activeTab === t.key}>
              {t.label}
            </button>
          ))}
        </div>
        {loading && <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Loading...</div>}
        {error && <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700">Failed to load: {error}</div>}
        {!loading && !error && current && (
          <>
            {activeTab === "summary" && <SummaryTab rows={current.rows as SummaryRow[]} filters={filters} setFilters={setFilters} />}
            {activeTab === "mtd" && <MtdTab rows={current.rows as MtdRow[]} dates={current.dates??[]} filters={filters} setFilters={setFilters} />}
            {activeTab === "monthly" && <MonthColumnsTab rows={current.rows as MonthlyRow[]} months={current.months??[]} filters={filters} setFilters={setFilters} exportName="monthly" />}
            {activeTab === "ytd" && <MonthColumnsTab rows={current.rows as MonthlyRow[]} months={current.months??[]} filters={filters} setFilters={setFilters} exportName="ytd" />}
            {activeTab === "status" && <StatusTab rows={current.rows as StatusRow[]} filters={filters} setFilters={setFilters} />}
          </>
        )}
      </div>
    </AppShell>
  );
}
