"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { AlertTriangle, Zap, Tag, TrendingDown, TrendingUp, Undo2 } from "lucide-react";

// --- Types ---

interface AnomalyReading {
  id: string;
  bmsMeterReadingId: number | null;
  readingDate: string;
  total: number;
  dailyIncrement: number | null;
  incrementalTotal: number | null;
  isDetected: boolean;
  isTagged: boolean;
  reason: "backwards" | "spike" | null;
  pctOfBalance: number | null;
}

interface MachineAnomaly {
  machineId: string;
  serialNumber: string;
  store: string;
  companyGroup: string | null;
  model: string | null;
  category: string | null;
  anomalyCount: number;
  taggedCount: number;
  totalVolumeAffected: number;
  readings: AnomalyReading[];
}

interface AnomalySummary {
  totalMachines: number;
  totalAnomalies: number;
  totalTagged: number;
  totalVolumeAffected: number;
}

// Flat row for the table
interface FlatRow {
  id: string;
  bmsMeterReadingId: number | null;
  serialNumber: string;
  store: string;
  companyGroup: string | null;
  model: string | null;
  category: string | null;
  readingDate: string;
  total: number;
  dailyIncrement: number | null;
  incrementalTotal: number | null;
  reason: "backwards" | "spike" | null;
  pctOfBalance: number | null;
  isDetected: boolean;
  isTagged: boolean;
}

function fmt(n: number | null | undefined) {
  if (n == null) return "\u2014";
  return Math.round(n).toLocaleString("en-ZA", { maximumFractionDigits: 0 });
}

function formatMonthLabel(month: string): string {
  if (month === "all") return "All Months";
  const [y, m] = month.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[parseInt(m) - 1]} ${y}`;
}

function ReasonBadge({ reason }: { reason: FlatRow["reason"] }) {
  if (!reason) return <span className="text-muted-foreground">{"\u2014"}</span>;
  const styles: Record<string, string> = {
    backwards: "bg-red-50 text-red-700 border-red-200",
    spike: "bg-orange-50 text-orange-700 border-orange-200",
  };
  const labels: Record<string, string> = {
    backwards: "Backwards",
    spike: "Spike",
  };
  return (
    <Badge variant="outline" className={`text-[10px] ${styles[reason]}`}>
      {labels[reason]}
    </Badge>
  );
}

function TaggedBadge({ isTagged }: { isTagged: boolean }) {
  if (!isTagged) return <span className="text-xs text-muted-foreground">No</span>;
  return (
    <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
      Excluded
    </Badge>
  );
}

// --- Columns ---

function createColumns(
  selectedIds: Set<string>,
  onToggle: (id: string) => void,
  onToggleAll: (checked: boolean) => void,
  allSelectableIds: string[],
): ColumnDef<FlatRow>[] {
  return [
    {
      id: "select",
      header: () => (
        <Checkbox
          checked={selectedIds.size > 0 && selectedIds.size === allSelectableIds.length}
          onCheckedChange={(checked) => onToggleAll(!!checked)}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={selectedIds.has(row.original.id)}
          onCheckedChange={() => onToggle(row.original.id)}
        />
      ),
      size: 40,
      enableSorting: false,
    },
    {
      accessorKey: "store",
      header: "Store",
      cell: ({ row }) => <span className="text-xs font-medium">{row.original.store}</span>,
    },
    {
      accessorKey: "serialNumber",
      header: "Serial",
      cell: ({ row }) => <span className="text-xs font-mono">{row.original.serialNumber}</span>,
    },
    {
      accessorKey: "bmsMeterReadingId",
      header: "BMS ID",
      cell: ({ row }) => <span className="text-xs font-mono text-muted-foreground">{row.original.bmsMeterReadingId ?? "\u2014"}</span>,
    },
    {
      accessorKey: "model",
      header: "Model",
      cell: ({ row }) => <span className="text-xs">{row.original.model || "\u2014"}</span>,
    },
    {
      accessorKey: "readingDate",
      header: "Date",
      cell: ({ row }) => <span className="text-xs font-mono">{row.original.readingDate}</span>,
    },
    {
      accessorKey: "total",
      header: "Balance",
      cell: ({ row }) => <span className="text-xs font-mono text-right block">{fmt(row.original.total)}</span>,
    },
    {
      accessorKey: "dailyIncrement",
      header: "Movement",
      cell: ({ row }) => {
        const val = row.original.dailyIncrement;
        if (val == null) return <span className="text-muted-foreground">{"\u2014"}</span>;
        const isNeg = val < 0;
        const isSpike = row.original.reason === "spike";
        return (
          <span className={`text-xs font-mono text-right block ${isNeg ? "text-red-600 font-medium" : isSpike ? "text-orange-600 font-medium" : ""}`}>
            {isNeg ? "" : "+"}{fmt(val)}
          </span>
        );
      },
    },
    {
      accessorKey: "pctOfBalance",
      header: "% of Balance",
      cell: ({ row }) => {
        const pct = row.original.pctOfBalance;
        if (pct == null) return <span className="text-muted-foreground">{"\u2014"}</span>;
        const display = (Math.abs(pct) * 100).toFixed(1) + "%";
        const isHigh = Math.abs(pct) > 0.5;
        return (
          <span className={`text-xs font-mono text-right block ${isHigh ? "text-red-600 font-bold" : "text-orange-600 font-medium"}`}>
            {display}
          </span>
        );
      },
    },
    {
      accessorKey: "reason",
      header: "Reason",
      cell: ({ row }) => <ReasonBadge reason={row.original.reason} />,
      filterFn: "equals",
    },
    {
      accessorKey: "isTagged",
      header: "Status",
      cell: ({ row }) => <TaggedBadge isTagged={row.original.isTagged} />,
      filterFn: "equals",
    },
  ];
}

// --- Page ---

export default function AnomaliesPage() {
  const [months, setMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [data, setData] = useState<MachineAnomaly[]>([]);
  const [summary, setSummary] = useState<AnomalySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState(false);
  const [actionResult, setActionResult] = useState<string | null>(null);

  // Load months
  useEffect(() => {
    fetch("/api/anomalies")
      .then((r) => r.json())
      .then((d) => {
        setMonths(d.months ?? []);
        // Default to "all"
        if (d.months?.length > 0) setSelectedMonth("all");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Load anomaly data when month changes
  useEffect(() => {
    if (!selectedMonth) return;
    setLoading(true);
    setSelectedIds(new Set());
    setActionResult(null);
    fetch(`/api/anomalies?month=${selectedMonth}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d.data ?? []);
        setSummary(d.summary ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedMonth]);

  // Flatten data for table
  const flatRows = useMemo((): FlatRow[] => {
    const rows: FlatRow[] = [];
    for (const machine of data) {
      for (const r of machine.readings) {
        rows.push({
          id: r.id,
          bmsMeterReadingId: r.bmsMeterReadingId,
          serialNumber: machine.serialNumber,
          store: machine.store,
          companyGroup: machine.companyGroup,
          model: machine.model,
          category: machine.category,
          readingDate: r.readingDate,
          total: r.total,
          dailyIncrement: r.dailyIncrement,
          incrementalTotal: r.incrementalTotal,
          reason: r.reason,
          pctOfBalance: r.pctOfBalance,
          isDetected: r.isDetected,
          isTagged: r.isTagged,
        });
      }
    }
    return rows;
  }, [data]);

  const allSelectableIds = useMemo(() => flatRows.map((r) => r.id), [flatRows]);

  const toggleId = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(allSelectableIds));
    } else {
      setSelectedIds(new Set());
    }
  }, [allSelectableIds]);

  const handleAction = useCallback(async (action: "tag" | "untag") => {
    if (selectedIds.size === 0) return;
    const label = action === "tag" ? "Tag" : "Untag";
    const confirmed = window.confirm(
      `${label} ${selectedIds.size} reading(s)? ${action === "tag" ? "Their movement will be skipped in performance." : "Their movement will be included in performance again."}`
    );
    if (!confirmed) return;

    setActing(true);
    setActionResult(null);
    try {
      const res = await fetch("/api/anomalies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), action }),
      });
      const result = await res.json();
      if (res.ok) {
        setActionResult(result.message);
        setSelectedIds(new Set());
        if (selectedMonth) {
          const d = await fetch(`/api/anomalies?month=${selectedMonth}`).then((r) => r.json());
          setData(d.data ?? []);
          setSummary(d.summary ?? null);
        }
      } else {
        setActionResult(`Error: ${result.error}`);
      }
    } catch {
      setActionResult("Error: Network failure");
    } finally {
      setActing(false);
    }
  }, [selectedIds, selectedMonth]);

  const handleTagAllDetected = useCallback(async () => {
    const confirmed = window.confirm(
      "Tag ALL detected anomalies across ALL months? This scans every reading and tags movements >25% of balance or >7,500."
    );
    if (!confirmed) return;

    setActing(true);
    setActionResult(null);
    try {
      const res = await fetch("/api/anomalies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "tag-all-detected" }),
      });
      const result = await res.json();
      if (res.ok) {
        setActionResult(result.message);
        setSelectedIds(new Set());
        if (selectedMonth) {
          const d = await fetch(`/api/anomalies?month=${selectedMonth}`).then((r) => r.json());
          setData(d.data ?? []);
          setSummary(d.summary ?? null);
        }
      } else {
        setActionResult(`Error: ${result.error}`);
      }
    } catch {
      setActionResult("Error: Network failure");
    } finally {
      setActing(false);
    }
  }, [selectedMonth]);

  const columns = useMemo(
    () => createColumns(selectedIds, toggleId, toggleAll, allSelectableIds),
    [selectedIds, toggleId, toggleAll, allSelectableIds]
  );

  const filterOptions = useMemo(() => {
    const stores = new Set<string>();
    const groups = new Set<string>();
    const reasons = new Set<string>();
    const tagged = new Set<string>();

    flatRows.forEach((r) => {
      if (r.store) stores.add(r.store);
      if (r.companyGroup) groups.add(r.companyGroup);
      if (r.reason) reasons.add(r.reason);
      tagged.add(String(r.isTagged));
    });

    const reasonLabels: Record<string, string> = {
      backwards: "Backwards",
      spike: "Spike",
    };
    const taggedLabels: Record<string, string> = {
      true: "Excluded",
      false: "Active",
    };

    return {
      stores: Array.from(stores).sort().map((v) => ({ value: v, label: v })),
      groups: Array.from(groups).sort().map((v) => ({ value: v, label: v })),
      reasons: Array.from(reasons).sort().map((v) => ({ value: v, label: reasonLabels[v] ?? v })),
      tagged: Array.from(tagged).sort().map((v) => ({ value: v, label: taggedLabels[v] ?? v })),
    };
  }, [flatRows]);

  if (loading && months.length === 0) {
    return (
      <AppShell>
        <PageLoading variant="table" />
      </AppShell>
    );
  }

  const untaggedSelected = Array.from(selectedIds).some((id) => {
    const row = flatRows.find((r) => r.id === id);
    return row && !row.isTagged;
  });
  const taggedSelected = Array.from(selectedIds).some((id) => {
    const row = flatRows.find((r) => r.id === id);
    return row && row.isTagged;
  });
  const hasUntaggedDetected = summary ? summary.totalAnomalies > summary.totalTagged : false;

  return (
    <AppShell>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">
              Anomaly Detection{selectedMonth ? `: ${formatMonthLabel(selectedMonth)}` : ""}
            </h1>
            {summary && (
              <p className="text-xs text-muted-foreground">
                {summary.totalMachines} machines
                {" \u00b7 "}{summary.totalAnomalies} detected
                {" \u00b7 "}{summary.totalTagged} excluded
                {" \u00b7 "}{fmt(summary.totalVolumeAffected)} movement affected
              </p>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Flags: movement &gt;25% of balance OR &gt;7,500. Tag to skip movement in performance.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasUntaggedDetected && (
              <Button
                variant="default"
                size="sm"
                onClick={handleTagAllDetected}
                disabled={acting}
              >
                <Zap className="h-3.5 w-3.5 mr-1" />
                {acting ? "Processing..." : "Tag All Detected"}
              </Button>
            )}

            {selectedIds.size > 0 && untaggedSelected && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleAction("tag")}
                disabled={acting}
              >
                <Tag className="h-3.5 w-3.5 mr-1" />
                {acting ? "Tagging..." : `Tag ${selectedIds.size}`}
              </Button>
            )}

            {selectedIds.size > 0 && taggedSelected && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAction("untag")}
                disabled={acting}
              >
                <Undo2 className="h-3.5 w-3.5 mr-1" />
                {acting ? "Untagging..." : `Untag ${selectedIds.size}`}
              </Button>
            )}

            <Select value={selectedMonth ?? ""} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m} value={m} className="text-xs">
                    {formatMonthLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action result */}
        {actionResult && (
          <div className={`text-xs px-3 py-2 rounded-md border ${actionResult.startsWith("Error") ? "bg-red-50 text-red-700 border-red-200" : "bg-green-50 text-green-700 border-green-200"}`}>
            {actionResult}
          </div>
        )}

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-4 gap-2">
            <div className="px-3 py-2 rounded-md border bg-card">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                <span className="text-xs text-muted-foreground">Machines</span>
              </div>
              <p className="text-lg font-semibold mt-0.5">{summary.totalMachines}</p>
            </div>
            <div className="px-3 py-2 rounded-md border bg-card">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                <span className="text-xs text-muted-foreground">Detected</span>
              </div>
              <p className="text-lg font-semibold mt-0.5">{summary.totalAnomalies}</p>
            </div>
            <div className="px-3 py-2 rounded-md border bg-card">
              <div className="flex items-center gap-2">
                <Tag className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-xs text-muted-foreground">Excluded</span>
              </div>
              <p className="text-lg font-semibold mt-0.5">{summary.totalTagged}</p>
            </div>
            <div className="px-3 py-2 rounded-md border bg-card">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs text-muted-foreground">Movement Affected</span>
              </div>
              <p className="text-lg font-semibold mt-0.5">{fmt(summary.totalVolumeAffected)}</p>
            </div>
          </div>
        )}

        {months.length === 0 && !loading ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-sm">No meter reading data available.</p>
            <p className="text-xs mt-1">Run a BMS sync first.</p>
          </div>
        ) : loading ? (
          <PageLoading variant="table" />
        ) : flatRows.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-sm">No anomalies detected for {selectedMonth ? formatMonthLabel(selectedMonth) : "this period"}.</p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={flatRows}
            tableId="anomalies"
            searchPlaceholder="Search serial, store, model..."
            filterColumns={[
              { key: "store", label: "Store", options: filterOptions.stores },
              { key: "companyGroup", label: "Group", options: filterOptions.groups },
              { key: "reason", label: "Reason", options: filterOptions.reasons },
              { key: "isTagged", label: "Status", options: filterOptions.tagged },
            ]}
            exportFileName={`anomalies-${selectedMonth}`}
            pageSize={99999}
            getRowClassName={(row: FlatRow) => {
              if (row.isTagged) return "bg-blue-50/30 opacity-60";
              if (row.reason === "backwards") return "bg-red-50/50";
              if (row.reason === "spike") return "bg-orange-50/30";
              return "";
            }}
          />
        )}
      </div>
    </AppShell>
  );
}
