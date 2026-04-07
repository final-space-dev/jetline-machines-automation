"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppShell } from "@/components/layout/app-shell";
import { DataTable } from "@/components/data-table/data-table";
import { PageLoading } from "@/components/ui/page-loading";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarDays } from "lucide-react";

// ---- Report registry ----
const REPORTS = [
  { id: "three-month", name: "3-Month Report" },
] as const;
type ReportId = (typeof REPORTS)[number]["id"];

// ---- 3-Month Report row type ----
interface ThreeMonthRow {
  group: string;
  store: string;
  serial: string;
  customer: string;
  product: string;
  category: string;
  installDate: string;
  type: string;
  a4EquivVol: number | null;
  effectiveCpc: number | null;
  avgCost: number | null;
  lastRdg: number | null;
}

function fmt(n: number | null | undefined) {
  if (n == null) return "\u2014";
  return Math.round(n).toLocaleString("en-ZA");
}

function fmtCpc(n: number | null | undefined) {
  if (n == null) return "\u2014";
  return `R${Number(n).toFixed(4)}`;
}

function fmtRand(n: number | null | undefined) {
  if (n == null || n === 0) return "\u2014";
  return `R${Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[parseInt(m) - 1]} ${y}`;
}

const TYPE_COLORS: Record<string, string> = {
  Colour: "bg-blue-100 text-blue-800",
  Mono: "bg-gray-100 text-gray-800",
};

const columns: ColumnDef<ThreeMonthRow>[] = [
  { accessorKey: "group", header: "Group", cell: ({ row }) => row.getValue("group") || "\u2014" },
  { accessorKey: "store", header: "Store", cell: ({ row }) => row.getValue("store") || "\u2014" },
  { accessorKey: "serial", header: "Serial", cell: ({ row }) => <span className="font-mono">{row.getValue("serial")}</span> },
  { accessorKey: "customer", header: "Customer", cell: ({ row }) => <span className="text-xs">{row.getValue("customer") || "\u2014"}</span> },
  { accessorKey: "product", header: "Product", cell: ({ row }) => <span className="text-xs">{row.getValue("product") || "\u2014"}</span> },
  { accessorKey: "category", header: "Category", cell: ({ row }) => row.getValue("category") || "\u2014" },
  { accessorKey: "installDate", header: "Install Date", cell: ({ row }) => row.getValue("installDate") || "\u2014" },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => {
      const type = row.getValue("type") as string;
      return (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[type] ?? ""}`}>
          {type}
        </span>
      );
    },
  },
  {
    accessorKey: "a4EquivVol",
    header: "A4-Equiv Vol",
    cell: ({ row }) => (
      <span className="font-mono text-right block">
        {fmt(row.original.a4EquivVol)}
      </span>
    ),
  },
  {
    accessorKey: "effectiveCpc",
    header: "Effective CPC",
    cell: ({ row }) => (
      <span className="font-mono text-right block text-xs">
        {fmtCpc(row.original.effectiveCpc)}
      </span>
    ),
  },
  {
    accessorKey: "avgCost",
    header: "Avg Cost/Mo",
    cell: ({ row }) => (
      <span className="font-mono text-right block text-green-700 font-medium">
        {fmtRand(row.original.avgCost)}
      </span>
    ),
  },
  {
    accessorKey: "lastRdg",
    header: "Last Rdg",
    cell: ({ row }) => (
      <span className="font-mono text-right block text-muted-foreground">
        {fmt(row.original.lastRdg)}
      </span>
    ),
  },
];

// ---- Main component ----
export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<ReportId>("three-month");
  const [data, setData] = useState<ThreeMonthRow[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [allMonths, setAllMonths] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const initialLoad = useRef(true);

  const fetchReport = useCallback(async (reportId: ReportId, filterMonths?: string[]) => {
    setLoading(true);
    try {
      if (reportId === "three-month") {
        const params = filterMonths && filterMonths.length > 0
          ? `?months=${filterMonths.join(",")}`
          : "";
        const res = await fetch(`/api/reports/three-month${params}`);
        const json = await res.json();
        setData(json.data ?? []);
        setMonths(json.months ?? []);
        if (json.allMonths) setAllMonths(json.allMonths);
      }
    } catch (err) {
      console.error("Report fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load — no month filter
  useEffect(() => {
    if (initialLoad.current) {
      initialLoad.current = false;
      fetchReport(selectedReport);
    }
  }, [selectedReport, fetchReport]);

  // When selectedMonths changes (after initial load), refetch
  useEffect(() => {
    if (initialLoad.current) return;
    fetchReport(selectedReport, selectedMonths);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonths]);

  const toggleMonth = useCallback((month: string) => {
    setSelectedMonths((prev) => {
      if (prev.includes(month)) {
        return prev.filter((m) => m !== month);
      }
      return [...prev, month];
    });
  }, []);

  const filterOptions = useMemo(() => {
    const groups = new Set<string>();
    const stores = new Set<string>();
    const customers = new Set<string>();
    const products = new Set<string>();
    const categories = new Set<string>();
    const types = new Set<string>();
    data.forEach((r) => {
      if (r.group) groups.add(r.group);
      if (r.store) stores.add(r.store);
      if (r.customer) customers.add(r.customer);
      if (r.product) products.add(r.product);
      if (r.category) categories.add(r.category);
      if (r.type) types.add(r.type);
    });
    return {
      groups: Array.from(groups).sort().map((v) => ({ value: v, label: v })),
      stores: Array.from(stores).sort().map((v) => ({ value: v, label: v })),
      customers: Array.from(customers).sort().map((v) => ({ value: v, label: v })),
      products: Array.from(products).sort().map((v) => ({ value: v, label: v })),
      categories: Array.from(categories).sort().map((v) => ({ value: v, label: v })),
      types: Array.from(types).sort().map((v) => ({ value: v, label: v })),
    };
  }, [data]);

  const monthLabel = months.length > 0
    ? months.map(formatMonthLabel).join(", ")
    : "";

  const monthButtonLabel = selectedMonths.length === 0
    ? "All months (avg)"
    : selectedMonths.map(formatMonthLabel).join(", ");

  return (
    <AppShell>
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">Reports</h1>
            {months.length > 0 && selectedReport === "three-month" && (
              <p className="text-xs text-muted-foreground">
                {data.length} rows &middot; Covering: {monthLabel}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {selectedReport === "three-month" && allMonths.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {monthButtonLabel}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="end">
                  <div className="space-y-1">
                    {allMonths.map((m) => (
                      <label
                        key={m}
                        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-sm"
                      >
                        <Checkbox
                          checked={selectedMonths.includes(m)}
                          onCheckedChange={() => toggleMonth(m)}
                        />
                        {formatMonthLabel(m)}
                      </label>
                    ))}
                  </div>
                  {selectedMonths.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2 text-xs"
                      onClick={() => setSelectedMonths([])}
                    >
                      Clear (show all)
                    </Button>
                  )}
                </PopoverContent>
              </Popover>
            )}

            <Select value={selectedReport} onValueChange={(v) => setSelectedReport(v as ReportId)}>
              <SelectTrigger className="w-[200px] h-8 text-xs">
                <SelectValue placeholder="Select report" />
              </SelectTrigger>
              <SelectContent>
                {REPORTS.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <PageLoading variant="table" />
        ) : data.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-sm">No Xerox billing data available.</p>
            <p className="text-xs mt-1">Import Xerox data on the Volume Recon page first.</p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={data}
            tableId="three-month-report"
            searchPlaceholder="Search serial, store, group..."
            filterColumns={[
              { key: "group", label: "Group", options: filterOptions.groups },
              { key: "store", label: "Store", options: filterOptions.stores },
              { key: "customer", label: "Customer", options: filterOptions.customers },
              { key: "product", label: "Product", options: filterOptions.products },
              { key: "category", label: "Category", options: filterOptions.categories },
              { key: "type", label: "Type", options: filterOptions.types },
            ]}
            exportFileName="3-month-report"
            pageSize={99999}
          />
        )}
      </div>
    </AppShell>
  );
}
