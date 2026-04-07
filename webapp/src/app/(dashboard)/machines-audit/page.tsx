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
import { Upload, Loader2, AlertTriangle, CheckCircle, XCircle, ArrowLeftRight } from "lucide-react";

interface AuditRow {
  serialNumber: string;
  printType: string;
  lineDescription: string | null;
  lineIndex: number;
  inBms: boolean;
  inXerox: boolean;
  bmsStatus: string | null;
  bmsStore: string | null;
  xeroxEntity: string | null;
  entityMatch: boolean;
  bmsModel: string | null;
  xeroxProduct: string | null;
  modelMatch: boolean;
  categoryName: string | null;
  companyGroup: string | null;
  chargeItem: string | null;
  bmsCounter: string | null;
  bmsVolume: number | null;
  xeroxVolume: number | null;
  volumeDiff: number | null;
  bmsBalance: number | null;
  xeroxBalance: number | null;
  balanceDiff: number | null;
  fixedCharges: number;
  volumeCharges: number;
  totalCharges: number;
  xeroxCpc: number | null;
  anomalyCount: number;
  hasReadingDate: boolean;
  hasPreviousMonth: boolean;
}

interface AuditSummary {
  totalRows: number;
  matchedSerials: number;
  xeroxOnlySerials: number;
  entityMismatches: number;
  modelMismatches: number;
  anomalyMachines: number;
  unmappedLines: number;
  totalFixed: number;
  totalVolCharges: number;
  totalXeroxVol: number;
  totalBmsVol: number;
  volumeDiff: number;
}

interface LastSync {
  completedAt: string;
  machinesProcessed: number;
  readingsProcessed: number;
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

// Derive a "status" for each row for quick filtering
function getRowStatus(row: AuditRow): string {
  if (!row.inBms) return "xerox_only";
  if (row.anomalyCount > 0) return "anomaly";
  if (!row.entityMatch || !row.modelMatch) return "mismatch";
  if (row.volumeDiff != null && row.volumeDiff !== 0) return "vol_diff";
  return "ok";
}

function StatusBadge({ row }: { row: AuditRow }) {
  const status = getRowStatus(row);
  const styles: Record<string, string> = {
    xerox_only: "bg-red-50 text-red-700 border-red-200",
    anomaly: "bg-orange-50 text-orange-700 border-orange-200",
    mismatch: "bg-blue-50 text-blue-700 border-blue-200",
    vol_diff: "bg-yellow-50 text-yellow-700 border-yellow-200",
    ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  const labels: Record<string, string> = {
    xerox_only: "Not in BMS",
    anomaly: "Anomaly",
    mismatch: "Mismatch",
    vol_diff: "Vol Diff",
    ok: "OK",
  };
  return (
    <Badge variant="outline" className={`text-[10px] ${styles[status]}`}>
      {labels[status]}
    </Badge>
  );
}

const columns: ColumnDef<AuditRow>[] = [
  {
    accessorKey: "status",
    header: "Status",
    accessorFn: (row) => getRowStatus(row),
    cell: ({ row }) => <StatusBadge row={row.original} />,
    filterFn: "multiSelect" as never,
  },
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
    cell: ({ row }) => <span className="font-mono text-xs">{row.getValue("serialNumber")}</span>,
  },
  {
    accessorKey: "categoryName",
    header: "Type",
    cell: ({ row }) => row.getValue("categoryName") || "\u2014",
  },
  {
    accessorKey: "chargeItem",
    header: "Charge Item",
    cell: ({ row }) => <span className="text-xs">{row.original.chargeItem || "\u2014"}</span>,
  },
  {
    accessorKey: "bmsCounter",
    header: "BMS Counter",
    cell: ({ row }) => {
      const label = row.original.bmsCounter;
      if (!label) return <span className="text-muted-foreground">{"\u2014"}</span>;
      return <Badge variant="secondary" className="text-[10px] font-mono">{label}</Badge>;
    },
  },
  {
    accessorKey: "xeroxEntity",
    header: "Xerox Entity",
    cell: ({ row }) => {
      const xe = row.original.xeroxEntity;
      const em = row.original.entityMatch;
      if (!xe) return <span className="text-muted-foreground">{"\u2014"}</span>;
      return (
        <span className={!em && row.original.inBms ? "text-blue-700 font-medium" : ""}>
          {xe}
        </span>
      );
    },
  },
  {
    accessorKey: "entityMatch",
    header: "Entity Match",
    cell: ({ row }) => {
      if (!row.original.inBms || !row.original.inXerox) return "\u2014";
      return row.original.entityMatch
        ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
        : <XCircle className="h-3.5 w-3.5 text-blue-500" />;
    },
  },
  {
    accessorKey: "bmsModel",
    header: "BMS Model",
    cell: ({ row }) => <span className="text-xs">{row.original.bmsModel || "\u2014"}</span>,
  },
  {
    accessorKey: "xeroxProduct",
    header: "Xerox Model",
    cell: ({ row }) => {
      const xp = row.original.xeroxProduct;
      const mm = row.original.modelMatch;
      if (!xp) return <span className="text-muted-foreground">{"\u2014"}</span>;
      return (
        <span className={!mm && row.original.inBms ? "text-blue-700 font-medium" : "text-xs"}>
          {xp}
        </span>
      );
    },
  },
  {
    accessorKey: "modelMatch",
    header: "Model Match",
    cell: ({ row }) => {
      if (!row.original.inBms || !row.original.inXerox) return "\u2014";
      return row.original.modelMatch
        ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
        : <XCircle className="h-3.5 w-3.5 text-blue-500" />;
    },
  },
  {
    accessorKey: "bmsBalance",
    header: "BMS Bal",
    cell: ({ row }) => (
      <span className="font-mono text-xs text-right block">{fmt(row.original.bmsBalance)}</span>
    ),
  },
  {
    accessorKey: "xeroxBalance",
    header: "Xerox Bal",
    cell: ({ row }) => (
      <span className="font-mono text-xs text-right block">{fmt(row.original.xeroxBalance)}</span>
    ),
  },
  {
    accessorKey: "balanceDiff",
    header: "Bal Diff",
    cell: ({ row }) => {
      const diff = row.original.balanceDiff;
      if (diff == null) return <span className="text-muted-foreground">{"\u2014"}</span>;
      return <span className={`font-mono text-xs font-medium ${diff !== 0 ? "text-red-600" : ""}`}>{fmt(diff)}</span>;
    },
  },
  {
    accessorKey: "bmsVolume",
    header: "BMS Vol",
    cell: ({ row }) => (
      <span className="font-mono text-xs text-right block">{fmt(row.original.bmsVolume)}</span>
    ),
  },
  {
    accessorKey: "xeroxVolume",
    header: "Xerox Vol",
    cell: ({ row }) => (
      <span className="font-mono text-xs text-right block">{fmt(row.original.xeroxVolume)}</span>
    ),
  },
  {
    accessorKey: "volumeDiff",
    header: "Vol Diff",
    cell: ({ row }) => {
      const diff = row.original.volumeDiff;
      if (diff == null) return <span className="text-muted-foreground">{"\u2014"}</span>;
      return <span className={`font-mono text-xs font-medium ${diff !== 0 ? "text-red-600" : ""}`}>{fmt(diff)}</span>;
    },
  },
  {
    accessorKey: "fixedCharges",
    header: "Fixed",
    cell: ({ row }) => (
      <span className="font-mono text-xs text-right block text-blue-700 font-medium">
        {fmtRand(row.original.fixedCharges)}
      </span>
    ),
  },
  {
    accessorKey: "volumeCharges",
    header: "Vol Charges",
    cell: ({ row }) => (
      <span className="font-mono text-xs text-right block text-green-700 font-medium">
        {fmtRand(row.original.volumeCharges)}
      </span>
    ),
  },
  {
    accessorKey: "anomalyCount",
    header: "Anomalies",
    cell: ({ row }) => {
      const count = row.original.anomalyCount;
      if (count === 0) return <span className="text-muted-foreground">{"\u2014"}</span>;
      return (
        <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200">
          {count}
        </Badge>
      );
    },
  },
];

export default function MachinesAuditPage() {
  const [months, setMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [data, setData] = useState<AuditRow[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [lastSync, setLastSync] = useState<LastSync | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMonths = useCallback(async () => {
    try {
      const res = await fetch("/api/machines-audit");
      const json = await res.json();
      const m = json.months ?? [];
      setMonths(m);
      return m;
    } catch {
      return [];
    }
  }, []);

  const fetchAudit = useCallback(async (month: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/machines-audit?month=${month}`);
      const json = await res.json();
      setData(json.data ?? []);
      setSummary(json.summary ?? null);
      setLastSync(json.lastSync ?? null);
    } catch (err) {
      console.error("Audit fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMonths().then((m) => {
      if (m.length > 0) {
        setSelectedMonth(m[0]);
        fetchAudit(m[0]);
      } else {
        setLoading(false);
      }
    });
  }, [fetchMonths, fetchAudit]);

  useEffect(() => {
    if (selectedMonth) {
      fetchAudit(selectedMonth);
    }
  }, [selectedMonth, fetchAudit]);

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
          fetchAudit(m[0]);
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

  const filterOptions = useMemo(() => {
    const groups = new Set<string>();
    const stores = new Set<string>();
    const categories = new Set<string>();
    const chargeItems = new Set<string>();
    const counters = new Set<string>();
    const statuses = new Set<string>();

    data.forEach((r) => {
      if (r.companyGroup) groups.add(r.companyGroup);
      if (r.bmsStore) stores.add(r.bmsStore);
      if (r.categoryName) categories.add(r.categoryName);
      if (r.chargeItem) chargeItems.add(r.chargeItem);
      if (r.bmsCounter) counters.add(r.bmsCounter);
      statuses.add(getRowStatus(r));
    });

    const statusLabels: Record<string, string> = {
      ok: "OK",
      xerox_only: "Not in BMS",
      anomaly: "Anomaly",
      mismatch: "Mismatch",
      vol_diff: "Vol Diff",
    };

    return {
      groups: Array.from(groups).sort().map((v) => ({ value: v, label: v })),
      stores: Array.from(stores).sort().map((v) => ({ value: v, label: v })),
      categories: Array.from(categories).sort().map((v) => ({ value: v, label: v })),
      chargeItems: Array.from(chargeItems).sort().map((v) => ({ value: v, label: v })),
      counters: Array.from(counters).sort().map((v) => ({ value: v, label: v })),
      statuses: Array.from(statuses).sort().map((v) => ({ value: v, label: statusLabels[v] ?? v })),
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
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">
              Machines Audit{selectedMonth ? `: ${formatMonthLabel(selectedMonth)}` : ""}
            </h1>
            {summary && (
              <p className="text-xs text-muted-foreground">
                {summary.matchedSerials} matched
                {summary.xeroxOnlySerials > 0 && ` \u00b7 ${summary.xeroxOnlySerials} not in BMS`}
                {summary.entityMismatches > 0 && ` \u00b7 ${summary.entityMismatches} entity mismatches`}
                {summary.modelMismatches > 0 && ` \u00b7 ${summary.modelMismatches} model mismatches`}
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
              {importing ? "Importing..." : "Import Xerox"}
            </Button>
          </div>
        </div>

        {importResult && (
          <div className={`text-xs px-3 py-2 rounded-md border ${importResult.startsWith("Error") ? "bg-red-50 text-red-700 border-red-200" : "bg-green-50 text-green-700 border-green-200"}`}>
            {importResult}
          </div>
        )}

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            <SummaryCard
              label="Matched"
              value={summary.matchedSerials}
              icon={<CheckCircle className="h-3.5 w-3.5 text-emerald-500" />}
            />
            <SummaryCard
              label="Not in BMS"
              value={summary.xeroxOnlySerials}
              icon={<XCircle className="h-3.5 w-3.5 text-red-500" />}
              highlight={summary.xeroxOnlySerials > 0 ? "red" : undefined}
            />
            <SummaryCard
              label="Entity Mismatch"
              value={summary.entityMismatches}
              icon={<ArrowLeftRight className="h-3.5 w-3.5 text-blue-500" />}
              highlight={summary.entityMismatches > 0 ? "blue" : undefined}
            />
            <SummaryCard
              label="Model Mismatch"
              value={summary.modelMismatches}
              icon={<ArrowLeftRight className="h-3.5 w-3.5 text-blue-500" />}
              highlight={summary.modelMismatches > 0 ? "blue" : undefined}
            />
            <SummaryCard
              label="Anomalies"
              value={summary.anomalyMachines}
              icon={<AlertTriangle className="h-3.5 w-3.5 text-orange-500" />}
              highlight={summary.anomalyMachines > 0 ? "orange" : undefined}
            />
          </div>
        )}

        {/* Totals bar */}
        {summary && (
          <div className="px-3 py-2 rounded-md border bg-muted/30 text-xs font-mono inline-flex items-center gap-6">
            <div><span className="text-muted-foreground mr-1">Rows:</span>{summary.totalRows.toLocaleString()}</div>
            <div><span className="text-muted-foreground mr-1">BMS Vol:</span>{summary.totalBmsVol.toLocaleString()}</div>
            <div><span className="text-muted-foreground mr-1">Xerox Vol:</span>{summary.totalXeroxVol.toLocaleString()}</div>
            <div>
              <span className="text-muted-foreground mr-1">Vol Diff:</span>
              <span className={summary.volumeDiff !== 0 ? "text-red-600 font-medium" : ""}>
                {summary.volumeDiff.toLocaleString()}
              </span>
            </div>
            <div><span className="text-muted-foreground mr-1">Fixed:</span><span className="text-blue-700 font-medium">{fmtRand(summary.totalFixed)}</span></div>
            <div><span className="text-muted-foreground mr-1">Vol Charges:</span><span className="text-green-700 font-medium">{fmtRand(summary.totalVolCharges)}</span></div>
          </div>
        )}

        {months.length === 0 && !loading ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-sm">No billing data imported yet.</p>
            <p className="text-xs mt-1">Click &quot;Import Xerox&quot; to upload an Excel file.</p>
          </div>
        ) : loading ? (
          <PageLoading variant="table" />
        ) : (
          <DataTable
            columns={columns}
            data={data}
            tableId="machines-audit"
            searchPlaceholder="Search serial, store, model..."
            filterColumns={[
              { key: "status", label: "Status", options: filterOptions.statuses },
              { key: "companyGroup", label: "Group", options: filterOptions.groups },
              { key: "bmsStore", label: "BMS Store", options: filterOptions.stores },
              { key: "categoryName", label: "Type", options: filterOptions.categories },
              { key: "chargeItem", label: "Charge Item", options: filterOptions.chargeItems },
              { key: "bmsCounter", label: "BMS Counter", options: filterOptions.counters },
            ]}
            exportFileName={`machines-audit-${selectedMonth}`}
            pageSize={99999}
            getRowClassName={(row: AuditRow) => {
              const status = getRowStatus(row);
              if (status === "xerox_only") return "bg-red-50/50";
              return "";
            }}
          />
        )}
      </div>
    </AppShell>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  highlight?: "red" | "amber" | "blue" | "orange";
}) {
  const borderColor = highlight
    ? { red: "border-red-200", amber: "border-amber-200", blue: "border-blue-200", orange: "border-orange-200" }[highlight]
    : "border-border";
  const bgColor = highlight
    ? { red: "bg-red-50/50", amber: "bg-amber-50/50", blue: "bg-blue-50/50", orange: "bg-orange-50/50" }[highlight]
    : "bg-card";

  return (
    <div className={`rounded-md border px-3 py-2 ${borderColor} ${bgColor}`}>
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg font-semibold font-mono mt-0.5">{value}</p>
    </div>
  );
}
