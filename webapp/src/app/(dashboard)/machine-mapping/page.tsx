"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Download,
  Search,
  X,
  MapPin,
  Pencil,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface XeroxMachine {
  printer_id: number;
  serial_number: string;
  model: string;
  model_name: string | null;
  store: string | null;
  company_group: string | null;
  printer_type: string | null;
  reporting_enabled: boolean | null;
  latest_reading_date: string | null;
  last_seen: string | null;
  bms_found: boolean;
  bms_active: boolean | null;
  bms_company: string | null;
  xerox_status: "Present" | "Missing";
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
  model_name: string;
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
  | "no_readings"        // never sent a reading
  | "xerox_missing";     // not on latest Xerox file

const PRINTER_TYPES = ["Colour", "Black and White", "Plan"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.floor(ms / 86_400_000);
}

function ReadingBadge({ dateStr }: { dateStr: string | null }) {
  const d = daysSince(dateStr);
  if (d === null) return <span className="jl-badge">Never</span>;
  if (d <= 3)    return <span className="jl-badge jl-badge--green">{d}d ago</span>;
  if (d <= 14)   return <span className="jl-badge jl-badge--amber">{d}d ago</span>;
  return           <span className="jl-badge jl-badge--red">{d}d ago</span>;
}

function XeroxStatusBadge({ m }: { m: XeroxMachine }) {
  if (m.xerox_status === "Present")
    return <span className="jl-badge jl-badge--green">Present</span>;
  return <span className="jl-badge jl-badge--red">Missing</span>;
}

function BmsBadge({ m }: { m: XeroxMachine }) {
  if (!m.bms_found) return <span className="jl-badge">Not in BMS</span>;
  if (m.bms_active) return <span className="jl-badge jl-badge--green">BMS Active</span>;
  return <span className="jl-badge">BMS Inactive</span>;
}

function MappingBadge({ m }: { m: XeroxMachine }) {
  const mapped = m.store || m.company_group;
  if (!mapped) return <span className="jl-badge jl-badge--amber">Unmapped</span>;
  return <span className="jl-badge jl-badge--blue">Mapped</span>;
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
  all:           "All",
  unmapped:      "Unmapped",
  mapped:        "Mapped",
  no_bms:        "Not in BMS",
  bms_inactive:  "BMS Inactive",
  bms_mismatch:  "BMS Mismatch",
  off:           "Switched Off",
  no_readings:   "No Readings",
  xerox_missing: "Missing from Xerox",
};

const WARNING_FILTERS: QuickFilter[] = ["unmapped", "no_bms", "bms_inactive", "bms_mismatch", "xerox_missing"];

function matchesFilter(m: XeroxMachine, f: QuickFilter): boolean {
  switch (f) {
    case "all":           return true;
    case "unmapped":      return !m.store && !m.company_group;
    case "mapped":        return !!(m.store || m.company_group);
    case "no_bms":        return !m.bms_found;
    case "bms_inactive":  return m.bms_found && m.bms_active === false;
    case "bms_mismatch":  return hasBmsMismatch(m);
    case "off":           return m.reporting_enabled === false;
    case "no_readings":   return !m.latest_reading_date;
    case "xerox_missing": return m.xerox_status === "Missing";
  }
}

// ─── Sort header button ───────────────────────────────────────────────────────

function SortHeader({
  label, col, sortKey, sortDir, onSort, align = "left",
}: {
  label: string;
  col: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === col;
  return (
    <th className={cx("px-4 py-2 text-xs font-semibold text-gray-600 uppercase", align === "right" ? "text-right" : "text-left")}>
      <button
        onClick={() => onSort(col)}
        className={cx("inline-flex items-center gap-1 uppercase", active && "text-gray-900")}
      >
        {label}
        {active
          ? (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)
          : <ArrowUpDown className="w-3 h-3 opacity-40" />}
      </button>
    </th>
  );
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
  const [form, setForm] = useState<MappingForm>({ store: "", company_group: "", printer_type: "", model_name: "" });
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

  // Counts per filter for the chip badges
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

  function openPanel(m: XeroxMachine) {
    setSelected(m);
    setForm({
      store: m.store ?? "",
      company_group: m.company_group ?? "",
      printer_type: m.printer_type ?? "",
      model_name: m.model_name ?? "",
    });
    setSaveError(null);
  }

  async function saveMapping(e: React.FormEvent) {
    e.preventDefault();
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
          model_name: form.model_name || null,
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

  const actionNeeded =
    filterCounts.unmapped + filterCounts.no_bms + filterCounts.bms_inactive + filterCounts.bms_mismatch + filterCounts.xerox_missing;

  function exportCSV() {
    const headers = ["Serial", "Model", "Model Name", "Store", "Group", "Type", "Xerox Status", "BMS Status", "BMS Store", "Mapping", "Last Reading", "Reporting"];
    const rows = filtered.map((m) => [
      m.serial_number ?? "",
      m.model ?? "",
      m.model_name ?? "",
      m.store ?? "",
      m.company_group ?? "",
      m.printer_type ?? "",
      m.xerox_status,
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
      <main className="px-6 py-4 max-w-6xl mx-auto space-y-4">

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="jl-h1">Machine Mapping</h1>
            <span className="jl-badge">{machines.length} total</span>
            {actionNeeded > 0 && (
              <span className="jl-badge jl-badge--amber">{actionNeeded} need attention</span>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={exportCSV} className="jl-btn jl-btn--secondary jl-btn--sm">
              <Download />
              Export ({filtered.length})
            </button>
            <button
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              className="jl-btn jl-btn--secondary jl-btn--sm"
            >
              <RefreshCw className={isRefreshing ? "animate-spin" : undefined} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Filter chips ── */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(FILTER_LABELS) as QuickFilter[]).map((f) => {
            const count = filterCounts[f];
            const isActive = activeFilter === f;
            const isWarning = WARNING_FILTERS.includes(f) && count > 0 && !isActive;
            return (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={cx(
                  "jl-badge",
                  isActive ? "jl-badge--solid" : isWarning ? "jl-badge--amber" : undefined,
                )}
                style={{ cursor: "pointer", height: 30, paddingInline: 12 }}
              >
                {FILTER_LABELS[f]}
                <span
                  className="inline-flex items-center justify-center rounded-full text-[10px] font-bold px-1.5"
                  style={{
                    minWidth: 18, height: 18,
                    background: isActive ? "rgba(255,255,255,.22)" : "var(--surface)",
                    color: isActive ? "#fff" : "var(--ink-500)",
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Search ── */}
        <div className="jl-search" style={{ maxWidth: 420 }}>
          <Search />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search serial, store, group, model, BMS company"
          />
        </div>

        {error && (
          <div className="bg-red-50 rounded-xl shadow-sm px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* ── Table ── */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="jl-spinner jl-spinner--lg" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <SortHeader label="Serial" col="serial_number" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortHeader label="Model" col="model" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Model Name</th>
                    <SortHeader label="Store" col="store" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortHeader label="Group" col="company_group" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Xerox</th>
                    <SortHeader label="BMS" col="bms_active" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">BMS Store</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Mapping</th>
                    <SortHeader label="Last Reading" col="latest_reading_date" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase">On/Off</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="text-center py-12 text-sm text-gray-500">
                        No machines match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((m) => {
                      const isOff = m.reporting_enabled === false;
                      const isMismatch = hasBmsMismatch(m);
                      return (
                        <tr key={m.serial_number} className={cx("hover:bg-gray-50", isOff && "opacity-40")}>
                          <td className="px-4 py-3 font-mono text-xs text-gray-900">{m.serial_number}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{m.model || "None"}</td>
                          <td className="px-4 py-3 text-xs font-medium text-gray-900">{m.model_name || "None"}</td>
                          <td className="px-4 py-3 text-sm">
                            {m.store
                              ? <span className="font-medium text-gray-900">{m.store}</span>
                              : <span className="text-gray-400">None</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{m.company_group || "None"}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{m.printer_type || "None"}</td>
                          <td className="px-4 py-3"><XeroxStatusBadge m={m} /></td>
                          <td className="px-4 py-3"><BmsBadge m={m} /></td>
                          <td className="px-4 py-3 text-xs">
                            {m.bms_company
                              ? <span className={cx("font-medium", isMismatch ? "text-amber-700" : "text-gray-700")}>{m.bms_company}</span>
                              : <span className="text-gray-400">None</span>}
                          </td>
                          <td className="px-4 py-3"><MappingBadge m={m} /></td>
                          <td className="px-4 py-3"><ReadingBadge dateStr={m.latest_reading_date} /></td>
                          <td className="px-4 py-3 text-center">
                            <label className="jl-switch" style={{ transform: "scale(.85)" }}>
                              <input
                                type="checkbox"
                                checked={m.reporting_enabled !== false}
                                onChange={(e) => toggleReporting(m, e.target.checked)}
                              />
                              <span className="track" />
                              <span className="thumb" />
                            </label>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => openPanel(m)}
                              className="jl-btn jl-btn--soft jl-btn--sm"
                            >
                              {m.store || m.company_group ? "Edit" : "Map"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!isLoading && !error && (
          <p className="text-xs text-gray-500">Showing {filtered.length} of {machines.length} machines</p>
        )}
      </main>

      {/* ── Mapping modal ── */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-xl shadow-lg w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="jl-chip jl-chip--sm">
                    {selected.store || selected.company_group ? <Pencil /> : <MapPin />}
                  </span>
                  <h2 className="jl-h3">{selected.store || selected.company_group ? "Edit Mapping" : "Map Machine"}</h2>
                </div>
                <p className="text-xs font-mono text-gray-500 mt-1">{selected.serial_number}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="p-1 hover:bg-gray-100 rounded"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Status badges */}
            <div className="flex flex-wrap gap-1.5">
              <XeroxStatusBadge m={selected} />
              <BmsBadge m={selected} />
              <MappingBadge m={selected} />
              <ReadingBadge dateStr={selected.latest_reading_date} />
            </div>

            {/* BMS record */}
            <div
              className={cx(
                "rounded-lg px-3 py-2.5 text-xs space-y-1",
                selected.bms_found ? "bg-gray-50" : "bg-amber-50",
              )}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">BMS Record</p>
              {selected.bms_found ? (
                <>
                  <p className="text-gray-700">
                    Status:{" "}
                    <span className={selected.bms_active ? "text-green-700 font-medium" : "text-gray-500"}>
                      {selected.bms_active ? "Active" : "Inactive"}
                    </span>
                  </p>
                  {selected.bms_company && (
                    <p className="text-gray-700">Company: <span className="font-medium text-gray-900">{selected.bms_company}</span></p>
                  )}
                  {hasBmsMismatch(selected) && (
                    <p className="text-amber-700 font-medium">BMS company does not match store name</p>
                  )}
                </>
              ) : (
                <p className="text-amber-700">This serial is not in BMS. It may need to be loaded or the serial is different.</p>
              )}
            </div>

            {/* Form */}
            <form onSubmit={saveMapping} className="space-y-3">
              {/* Store */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Store</label>
                <div className="jl-select-wrap mb-2">
                  <select
                    className="jl-select"
                    value={companies.some((c) => c.name === form.store) ? form.store : ""}
                    onChange={(e) => { if (e.target.value) setForm((f) => ({ ...f, store: e.target.value })); }}
                  >
                    <option value="">Select store</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <input
                  className="jl-input"
                  value={form.store}
                  onChange={(e) => setForm((f) => ({ ...f, store: e.target.value }))}
                  placeholder="Or type a custom store name"
                />
              </div>

              {/* Group */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Group</label>
                <div className="jl-select-wrap mb-2">
                  <select
                    className="jl-select"
                    value={groups.includes(form.company_group) ? form.company_group : ""}
                    onChange={(e) => { if (e.target.value) setForm((f) => ({ ...f, company_group: e.target.value })); }}
                  >
                    <option value="">Select group</option>
                    {groups.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <input
                  className="jl-input"
                  value={form.company_group}
                  onChange={(e) => setForm((f) => ({ ...f, company_group: e.target.value }))}
                  placeholder="Or type a custom group name"
                />
              </div>

              {/* Printer Type */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Printer Type</label>
                <div className="jl-select-wrap">
                  <select
                    className="jl-select"
                    value={form.printer_type}
                    onChange={(e) => setForm((f) => ({ ...f, printer_type: e.target.value }))}
                  >
                    <option value="">Select type</option>
                    {PRINTER_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Model Name */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Model Name</label>
                <input
                  className="jl-input"
                  value={form.model_name}
                  onChange={(e) => setForm((f) => ({ ...f, model_name: e.target.value }))}
                  placeholder="e.g. B9125, Versant 180"
                />
                {selected.model && (
                  <p className="text-[11px] text-gray-400 mt-1">Xerox model: {selected.model}</p>
                )}
              </div>

              {saveError && <p className="text-xs text-red-600">{saveError}</p>}

              <div className="flex items-end gap-2 pt-1">
                <button type="button" onClick={() => setSelected(null)} className="jl-btn jl-btn--ghost flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="jl-btn jl-btn--primary flex-1">
                  {saving ? "Saving" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
