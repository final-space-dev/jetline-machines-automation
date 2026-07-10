"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Upload, Loader2 } from "lucide-react";

interface ReconRow {
  serialNumber: string;
  printType: string;
  lineDescription: string | null;
  lineIndex: number;
  bmsStore: string | null;
  xeroxStore: string | null;
  companyGroup: string | null;
  modelName: string | null;
  categoryName: string | null;
  bmsVolume: number | null;
  xeroxVolume: number;
  volumeDiff: number | null;
  bmsBalance: number | null;
  xeroxBalance: number | null;
  balanceDiff: number | null;
  fixedCharges: number;
  volumeCharges: number;
  xeroxCpc: number | null;
  matched: boolean;
  bmsStatus: string | null;
}

interface ReconSummary {
  totalSerials: number;
  totalRows: number;
  matched: number;
  unmatched: number;
  inactive: number;
  totalFixedCharges: number;
  totalVolumeCharges: number;
}

interface LastSync {
  completedAt: string;
  machinesProcessed: number;
  readingsProcessed: number;
}

interface DateRange {
  start: string;
  end: string;
}

function fmt(n: number | null | undefined) {
  if (n == null) return "\u2014";
  return Math.round(n).toLocaleString("en-ZA", { maximumFractionDigits: 0 });
}

function fmtRand(n: number) {
  if (n === 0) return "\u2014";
  return `R${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[parseInt(m) - 1]} ${y}`;
}

const columns: ColumnDef<ReconRow>[] = [
  {
    accessorKey: "bmsStore",
    header: "BMS Store",
    cell: ({ row }) => row.original.bmsStore || <span className="text-muted-foreground">{"\u2014"}</span>,
  },
  {
    accessorKey: "companyGroup",
    header: "Group",
    cell: ({ row }) => row.getValue("companyGroup") || "\u2014",
  },
  {
    accessorKey: "serialNumber",
    header: "Serial",
    cell: ({ row }) => <span className="font-mono">{row.getValue("serialNumber")}</span>,
  },
  {
    accessorKey: "printType",
    header: "Size",
    cell: ({ row }) => <span className="text-xs">{row.original.printType}</span>,
  },
  {
    accessorKey: "lineDescription",
    header: "Charge Item",
    cell: ({ row }) => <span className="text-xs">{row.original.lineDescription || "\u2014"}</span>,
  },
  {
    accessorKey: "modelName",
    header: "Model",
    cell: ({ row }) => row.getValue("modelName") || "\u2014",
  },
  {
    accessorKey: "categoryName",
    header: "Type",
    cell: ({ row }) => row.getValue("categoryName") || "\u2014",
  },
  {
    accessorKey: "bmsBalance",
    header: "BMS Bal",
    cell: ({ row }) => (
      <span className="font-mono text-right block">{fmt(row.original.bmsBalance)}</span>
    ),
  },
  {
    accessorKey: "xeroxBalance",
    header: "Xerox Bal",
    cell: ({ row }) => (
      <span className="font-mono text-right block">{fmt(row.original.xeroxBalance)}</span>
    ),
  },
  {
    accessorKey: "balanceDiff",
    header: "Bal Diff",
    cell: ({ row }) => {
      const diff = row.original.balanceDiff;
      if (diff == null) return <span className="text-muted-foreground">{"\u2014"}</span>;
      const color = diff !== 0 ? "text-red-600" : "";
      return <span className={`font-mono font-medium ${color}`}>{fmt(diff)}</span>;
    },
  },
  {
    accessorKey: "bmsVolume",
    header: "BMS Vol",
    cell: ({ row }) => (
      <span className="font-mono text-right block">{fmt(row.getValue("bmsVolume"))}</span>
    ),
  },
  {
    accessorKey: "xeroxVolume",
    header: "Xerox Vol",
    cell: ({ row }) => (
      <span className="font-mono text-right block">{fmt(row.getValue("xeroxVolume"))}</span>
    ),
  },
  {
    accessorKey: "volumeDiff",
    header: "Vol Diff",
    cell: ({ row }) => {
      const diff = row.original.volumeDiff;
      if (diff == null) return <span className="text-muted-foreground">{"\u2014"}</span>;
      const color = diff !== 0 ? "text-red-600" : "";
      return <span className={`font-mono font-medium ${color}`}>{fmt(diff)}</span>;
    },
  },
  {
    accessorKey: "fixedCharges",
    header: "Fixed",
    cell: ({ row }) => (
      <span className="font-mono text-right block text-blue-700 font-medium">
        {fmtRand(row.original.fixedCharges)}
      </span>
    ),
  },
  {
    accessorKey: "volumeCharges",
    header: "Vol Charges",
    cell: ({ row }) => (
      <span className="font-mono text-right block text-green-700 font-medium">
        {fmtRand(row.original.volumeCharges)}
      </span>
    ),
  },
  {
    accessorKey: "matched",
    header: "In BMS?",
    cell: ({ row }) => {
      const matched = row.getValue("matched") as boolean;
      return (
        <Badge
          variant="outline"
          className={
            matched
              ? "bg-emerald-50 text-emerald-700 text-[10px]"
              : "bg-red-50 text-red-700 text-[10px]"
          }
        >
          {matched ? "Yes" : "NO"}
        </Badge>
      );
    },
  },
];

export default function VolumeReconPage() {
  const [months, setMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [data, setData] = useState<ReconRow[]>([]);
  const [summary, setSummary] = useState<ReconSummary | null>(null);
  const [lastSync, setLastSync] = useState<LastSync | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMonths = useCallback(async () => {
    try {
      const res = await fetch("/api/recon");
      const json = await res.json();
      const m = json.months ?? [];
      setMonths(m);
      return m;
    } catch {
      return [];
    }
  }, []);

  const fetchRecon = useCallback(async (month: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/recon?month=${month}`);
      const json = await res.json();
      setData(json.data ?? []);
      setSummary(json.summary ?? null);
      setLastSync(json.lastSync ?? null);
      setDateRange(json.dateRange ?? null);
    } catch (err) {
      console.error("Recon fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMonths().then((m) => {
      if (m.length > 0) {
        setSelectedMonth(m[0]);
        fetchRecon(m[0]);
      } else {
        setLoading(false);
      }
    });
  }, [fetchMonths, fetchRecon]);

  useEffect(() => {
    if (selectedMonth) {
      fetchRecon(selectedMonth);
    }
  }, [selectedMonth, fetchRecon]);

  const handleImport = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/recon/import", { method: "POST", body: formData });
      const json = await res.json();
      if (res.ok) {
        setImportResult(
          `Imported ${json.recordsUpserted} records from ${json.sheetsProcessed} sheets` +
            (json.unmatchedSerials?.length > 0
              ? ` (${json.unmatchedSerials.length} serials not in BMS)`
              : ""),
        );
        const m = await fetchMonths();
        if (m.length > 0) {
          setSelectedMonth(m[0]);
          fetchRecon(m[0]);
        }
      } else {
        setImportResult(`Error: ${json.error}`);
      }
    } catch (err) {
      setImportResult(`Error: ${String(err)}`);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const totals = useMemo(() => {
    let xerox = 0, fixed = 0, volume = 0;
    data.forEach((r) => {
      xerox += r.xeroxVolume;
      fixed += r.fixedCharges;
      volume += r.volumeCharges;
    });
    return { xerox, fixed, volume, rows: data.length };
  }, [data]);

  const filterOptions = useMemo(() => {
    const groups = new Set<string>();
    const bmsStores = new Set<string>();
    const models = new Set<string>();
    const categories = new Set<string>();
    const printTypes = new Set<string>();
    const lineDescs = new Set<string>();
    data.forEach((r) => {
      if (r.companyGroup) groups.add(r.companyGroup);
      if (r.bmsStore) bmsStores.add(r.bmsStore);
      if (r.modelName) models.add(r.modelName);
      if (r.categoryName) categories.add(r.categoryName);
      if (r.printType) printTypes.add(r.printType);
      if (r.lineDescription) lineDescs.add(r.lineDescription);
    });
    return {
      groups: Array.from(groups).sort().map((v) => ({ value: v, label: v })),
      bmsStores: Array.from(bmsStores).sort().map((v) => ({ value: v, label: v })),
      models: Array.from(models).sort().map((v) => ({ value: v, label: v })),
      categories: Array.from(categories).sort().map((v) => ({ value: v, label: v })),
      printTypes: Array.from(printTypes).sort().map((v) => ({ value: v, label: v })),
      lineDescs: Array.from(lineDescs).sort().map((v) => ({ value: v, label: v })),
    };
  }, [data]);

  if (loading && months.length === 0) {
    return (
      <AppShell>
        <PageLoading variant="table" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">
              Volume Recon{selectedMonth ? `: ${formatMonthLabel(selectedMonth)}` : ""}
            </h1>
            {summary && (
              <p className="text-xs text-muted-foreground">
                BMS vs Xerox &middot; {summary.totalSerials} serials &middot; {summary.matched} matched &middot; {summary.unmatched} not in BMS
                {summary.inactive > 0 && (
                  <span className="text-muted-foreground ml-1">
                    &middot; {summary.inactive} inactive excluded
                  </span>
                )}
                {dateRange && (
                  <span className="ml-2">
                    &middot; BMS period: {dateRange.start} to {dateRange.end}
                  </span>
                )}
              </p>
            )}
            {lastSync && (
              <p className="text-[10px] text-muted-foreground/70">
                Last BMS sync: {new Date(lastSync.completedAt).toLocaleString()} ({lastSync.machinesProcessed} machines, {lastSync.readingsProcessed.toLocaleString()} readings)
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {months.length > 0 && (
              <Select value={selectedMonth ?? ""} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m} value={m}>
                      {formatMonthLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImport(file);
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Upload className="h-3 w-3 mr-1" />
              )}
              {importing ? "Importing..." : "Import Xerox Data"}
            </Button>
          </div>
        </div>

        {importResult && (
          <div className={`text-xs px-3 py-2 rounded-md border ${importResult.startsWith("Error") ? "bg-red-50 text-red-700 border-red-200" : "bg-green-50 text-green-700 border-green-200"}`}>
            {importResult}
          </div>
        )}

        {months.length === 0 && !loading ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-sm">No billing data imported yet.</p>
            <p className="text-xs mt-1">Click &quot;Import Xerox Data&quot; to upload an Excel file.</p>
          </div>
        ) : (
          <>
            <div className="px-3 py-2 rounded-md border bg-muted/30 text-xs font-mono inline-flex items-center gap-6">
              <div><span className="text-muted-foreground mr-1">Rows:</span>{totals.rows.toLocaleString()}</div>
              <div><span className="text-muted-foreground mr-1">Xerox Vol:</span>{totals.xerox.toLocaleString()}</div>
              <div><span className="text-muted-foreground mr-1">Fixed:</span><span className="text-blue-700 font-medium">{fmtRand(totals.fixed)}</span></div>
              <div><span className="text-muted-foreground mr-1">Vol Charges:</span><span className="text-green-700 font-medium">{fmtRand(totals.volume)}</span></div>
            </div>

            {loading ? (
              <PageLoading variant="table" />
            ) : (
              <DataTable
                columns={columns}
                data={data}
                tableId="volume-recon"
                searchPlaceholder="Search serial, store, model..."
                filterColumns={[
                  { key: "companyGroup", label: "Group", options: filterOptions.groups },
                  { key: "bmsStore", label: "BMS Store", options: filterOptions.bmsStores },
                  { key: "printType", label: "Size", options: filterOptions.printTypes },
                  { key: "lineDescription", label: "Charge Item", options: filterOptions.lineDescs },
                  { key: "modelName", label: "Model", options: filterOptions.models },
                  { key: "categoryName", label: "Type", options: filterOptions.categories },
                  {
                    key: "matched",
                    label: "In BMS",
                    options: [
                      { value: "true", label: "Yes" },
                      { value: "false", label: "No" },
                    ],
                  },
                ]}
                exportFileName={`volume-recon-${selectedMonth}`}
                pageSize={99999}
                getRowClassName={(row: ReconRow) => {
                  if (!row.matched) return "bg-red-50/50";
                  return "";
                }}
              />
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
