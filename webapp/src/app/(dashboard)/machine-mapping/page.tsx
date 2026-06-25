"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Download,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface XeroxMachine {
  printer_id: number;
  serial_number: string;
  model: string;
  store: string | null;
  company_group: string | null;
  printer_type: string | null;
  reporting_enabled: boolean | null;
  latest_reading_date: string | null;
  bms_found: boolean;
  bms_active: boolean | null;
  bms_company: string | null;
}

interface Company {
  id: string;
  name: string;
  group: string | null;
}

interface MappingForm {
  store: string;
  company_group: string;
  printer_type: string;
}

type SortKey = "serial_number" | "model" | "store" | "company_group" | "latest_reading_date" | "bms_active";
type SortDir = "asc" | "desc";

type QuickFilter =
  | "all"
  | "unmapped"           // no store AND no group
  | "mapped"             // has store or group
  | "no_bms"             // not found in BMS at all
  | "bms_inactive"       // in BMS but inactive
  | "bms_mismatch"       // mapped to a store but BMS company name doesn't match
  | "off"                // reporting disabled
  | "no_readings";       // never sent a reading

const PRINTER_TYPES = ["Colour", "Black and White", "Plan"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.floor(ms / 86_400_000);
}

function ReadingBadge({ dateStr }: { dateStr: string | null }) {
  const d = daysSince(dateStr);
  if (d === null) return <Badge variant="outline" className="text-muted-foreground font-normal">Never</Badge>;
  if (d <= 3)    return <Badge className="bg-emerald-100 text-emerald-800 border-0 font-normal">{d}d ago</Badge>;
  if (d <= 14)   return <Badge className="bg-amber-100 text-amber-800 border-0 font-normal">{d}d ago</Badge>;
  return           <Badge className="bg-red-100 text-red-800 border-0 font-normal">{d}d ago</Badge>;
}

function BmsBadge({ m }: { m: XeroxMachine }) {
  if (!m.bms_found)       return <Badge variant="outline" className="text-muted-foreground font-normal border-dashed">Not in BMS</Badge>;
  if (m.bms_active)       return <Badge className="bg-emerald-100 text-emerald-800 border-0 font-normal">BMS Active</Badge>;
  return                         <Badge className="bg-slate-100 text-slate-600 border-0 font-normal">BMS Inactive</Badge>;
}

function MappingBadge({ m }: { m: XeroxMachine }) {
  const mapped = m.store || m.company_group;
  if (!mapped) return <Badge variant="outline" className="text-amber-600 border-amber-300 font-normal">Unmapped</Badge>;
  return <Badge className="bg-blue-50 text-blue-700 border-0 font-normal">Mapped</Badge>;
}

// BMS company name contains-match heuristic
function hasBmsMismatch(m: XeroxMachine): boolean {
  if (!m.bms_found || !m.store || !m.bms_company) return false;
  const store = m.store.toLowerCase();
  const bmsCompany = m.bms_company.toLowerCase();
  return !bmsCompany.includes(store) && !store.includes(bmsCompany.split(" ").pop() ?? "");
}

// ─── Sort helpers ─────────────────────────────────────────────────────────────

function sortValue(m: XeroxMachine, key: SortKey): string | number {
  switch (key) {
    case "serial_number":      return m.serial_number ?? "";
    case "model":              return m.model ?? "";
    case "store":              return m.store ?? "￿";
    case "company_group":      return m.company_group ?? "￿";
    case "latest_reading_date":return m.latest_reading_date ?? "";
    case "bms_active":         return m.bms_found ? (m.bms_active ? 0 : 1) : 2;
  }
}

function sortMachines(machines: XeroxMachine[], key: SortKey, dir: SortDir): XeroxMachine[] {
  return [...machines].sort((a, b) => {
    const av = sortValue(a, key);
    const bv = sortValue(b, key);
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return dir === "asc" ? cmp : -cmp;
  });
}

// ─── Filter config ────────────────────────────────────────────────────────────

const FILTER_LABELS: Record<QuickFilter, string> = {
  all:          "All",
  unmapped:     "Unmapped",
  mapped:       "Mapped",
  no_bms:       "Not in BMS",
  bms_inactive: "BMS Inactive",
  bms_mismatch: "BMS Mismatch",
  off:          "Switched Off",
  no_readings:  "No Readings",
};

function matchesFilter(m: XeroxMachine, f: QuickFilter): boolean {
  switch (f) {
    case "all":          return true;
    case "unmapped":     return !m.store && !m.company_group;
    case "mapped":       return !!(m.store || m.company_group);
    case "no_bms":       return !m.bms_found;
    case "bms_inactive": return m.bms_found && m.bms_active === false;
    case "bms_mismatch": return hasBmsMismatch(m);
    case "off":          return m.reporting_enabled === false;
    case "no_readings":  return !m.latest_reading_date;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MachineMappingPage() {
  const [machines, setMachines] = useState<XeroxMachine[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<QuickFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("store");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [selected, setSelected] = useState<XeroxMachine | null>(null);
  const [form, setForm] = useState<MappingForm>({ store: "", company_group: "", printer_type: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchData = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/xerox-reporting/machines");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as {
        machines: XeroxMachine[];
        companies: Company[];
        groups: string[];
      };
      setMachines(json.machines);
      setCompanies(json.companies);
      setGroups(json.groups);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Counts per filter for the tab badges
  const filterCounts = useMemo(() => {
    const counts = {} as Record<QuickFilter, number>;
    for (const f of Object.keys(FILTER_LABELS) as QuickFilter[]) {
      counts[f] = machines.filter((m) => matchesFilter(m, f)).length;
    }
    return counts;
  }, [machines]);

  // Filtered + searched + sorted
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const base = machines.filter((m) => {
      if (!matchesFilter(m, activeFilter)) return false;
      if (!q) return true;
      return (
        (m.serial_number ?? "").toLowerCase().includes(q) ||
        (m.store ?? "").toLowerCase().includes(q) ||
        (m.company_group ?? "").toLowerCase().includes(q) ||
        (m.model ?? "").toLowerCase().includes(q) ||
        (m.bms_company ?? "").toLowerCase().includes(q)
      );
    });
    return sortMachines(base, sortKey, sortDir);
  }, [machines, activeFilter, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  }

  function openPanel(m: XeroxMachine) {
    setSelected(m);
    setForm({
      store: m.store ?? "",
      company_group: m.company_group ?? "",
      printer_type: m.printer_type ?? "",
    });
    setSaveError(null);
  }

  async function saveMapping() {
    if (!selected) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/xerox-reporting/machines", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serial_number: selected.serial_number,
          store: form.store || null,
          company_group: form.company_group || null,
          printer_type: form.printer_type || null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchData(true);
      setSelected(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function toggleReporting(m: XeroxMachine, enabled: boolean) {
    setMachines((prev) =>
      prev.map((x) => x.serial_number === m.serial_number ? { ...x, reporting_enabled: enabled } : x)
    );
    try {
      const res = await fetch("/api/xerox-reporting/machines", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serial_number: m.serial_number, reporting_enabled: enabled }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      setMachines((prev) =>
        prev.map((x) => x.serial_number === m.serial_number ? { ...x, reporting_enabled: !enabled } : x)
      );
    }
  }

  const actionNeeded = filterCounts.unmapped + filterCounts.no_bms + filterCounts.bms_inactive + filterCounts.bms_mismatch;

  function exportCSV() {
    const headers = ["Serial", "Model", "Store", "Group", "Type", "BMS Status", "BMS Store", "Mapping", "Last Reading", "Reporting"];
    const rows = filtered.map((m) => [
      m.serial_number ?? "",
      m.model ?? "",
      m.store ?? "",
      m.company_group ?? "",
      m.printer_type ?? "",
      !m.bms_found ? "Not in BMS" : m.bms_active ? "Active" : "Inactive",
      m.bms_company ?? "",
      m.store || m.company_group ? "Mapped" : "Unmapped",
      m.latest_reading_date ?? "",
      m.reporting_enabled === false ? "Off" : "On",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const filterLabel = activeFilter === "all" ? "all" : activeFilter;
    a.download = `machine-mapping-${filterLabel}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell>
      <div className="flex h-full -m-6 overflow-hidden">

        {/* ── MAIN AREA ── */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-card shrink-0">
            <div>
              <h1 className="text-base font-semibold">Machine Mapping</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {machines.length} total
                {actionNeeded > 0 && (
                  <span className="ml-2 text-amber-600 font-medium">{actionNeeded} need attention</span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={exportCSV}
                className="h-8 gap-1.5 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                Export ({filtered.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchData(true)}
                disabled={isRefreshing}
                className="h-8 gap-1.5 text-xs"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Filter tabs + Search */}
          <div className="border-b bg-card shrink-0">
            {/* Quick filter tabs — scrollable */}
            <div className="flex gap-1 px-6 pt-3 overflow-x-auto no-scrollbar">
              {(Object.keys(FILTER_LABELS) as QuickFilter[]).map((f) => {
                const count = filterCounts[f];
                const isActive = activeFilter === f;
                const isWarning = (f === "unmapped" || f === "no_bms" || f === "bms_inactive" || f === "bms_mismatch") && count > 0 && !isActive;
                return (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-t-md text-xs font-medium whitespace-nowrap border-b-2 transition-colors",
                      isActive
                        ? "border-blue-600 text-blue-700 bg-blue-50"
                        : isWarning
                          ? "border-transparent text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                          : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}
                  >
                    {FILTER_LABELS[f]}
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full font-semibold",
                      isActive ? "bg-blue-600 text-white" : isWarning ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div className="px-6 py-2.5">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search serial, store, group, model, BMS company..."
                className="h-8 text-xs max-w-sm"
              />
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                Loading...
              </div>
            ) : error ? (
              <div className="m-6 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[140px]">
                      <button onClick={() => toggleSort("serial_number")} className="flex items-center text-xs font-semibold">
                        Serial <SortIcon col="serial_number" />
                      </button>
                    </TableHead>
                    <TableHead className="w-[160px]">
                      <button onClick={() => toggleSort("model")} className="flex items-center text-xs font-semibold">
                        Model <SortIcon col="model" />
                      </button>
                    </TableHead>
                    <TableHead className="w-[150px]">
                      <button onClick={() => toggleSort("store")} className="flex items-center text-xs font-semibold">
                        Store <SortIcon col="store" />
                      </button>
                    </TableHead>
                    <TableHead className="w-[140px]">
                      <button onClick={() => toggleSort("company_group")} className="flex items-center text-xs font-semibold">
                        Group <SortIcon col="company_group" />
                      </button>
                    </TableHead>
                    <TableHead className="w-[110px] text-xs font-semibold">Type</TableHead>
                    <TableHead className="w-[120px]">
                      <button onClick={() => toggleSort("bms_active")} className="flex items-center text-xs font-semibold">
                        BMS Status <SortIcon col="bms_active" />
                      </button>
                    </TableHead>
                    <TableHead className="w-[130px] text-xs font-semibold">BMS Store</TableHead>
                    <TableHead className="w-[100px] text-xs font-semibold">Mapping</TableHead>
                    <TableHead className="w-[110px]">
                      <button onClick={() => toggleSort("latest_reading_date")} className="flex items-center text-xs font-semibold">
                        Last Reading <SortIcon col="latest_reading_date" />
                      </button>
                    </TableHead>
                    <TableHead className="w-[72px] text-xs font-semibold text-center">On/Off</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-12 text-muted-foreground text-sm">
                        No machines match the current filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((m) => {
                      const isOff = m.reporting_enabled === false;
                      const isMismatch = hasBmsMismatch(m);
                      return (
                        <TableRow
                          key={m.serial_number}
                          className={cn(isOff && "opacity-40")}
                        >
                          <TableCell className="font-mono text-xs">{m.serial_number}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{m.model || "—"}</TableCell>
                          <TableCell className="text-xs">
                            {m.store
                              ? <span className="font-medium">{m.store}</span>
                              : <span className="text-muted-foreground">—</span>
                            }
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {m.company_group || "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {m.printer_type || "—"}
                          </TableCell>
                          <TableCell><BmsBadge m={m} /></TableCell>
                          <TableCell className="text-xs">
                            {m.bms_company
                              ? <span className={cn("font-medium", isMismatch && "text-amber-600")}>{m.bms_company}</span>
                              : <span className="text-muted-foreground">—</span>
                            }
                          </TableCell>
                          <TableCell><MappingBadge m={m} /></TableCell>
                          <TableCell><ReadingBadge dateStr={m.latest_reading_date} /></TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={m.reporting_enabled !== false}
                              onCheckedChange={(v) => toggleReporting(m, v)}
                              className="scale-90"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => openPanel(m)}
                            >
                              {m.store || m.company_group ? "Edit" : "Map"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Footer count */}
          {!isLoading && !error && (
            <div className="px-6 py-2.5 border-t bg-card shrink-0 text-xs text-muted-foreground">
              Showing {filtered.length} of {machines.length} machines
            </div>
          )}
        </div>

        {/* ── MAPPING PANEL (Sheet) ── */}
        <Sheet open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
          <SheetContent side="right" className="w-[360px] sm:w-[360px] flex flex-col p-0">
            <SheetHeader className="px-5 pt-5 pb-4 border-b">
              <SheetTitle className="text-sm">
                {selected?.store ? "Edit Mapping" : "Map Machine"}
              </SheetTitle>
              <p className="text-xs font-mono text-muted-foreground">{selected?.serial_number}</p>
              {selected && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <BmsBadge m={selected} />
                  <MappingBadge m={selected} />
                  <ReadingBadge dateStr={selected.latest_reading_date} />
                </div>
              )}
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {selected && (
                <>
                  <p className="text-xs text-muted-foreground">{selected.model}</p>

                  {/* BMS info box */}
                  <div className={cn(
                    "rounded-md border px-3 py-2.5 text-xs space-y-1",
                    selected.bms_found ? "border-border bg-muted/40" : "border-dashed border-amber-300 bg-amber-50"
                  )}>
                    <p className="font-semibold text-[11px] uppercase tracking-wide text-muted-foreground">BMS Record</p>
                    {selected.bms_found ? (
                      <>
                        <p>Status: <span className={selected.bms_active ? "text-emerald-700 font-medium" : "text-slate-500"}>{selected.bms_active ? "Active" : "Inactive"}</span></p>
                        {selected.bms_company && <p>Company: <span className="font-medium">{selected.bms_company}</span></p>}
                        {hasBmsMismatch(selected) && (
                          <p className="text-amber-600 font-medium">⚠ BMS company doesn&apos;t match store name</p>
                        )}
                      </>
                    ) : (
                      <p className="text-amber-700">This serial is not in BMS. It may need to be loaded or the serial is different.</p>
                    )}
                  </div>

                  <Separator />

                  {/* Store */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Store</Label>
                    <Select
                      value={form.store || "__custom__"}
                      onValueChange={(v) => {
                        if (v !== "__custom__") setForm((f) => ({ ...f, store: v }));
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select store" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {companies.map((c) => (
                          <SelectItem key={c.id} value={c.name} className="text-xs">{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={form.store}
                      onChange={(e) => setForm((f) => ({ ...f, store: e.target.value }))}
                      placeholder="Or type a custom store name"
                      className="h-8 text-xs"
                    />
                  </div>

                  {/* Group */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Group</Label>
                    <Select
                      value={form.company_group || "__custom__"}
                      onValueChange={(v) => {
                        if (v !== "__custom__") setForm((f) => ({ ...f, company_group: v }));
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select group" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {groups.map((g) => (
                          <SelectItem key={g} value={g} className="text-xs">{g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={form.company_group}
                      onChange={(e) => setForm((f) => ({ ...f, company_group: e.target.value }))}
                      placeholder="Or type a custom group name"
                      className="h-8 text-xs"
                    />
                  </div>

                  {/* Printer Type */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Printer Type</Label>
                    <Select
                      value={form.printer_type || ""}
                      onValueChange={(v) => setForm((f) => ({ ...f, printer_type: v }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRINTER_TYPES.map((t) => (
                          <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {saveError && (
                    <p className="text-xs text-destructive">{saveError}</p>
                  )}
                </>
              )}
            </div>

            <div className="px-5 py-4 border-t flex gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => setSelected(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1 text-xs"
                onClick={saveMapping}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </SheetContent>
        </Sheet>

      </div>
    </AppShell>
  );
}
