"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ColumnDef, ColumnFiltersState, SortingState, VisibilityState } from "@tanstack/react-table";
import { addDays, format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import type { DateRange } from "react-day-picker";
import { AppShell } from "@/components/layout/app-shell";
import { DataTable } from "@/components/data-table/data-table";
import { PageLoading } from "@/components/ui/page-loading";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, Download, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Report types ─────────────────────────────────────────────────────────────

type ReportType = "live" | "not-transmitting" | "machine-age" | "last-balance" | "monthly-volume" | "no-data" | "daily" | "reading-frequency" | "bms-machines";

const REPORT_OPTIONS: { id: ReportType; label: string; description: string }[] = [
  { id: "live",             label: "Live View",                description: "All printers with volumes over selected date range" },
  { id: "not-transmitting", label: "Not Transmitting",         description: "Machines with no data in the last 7 days" },
  { id: "machine-age",      label: "Machine Age",              description: "All machines sorted oldest to newest" },
  { id: "last-balance",     label: "Last Balance per Machine", description: "Latest cumulative reading per machine by store and model" },
  { id: "monthly-volume",   label: "Monthly Volume",           description: "Volume per machine per month going back as far as available" },
  { id: "no-data",          label: "No Data",                  description: "Machines registered in Xerox but never sent any readings" },
  { id: "daily",             label: "Daily Report",             description: "Day-by-day volume movement with anomaly detection" },
  { id: "reading-frequency", label: "Reading Frequency",        description: "Unique readings per machine vs total reports — shows which machines are stale or disconnected" },
  { id: "bms-machines",      label: "BMS Machines",             description: "All Xerox machines in BMS — flagged by whether Xerox is actively billing or reporting on them" },
];

// ─── Row types ────────────────────────────────────────────────────────────────

interface LiveRow {
  printerId: number;
  serialNumber: string;
  store: string | null;
  companyGroup: string | null;
  model: string;
  printerType: string;
  installDate: string | null;
  lastReadingDate: string | null;
  blackVol: number | null;
  blackLargeVol: number | null;
  colorVol: number | null;
  colorLargeVol: number | null;
  totalVol: number | null;
  anyEstimated: boolean;
}

// ─── Saved views / Bookmarks ──────────────────────────────────────────────────

interface SavedView {
  id: string;
  name: string;
  reportType: ReportType;
  columnVisibility: VisibilityState;
  columnFilters: { id: string; value: unknown }[];
  sorting: { id: string; desc: boolean }[];
  globalFilter: string;
}

// Flat list — bookmarks are global, not per-report
type SavedViewsStore = SavedView[];

const SAVED_VIEWS_LS_KEY = "xerox-saved-views-v2";
const COLUMN_VIS_LS_PREFIX = "jetline-table-column-visibility-xerox-reporting-";

function loadSavedViews(): SavedViewsStore {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVED_VIEWS_LS_KEY);
    return raw ? (JSON.parse(raw) as SavedViewsStore) : [];
  } catch {
    return [];
  }
}

function persistSavedViews(views: SavedViewsStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SAVED_VIEWS_LS_KEY, JSON.stringify(views));
}

function loadColumnVisibility(report: ReportType): VisibilityState {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`${COLUMN_VIS_LS_PREFIX}${report}`);
    return raw ? (JSON.parse(raw) as VisibilityState) : {};
  } catch {
    return {};
  }
}

function persistColumnVisibility(report: ReportType, vis: VisibilityState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${COLUMN_VIS_LS_PREFIX}${report}`, JSON.stringify(vis));
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmt(val: number | null | undefined): string {
  if (val == null) return "—";
  return Number(val).toLocaleString("en-ZA");
}

function hasAnyValue(data: LiveRow[], key: keyof LiveRow): boolean {
  return data.some((row) => {
    const v = row[key];
    return v !== null && v !== undefined && v !== 0 && v !== false && v !== "";
  });
}

// ─── Shared cell classes ──────────────────────────────────────────────────────

const C = {
  text:    "text-xs text-foreground",
  muted:   "text-xs text-muted-foreground",
  mono:    "text-xs font-mono",
  num:     "text-xs font-mono tabular-nums text-right block",
  bold:    "text-xs font-semibold",
};

// ─── Live columns ─────────────────────────────────────────────────────────────

function buildLiveColumns(data: LiveRow[]): ColumnDef<LiveRow>[] {
  const cols: ColumnDef<LiveRow>[] = [
    { accessorKey: "store",        header: "Store",        cell: ({ getValue }) => <span className={C.bold}>{getValue<string | null>() || "—"}</span> },
    { accessorKey: "companyGroup", header: "Group",        cell: ({ getValue }) => <span className={C.text}>{getValue<string | null>() || "—"}</span> },
    { accessorKey: "serialNumber", header: "Serial",       cell: ({ getValue }) => <span className={C.mono}>{getValue<string>() || "—"}</span> },
    { accessorKey: "model",        header: "Model",        cell: ({ getValue }) => <span className={C.text}>{getValue<string>() || "—"}</span> },
    { accessorKey: "printerType",  header: "Type",         cell: ({ getValue }) => { const v = getValue<string>(); return <span className={cn(C.text, v === "Colour" ? "text-purple-700" : "text-muted-foreground")}>{v}</span>; } },
    { accessorKey: "installDate",  header: "Install Date", enableSorting: true, cell: ({ getValue }) => <span className={C.mono}>{getValue<string | null>() || "—"}</span> },
    {
      accessorKey: "lastReadingDate",
      header: "Last Reading",
      enableSorting: true,
      cell: ({ getValue }) => {
        const v = getValue<string | null>();
        if (!v) return <span className="text-xs text-destructive">No data</span>;
        return <span className={C.mono}>{v}</span>;
      },
    },
    { accessorKey: "totalVol", header: "Volume", enableSorting: true, meta: { align: "right" }, cell: ({ getValue }) => <span className={C.num}>{fmt(getValue<number | null>())}</span> },
    { accessorKey: "anyEstimated", header: "Est.", cell: ({ getValue }) => getValue<boolean>() ? <span className="text-xs text-amber-600">Est.</span> : <span className={C.muted}>—</span> },
  ];

  return cols;
}

// ─── Generic prebuilt columns ─────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPrebuiltColumns(report: ReportType, months?: string[]): ColumnDef<any>[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const identity: ColumnDef<any>[] = [
    { accessorKey: "store",         header: "Store",  cell: ({ getValue }) => <span className={C.bold}>{getValue<string | null>() || "—"}</span> },
    { accessorKey: "company_group", header: "Group",  cell: ({ getValue }) => <span className={C.text}>{getValue<string | null>() || "—"}</span> },
    { accessorKey: "serial_number", header: "Serial", cell: ({ getValue }) => <span className={C.mono}>{getValue<string>() || "—"}</span> },
    { accessorKey: "model",         header: "Model",  cell: ({ getValue }) => <span className={C.text}>{getValue<string>() || "—"}</span> },
    { accessorKey: "printer_type",  header: "Type",   cell: ({ getValue }) => { const v = getValue<string>(); return <span className={cn(C.text, v === "Colour" ? "text-purple-700" : "text-muted-foreground")}>{v || "—"}</span>; } },
  ];

  if (report === "not-transmitting" || report === "machine-age") {
    return [
      ...identity,
      {
        accessorKey: "last_reading_date",
        header: "Last Reading",
        enableSorting: true,
        cell: ({ getValue }) => {
          const v = getValue<string | null>();
          if (!v) return <span className="text-xs text-destructive">No data</span>;
          return <span className={C.mono}>{v}</span>;
        },
      },
      ...(report === "machine-age" ? [
        {
          accessorKey: "original_install_date",
          header: "Install Date",
          enableSorting: true,
          cell: ({ getValue }: { getValue: () => unknown }) => {
            const v = getValue() as string | null;
            return <span className={C.mono}>{v || "—"}</span>;
          },
        },
        {
          accessorKey: "age_years",
          header: "Age",
          enableSorting: true,
          meta: { align: "right" },
          cell: ({ getValue }: { getValue: () => unknown }) => {
            const v = getValue() as number | null;
            if (v == null) return <span className={C.muted}>—</span>;
            const years = Math.floor(v);
            const months = Math.round((v - years) * 12);
            const label = years > 0 ? `${years}y ${months}m` : `${months}m`;
            return <span className={cn(C.num, v >= 7 ? "text-red-600" : v >= 5 ? "text-amber-600" : "text-foreground")}>{label}</span>;
          },
        },
      ] : []),
    ];
  }

  if (report === "last-balance") {
    return [
      ...identity,
      { accessorKey: "total_rdg",         header: "Total",       enableSorting: true, meta: { align: "right" }, cell: ({ getValue }) => <span className={C.num}>{fmt(getValue<number | null>())}</span> },
      { accessorKey: "black_rdg",         header: "Mono A4",     enableSorting: true, meta: { align: "right" }, cell: ({ getValue }) => <span className={C.num}>{fmt(getValue<number | null>())}</span> },
      { accessorKey: "black_large_rdg",   header: "Mono A3",     enableSorting: true, meta: { align: "right" }, cell: ({ getValue }) => <span className={C.num}>{fmt(getValue<number | null>())}</span> },
      { accessorKey: "color_rdg",         header: "Colour A4",   enableSorting: true, meta: { align: "right" }, cell: ({ getValue }) => <span className={C.num}>{fmt(getValue<number | null>())}</span> },
      { accessorKey: "color_large_rdg",   header: "Colour A3",   enableSorting: true, meta: { align: "right" }, cell: ({ getValue }) => <span className={C.num}>{fmt(getValue<number | null>())}</span> },
      { accessorKey: "last_reading_date", header: "Last Reading",  enableSorting: true, cell: ({ getValue }) => <span className={C.mono}>{getValue<string | null>() || "—"}</span> },
    ];
  }

  if (report === "monthly-volume") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const monthCols: ColumnDef<any>[] = (months ?? []).map((m) => ({
      accessorKey: m,
      header: () => {
        try {
          const [year, month] = m.split("-");
          return new Date(Number(year), Number(month) - 1, 1).toLocaleString("en-ZA", { month: "long", year: "numeric" });
        } catch { return m; }
      },
      enableSorting: true,
      meta: { align: "right" },
      cell: ({ getValue }: { getValue: () => unknown }) => (
        <span className={C.num}>{fmt(getValue() as number | null)}</span>
      ),
    }));
    return [
      { accessorKey: "store",        header: "Store",  cell: ({ getValue }) => <span className={C.bold}>{getValue<string | null>() || "—"}</span> },
      { accessorKey: "companyGroup", header: "Group",  cell: ({ getValue }) => <span className={C.text}>{getValue<string | null>() || "—"}</span> },
      { accessorKey: "serialNumber", header: "Serial", cell: ({ getValue }) => <span className={C.mono}>{getValue<string>() || "—"}</span> },
      { accessorKey: "model",        header: "Model",  cell: ({ getValue }) => <span className={C.text}>{getValue<string>() || "—"}</span> },
      ...monthCols,
    ];
  }

  if (report === "no-data") {
    return [
      ...identity,
      {
        accessorKey: "in_bms",
        header: "In BMS",
        cell: ({ getValue }: { getValue: () => unknown }) => {
          const v = getValue() as boolean;
          return v
            ? <span className="text-xs text-green-700">Yes</span>
            : <span className="text-xs text-red-600">No — query Xerox</span>;
        },
      },
    ];
  }

  if (report === "daily") {
    // dates[] is newest-first; we want oldest-first for left-to-right column order
    const orderedDates = [...(months ?? [])].reverse();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dateCols: ColumnDef<any>[] = orderedDates.map((d) => {
      const label = (() => {
        try {
          const [y, mo, day] = d.split("-");
          return new Date(Number(y), Number(mo) - 1, Number(day)).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
        } catch { return d; }
      })();
      return {
        accessorKey: `vol_${d}`,
        header: label,
        enableSorting: true,
        meta: { align: "right" },
        cell: ({ getValue }: { getValue: () => unknown }) => {
          const v = getValue() as number | null;
          return <span className={C.num}>{v != null ? fmt(v) : <span className={C.muted}>—</span>}</span>;
        },
      };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const totalCol: ColumnDef<any> = {
      id: "period_total",
      header: "7-Day Total",
      enableSorting: true,
      sortingFn: (a, b, colId) => {
        const av = a.getValue(colId) as number | null;
        const bv = b.getValue(colId) as number | null;
        if (av === null && bv === null) return 0;
        if (av === null) return 1;
        if (bv === null) return -1;
        return av - bv;
      },
      meta: { align: "right" },
      accessorFn: (row: Record<string, unknown>) => {
        let sum = 0;
        let hasAny = false;
        for (const d of orderedDates) {
          const v = row[`vol_${d}`];
          if (v != null) { sum += Number(v); hasAny = true; }
        }
        return hasAny ? sum : null;
      },
      cell: ({ getValue }: { getValue: () => unknown }) => {
        const v = getValue() as number | null;
        return <span className={cn(C.num, "font-medium")}>{v != null ? fmt(v) : <span className={C.muted}>—</span>}</span>;
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const balanceCol: ColumnDef<any> = {
      accessorKey: "latest_balance",
      header: "Last Reading",
      enableSorting: true,
      meta: { align: "right" },
      cell: ({ getValue }: { getValue: () => unknown }) => {
        const v = getValue() as number | null;
        return <span className={cn(C.num, "font-semibold")}>{v != null ? fmt(v) : <span className={C.muted}>—</span>}</span>;
      },
    };

    return [...identity, ...dateCols, totalCol, balanceCol];
  }

  if (report === "bms-machines") {
    return [
      { accessorKey: "store",          header: "Store",        cell: ({ getValue }) => <span className={C.bold}>{getValue<string | null>() || "—"}</span> },
      { accessorKey: "company_group",  header: "Group",        cell: ({ getValue }) => <span className={C.text}>{getValue<string | null>() || "—"}</span> },
      { accessorKey: "serial_number",  header: "Serial",       cell: ({ getValue }) => <span className={C.mono}>{getValue<string>() || "—"}</span> },
      { accessorKey: "printer_type",   header: "Type",         cell: ({ getValue }) => { const v = getValue<string | null>(); return <span className={cn(C.text, v === "Colour" ? "text-purple-700" : "text-muted-foreground")}>{v || "—"}</span>; } },
      { accessorKey: "model",          header: "Model",        cell: ({ getValue }) => <span className={C.text}>{getValue<string | null>() || "—"}</span> },
      {
        accessorKey: "bms_status",
        header: "BMS Status",
        cell: ({ getValue }: { getValue: () => unknown }) => {
          const v = getValue() as number | null;
          if (v === null) return <span className={C.muted}>—</span>;
          return v === 1
            ? <span className="text-xs text-green-700">Active</span>
            : <span className="text-xs text-muted-foreground">Inactive</span>;
        },
      },
      {
        accessorKey: "in_xerox",
        header: "In Xerox",
        cell: ({ getValue }: { getValue: () => unknown }) => {
          const v = getValue() as boolean;
          return v
            ? <span className="text-xs text-green-700">Yes</span>
            : <span className="text-xs text-red-600">No</span>;
        },
      },
      {
        accessorKey: "in_bms",
        header: "In BMS",
        cell: ({ getValue }: { getValue: () => unknown }) => {
          const v = getValue() as boolean;
          return v
            ? <span className="text-xs text-green-700">Yes</span>
            : <span className="text-xs text-red-600">No</span>;
        },
      },
      {
        accessorKey: "has_readings",
        header: "Xerox Readings",
        cell: ({ getValue }: { getValue: () => unknown }) => {
          const v = getValue() as boolean;
          return v
            ? <span className="text-xs text-green-700">Yes</span>
            : <span className="text-xs text-red-600">No</span>;
        },
      },
    ];
  }

  if (report === "reading-frequency") {
    return [
      ...identity,
      {
        accessorKey: "unique_readings",
        header: "Unique Readings",
        enableSorting: true,
        meta: { align: "right" },
        cell: ({ getValue }: { getValue: () => unknown }) => {
          const v = Number(getValue());
          return <span className={C.num}>{v.toLocaleString("en-ZA")}</span>;
        },
      },
      {
        accessorKey: "days_in_range",
        header: "Days in Range",
        enableSorting: true,
        meta: { align: "right" },
        cell: ({ getValue }: { getValue: () => unknown }) => {
          const v = getValue() as string | null;
          return <span className={C.num}>{v ? Number(v).toLocaleString("en-ZA") : "—"}</span>;
        },
      },
      { accessorKey: "first_reading_date", header: "First Reading", enableSorting: true, cell: ({ getValue }: { getValue: () => unknown }) => <span className={C.mono}>{(getValue() as string | null) || "—"}</span> },
      { accessorKey: "last_reading_date",  header: "Last Reading",  enableSorting: true, cell: ({ getValue }: { getValue: () => unknown }) => <span className={C.mono}>{(getValue() as string | null) || "—"}</span> },
      {
        accessorKey: "success_rate",
        header: "% of Reports",
        enableSorting: true,
        meta: { align: "right" },
        cell: ({ getValue }: { getValue: () => unknown }) => {
          const v = getValue() as string | null;
          if (!v) return <span className={C.muted}>—</span>;
          const n = Number(v);
          const colour = n >= 80 ? "text-green-700" : n >= 50 ? "text-amber-600" : "text-red-600";
          return <span className={cn(C.num, colour)}>{n}%</span>;
        },
      },
    ];
  }

  return identity;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function formatRange(from: string, to: string): string {
  try {
    const f = new Date(from + "T00:00:00");
    const t = new Date(to + "T00:00:00");
    if (from === to) return format(f, "d MMM yyyy");
    if (f.getFullYear() === t.getFullYear()) return `${format(f, "d MMM")} – ${format(t, "d MMM yyyy")}`;
    return `${format(f, "d MMM yyyy")} – ${format(t, "d MMM yyyy")}`;
  } catch { return `${from} – ${to}`; }
}

const PRESETS = [
  { label: "Last 7 days",  get: () => ({ from: addDays(new Date(), -7),  to: new Date() }) },
  { label: "Last 30 days", get: () => ({ from: addDays(new Date(), -30), to: new Date() }) },
  { label: "Last 90 days", get: () => ({ from: addDays(new Date(), -90), to: new Date() }) },
  { label: "This month",   get: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  { label: "Last month",   get: () => { const p = subMonths(new Date(), 1); return { from: startOfMonth(p), to: endOfMonth(p) }; } },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function XeroxReportingPage() {
  const [activeReport, setActiveReport] = useState<ReportType>("live");

  const [range, setRange] = useState<DateRange>({ from: addDays(new Date(), -30), to: new Date() });
  const [appliedRange, setAppliedRange] = useState(range);
  const [calOpen, setCalOpen] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [totalReportDays, setTotalReportDays] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Column visibility — controlled in page
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => loadColumnVisibility("live"));
  // Column filters + sorting — controlled in page so bookmarks can capture/restore them
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  // tableKey — increment to remount DataTable (e.g. after loading a bookmark)
  const [tableKey, setTableKey] = useState(0);

  // Bookmarks (saved views)
  const [savedViews, setSavedViews] = useState<SavedViewsStore>(() => loadSavedViews());
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [newViewName, setNewViewName] = useState("");

  const appliedFrom = appliedRange.from ? format(appliedRange.from, "yyyy-MM-dd") : "";
  const appliedTo   = appliedRange.to   ? format(appliedRange.to,   "yyyy-MM-dd") : "";

  // ── Pipeline status ──
  const [pipelineStatus, setPipelineStatus] = useState<{
    found: boolean;
    status?: string;
    endTime?: number;
    error?: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/xerox-reporting/pipeline-status")
      .then((r) => r.json())
      .then((d) => setPipelineStatus(d))
      .catch(() => setPipelineStatus({ found: false, error: "Unreachable" }));
  }, []);

  // ── When activeReport changes, reset filters/sort and load column visibility ──
  useEffect(() => {
    const vis = loadColumnVisibility(activeReport);
    setColumnVisibility(vis);
    setColumnFilters([]);
    setSorting([]);
    setGlobalFilter("");
    setActiveViewId(null);
    setShowSaveInput(false);
  }, [activeReport]);

  // ── Sync columnVisibility changes to localStorage ──
  useEffect(() => {
    persistColumnVisibility(activeReport, columnVisibility);
  }, [activeReport, columnVisibility]);

  // ── Fetch ──
  const fetchData = useCallback(async (report: ReportType, from: string, to: string) => {
    setIsLoading(true);
    setError(null);
    try {
      let url: string;
      if (report === "live") {
        url = `/api/xerox-reporting?from=${from}&to=${to}`;
      } else {
        url = `/api/xerox-reporting/prebuilt?report=${report}`;
      }
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      const j = json as { data?: unknown[]; months?: string[]; dates?: string[]; totalReportDays?: number };
      setData(j.data ?? []);
      setMonths(j.months ?? j.dates ?? []);
      setTotalReportDays(j.totalReportDays ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(activeReport, appliedFrom, appliedTo);
  }, [fetchData, activeReport, appliedFrom, appliedTo]);

  // ── Auto-refresh every 5 minutes ──
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(activeReport, appliedFrom, appliedTo);
      fetch("/api/xerox-reporting/pipeline-status")
        .then((r) => r.json())
        .then((d) => setPipelineStatus(d))
        .catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData, activeReport, appliedFrom, appliedTo]);

  const handleApply = useCallback(() => {
    if (range.from && range.to) { setAppliedRange(range); setCalOpen(false); }
  }, [range]);

  const applyPreset = useCallback((preset: typeof PRESETS[number]) => {
    const { from, to } = preset.get();
    const r = { from, to };
    setRange(r); setAppliedRange(r); setCalOpen(false);
  }, []);

  // ── Export ──
  const exportFileName = `xerox-${activeReport}-${appliedFrom || format(new Date(), "yyyy-MM-dd")}`;

  const handleExportCSV = useCallback(() => {
    const rows = filteredData.length ? filteredData : data;
    if (!rows.length) return;
    const headers = Object.keys(rows[0] as object);
    const csvRows = rows.map((row) => headers.map((h) => (row as Record<string, unknown>)[h] ?? ""));
    const csv = [headers.join(","), ...csvRows.map((r) => r.map((v) => `"${String(v)}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${exportFileName}.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [filteredData, data, exportFileName]);

  const handleExportExcel = useCallback(() => {
    const rows = filteredData.length ? filteredData : data;
    if (!rows.length) return;
    const ws = XLSX.utils.json_to_sheet(rows as object[]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `${exportFileName}.xlsx`);
  }, [filteredData, data, exportFileName]);

  // ── Columns ──
  const columns = useMemo(() => {
    if (activeReport === "live") return buildLiveColumns(data as LiveRow[]);
    return buildPrebuiltColumns(activeReport, months);
  }, [activeReport, data, months]);

  // ── Filters ──
  const filterColumns = useMemo(() => {
    const uniq = (arr: (string | null | undefined)[]) =>
      Array.from(new Set(arr.filter((v): v is string => !!v))).sort();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pick = (key: string) => (data as any[]).map((r) => r[key]);

    const groups   = uniq([...pick("companyGroup"), ...pick("company_group")]);
    const stores   = uniq(pick("store"));
    const models   = uniq(pick("model"));
    const types    = uniq([...pick("printerType"), ...pick("printer_type")]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = data as any[];
    const boolOpts = [{ value: "true", label: "Yes" }, { value: "false", label: "No" }];

    // no-data report uses in_bms with custom labels
    const inBmsNoDataOptions = d.some((r) => "in_bms" in r && !("in_xerox" in r))
      ? [{ value: "true", label: "Yes" }, { value: "false", label: "No — query Xerox" }]
      : [];

    const isBmsMachines = d.some((r) => "in_xerox" in r && "in_bms" in r);

    // Build candidate filters; dedup by label keeping last match so report-specific
    // keys (e.g. "store" for bms-machines) override generic fallbacks
    const candidates = [
      { key: "companyGroup",  label: "Group",      options: groups.map((v) => ({ value: v, label: v })) },
      { key: "company_group", label: "Group",      options: groups.map((v) => ({ value: v, label: v })) },
      { key: "store",         label: "Store",      options: uniq([...pick("store"), ...pick("company_name")]).map((v) => ({ value: v, label: v })) },
      { key: "model",         label: "Model",      options: uniq([...pick("model"), ...pick("model_name")]).map((v) => ({ value: v, label: v })) },
      { key: "printerType",   label: "Type",       options: types.map((v) => ({ value: v, label: v })) },
      { key: "printer_type",  label: "Type",       options: types.map((v) => ({ value: v, label: v })) },
      { key: "category",      label: "Type",       options: uniq(pick("category")).map((v) => ({ value: v, label: v })) },
      { key: "in_bms",        label: "In BMS",     options: inBmsNoDataOptions },
      { key: "bms_status",    label: "BMS Status", options: isBmsMachines ? [{ value: "1", label: "Active" }, { value: "0", label: "Inactive" }] : [] },
      { key: "in_xerox",      label: "In Xerox",        options: isBmsMachines ? boolOpts : [] },
      { key: "in_bms",        label: "In BMS",          options: isBmsMachines ? boolOpts : [] },
      { key: "has_readings",  label: "Xerox Readings",  options: isBmsMachines ? boolOpts : [] },
    ].filter((f) => f.options.length > 0);

    // Dedup by label — last entry per label wins (more specific beats generic)
    const seen = new Map<string, typeof candidates[number]>();
    for (const f of candidates) seen.set(f.label, f);
    return Array.from(seen.values());
  }, [data]);

  // ── Bookmark actions ──
  const saveView = useCallback(() => {
    const name = newViewName.trim();
    if (!name) return;
    const view: SavedView = {
      id: `view-${Date.now()}`,
      name,
      reportType: activeReport,
      columnVisibility,
      columnFilters,
      sorting,
      globalFilter,
    };
    setSavedViews((prev) => {
      const updated = [...prev, view];
      persistSavedViews(updated);
      return updated;
    });
    setActiveViewId(view.id);
    setNewViewName("");
    setShowSaveInput(false);
  }, [newViewName, activeReport, columnVisibility, columnFilters, sorting, globalFilter]);

  const loadView = useCallback((view: SavedView) => {
    // Switch report first, then restore all state
    setActiveReport(view.reportType);
    persistColumnVisibility(view.reportType, view.columnVisibility);
    setColumnVisibility(view.columnVisibility);
    setColumnFilters(view.columnFilters ?? []);
    setSorting(view.sorting ?? []);
    setGlobalFilter(view.globalFilter ?? "");
    setActiveViewId(view.id);
    setTableKey((k) => k + 1);
  }, []);

  const deleteView = useCallback((id: string) => {
    setSavedViews((prev) => {
      const updated = prev.filter((v) => v.id !== id);
      persistSavedViews(updated);
      return updated;
    });
    if (activeViewId === id) setActiveViewId(null);
  }, [activeViewId]);

  // ── Derived ──
  const currentReport = REPORT_OPTIONS.find((r) => r.id === activeReport) ?? REPORT_OPTIONS[0];
  const showDatePicker = activeReport === "live";

  const subtitle = isLoading
    ? "Loading..."
    : error
    ? "Error loading data"
    : activeReport === "live"
    ? `${data.length} printers · ${formatRange(appliedFrom, appliedTo)}`
    : activeReport === "reading-frequency" && totalReportDays != null
    ? `${data.length} machines · ${totalReportDays} total report days received`
    : `${data.length} rows`;

  // ── Column visibility panel helpers ──
  // Derive column id + label from ColumnDef array
  const columnPanelItems = useMemo(() => {
    return columns
      .map((col) => {
        const id =
          ("accessorKey" in col && typeof col.accessorKey === "string" ? col.accessorKey : null) ??
          ("id" in col && typeof col.id === "string" ? col.id : null);
        if (!id) return null;
        const label =
          typeof col.header === "string"
            ? col.header
            : id.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim();
        return { id, label };
      })
      .filter((item): item is { id: string; label: string } => item !== null);
  }, [columns]);

  return (
    <AppShell>
      <div className="flex h-full gap-0 -m-6">

        {/* ── LEFT PANEL ── */}
        <div className="w-56 shrink-0 border-r flex flex-col bg-card overflow-y-auto">

          {/* Title */}
          <div className="px-4 py-3 border-b">
            <p className="text-sm font-semibold text-foreground">Xerox Reporting</p>
          </div>

          {/* Report nav */}
          <div className="p-3 border-b">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Reports</p>
            {REPORT_OPTIONS.map((r) => (
              <button
                key={r.id}
                onClick={() => setActiveReport(r.id)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors mb-0.5",
                  activeReport === r.id
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:bg-blue-50 hover:text-blue-700"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Bookmarks */}
          <div className="p-3 border-b flex-1">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Bookmarks</p>
              <button
                onClick={() => setShowSaveInput((v) => !v)}
                className="text-[10px] text-blue-600 hover:underline"
              >
                + Save current
              </button>
            </div>

            {showSaveInput && (
              <div className="flex gap-1 mb-2">
                <input
                  autoFocus
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveView();
                    if (e.key === "Escape") setShowSaveInput(false);
                  }}
                  placeholder="Bookmark name..."
                  className="flex-1 text-xs border rounded px-2 py-1 h-7 bg-background"
                />
                <button onClick={saveView} className="text-xs bg-blue-600 text-white px-2 rounded h-7">
                  Save
                </button>
              </div>
            )}

            {savedViews.map((view) => (
              <div
                key={view.id}
                className={cn(
                  "flex items-start gap-1 group px-2 py-1.5 rounded-md cursor-pointer",
                  activeViewId === view.id
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-50"
                )}
                onClick={() => loadView(view)}
              >
                <div className="flex-1 min-w-0">
                  <p className={cn("text-xs font-medium truncate", activeViewId === view.id ? "text-blue-700" : "text-gray-700")}>{view.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {REPORT_OPTIONS.find((r) => r.id === view.reportType)?.label ?? view.reportType}
                    {view.columnFilters.length > 0 && ` · ${view.columnFilters.length} filter${view.columnFilters.length > 1 ? "s" : ""}`}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteView(view.id); }}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity text-base leading-none mt-0.5 shrink-0"
                >
                  ×
                </button>
              </div>
            ))}

            {savedViews.length === 0 && !showSaveInput && (
              <p className="text-[10px] text-muted-foreground px-2">No bookmarks yet — filter a report and save it</p>
            )}
          </div>

          {/* Column visibility */}
          <div className="p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Columns</p>
            <div className="space-y-0.5">
              {columnPanelItems.map(({ id, label }) => {
                const visible = columnVisibility[id] !== false;
                return (
                  <label
                    key={id}
                    className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={(e) =>
                        setColumnVisibility((prev) => ({ ...prev, [id]: e.target.checked }))
                      }
                      className="h-3 w-3"
                    />
                    <span className="text-xs text-gray-600 truncate">{label}</span>
                  </label>
                );
              })}
            </div>
            <button
              onClick={() => setColumnVisibility({})}
              className="w-full text-[10px] text-muted-foreground hover:text-foreground text-center pt-2 border-t mt-2"
            >
              Show all
            </button>
          </div>
        </div>

        {/* ── MAIN AREA ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 px-4 py-3 overflow-hidden">

          {/* Top bar */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">{currentReport.label}</h1>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>

            <div className="flex items-center gap-2">
              {/* Pipeline status card */}
              {pipelineStatus && (
                <div className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs",
                  pipelineStatus.found && pipelineStatus.status === "SUCCESS"
                    ? "bg-green-50 border-green-200 text-green-800"
                    : pipelineStatus.found && pipelineStatus.status === "FAILURE"
                    ? "bg-red-50 border-red-200 text-red-800"
                    : "bg-gray-50 border-gray-200 text-gray-500"
                )}>
                  <span className={cn(
                    "h-1.5 w-1.5 rounded-full shrink-0",
                    pipelineStatus.found && pipelineStatus.status === "SUCCESS" ? "bg-green-500" :
                    pipelineStatus.found && pipelineStatus.status === "FAILURE" ? "bg-red-500" : "bg-gray-400"
                  )} />
                  <span className="font-medium">Last Xerox Automation</span>
                  <span className="text-[11px] opacity-75">
                    {pipelineStatus.found && pipelineStatus.endTime
                      ? format(new Date(pipelineStatus.endTime * 1000), "d MMM yyyy, HH:mm")
                      : "No runs found"}
                  </span>
                  {pipelineStatus.found && pipelineStatus.status && pipelineStatus.status !== "SUCCESS" && (
                    <span className="font-semibold uppercase tracking-wide text-[10px]">{pipelineStatus.status}</span>
                  )}
                </div>
              )}

              {showDatePicker && (
              <Popover open={calOpen} onOpenChange={setCalOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 min-w-[180px] justify-start">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                    {appliedRange.from && appliedRange.to
                      ? formatRange(format(appliedRange.from, "yyyy-MM-dd"), format(appliedRange.to, "yyyy-MM-dd"))
                      : "Pick a date range"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <div className="flex">
                    <div className="flex flex-col gap-0.5 p-2 border-r w-36">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1">Quick select</p>
                      {PRESETS.map((p) => (
                        <button
                          key={p.label}
                          className="text-left text-xs px-2 py-1.5 rounded hover:bg-muted transition-colors"
                          onClick={() => applyPreset(p)}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <div className="p-2">
                      <Calendar
                        mode="range"
                        selected={range}
                        onSelect={(r) => { if (r) setRange(r); }}
                        numberOfMonths={2}
                        disabled={{ after: new Date() }}
                      />
                      <div className="flex justify-end gap-2 pt-2 border-t mt-1 px-3 pb-1">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setCalOpen(false)}>Cancel</Button>
                        <Button size="sm" className="h-7 text-xs" disabled={!range.from || !range.to} onClick={handleApply}>Apply</Button>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                    <Download className="h-3.5 w-3.5" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportExcel}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Excel (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportCSV}>
                    <Download className="h-4 w-4 mr-2" />
                    CSV (.csv)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Table */}
          {isLoading && data.length === 0 ? (
            <PageLoading variant="table" />
          ) : (
            <DataTable
              key={tableKey}
              columns={columns}
              data={data}
              tableId={`xerox-reporting-${activeReport}`}
              searchPlaceholder="Search serial, store, group, model..."
              filterColumns={filterColumns}
              exportFileName={`xerox-${activeReport}-${appliedFrom}-${appliedTo}`}
              pageSize={99999}
              isLoading={isLoading && data.length === 0}
              hideViewsToolbar
              externalColumnVisibility={columnVisibility}
              onExternalColumnVisibilityChange={(v) => setColumnVisibility(v)}
              externalColumnFilters={columnFilters}
              onExternalColumnFiltersChange={setColumnFilters}
              onFilteredDataChange={setFilteredData}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}
