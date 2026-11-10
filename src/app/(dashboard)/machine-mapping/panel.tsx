"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, RefreshCw, Search } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { DataTable, type Column } from "@/components/machines/data-table";
import { Field } from "@/components/machines/field";
import { Loading } from "@/components/machines/loading";
import { Page } from "@/components/machines/page";
import { Muted } from "@/components/machines/panel";
import { Pick } from "@/components/machines/pick";
import { FILTER_LABELS, WARNING_FILTERS, hasBmsMismatch, matchesFilter, needingAttention, type QuickFilter, type XeroxMachine } from "@/lib/machine-mapping";
import { canConfig } from "@/lib/permissions";
import { useRole } from "@/lib/use-role";

// ─── Types ────────────────────────────────────────────────────────────────────

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

const PRINTER_TYPES = ["Colour", "Black and White", "Plan"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.floor(ms / 86_400_000);
}

function ReadingBadge({ dateStr }: { dateStr: string | null }) {
  const d = daysSince(dateStr);
  if (d === null) return <Badge status="neutral">Never</Badge>;
  return <Badge status={d <= 3 ? "success" : d <= 14 ? "warning" : "danger"}>{d}d ago</Badge>;
}

function XeroxStatusBadge({ m }: { m: XeroxMachine }) {
  return m.xerox_status === "Present" ? <Badge status="success">Present</Badge> : <Badge status="danger">Missing</Badge>;
}

function BmsBadge({ m }: { m: XeroxMachine }) {
  if (!m.bms_found) return <Badge status="neutral">Not in BMS</Badge>;
  return m.bms_active ? <Badge status="success">BMS active</Badge> : <Badge status="neutral">BMS inactive</Badge>;
}

function MappingBadge({ m }: { m: XeroxMachine }) {
  return m.store || m.company_group ? <Badge status="info">Mapped</Badge> : <Badge status="warning">Unmapped</Badge>;
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

// ─── Page ─────────────────────────────────────────────────────────────────────

// The mapping tool. `embedded` renders it bare, as the Config tab's content;
// on its own route (/machine-mapping) it is a page with its own title.
export function MachineMappingPanel({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  // Machine mapping lives under Config. Admins can use it, and so can a custom
  // user granted the "machine-mapping" config section (e.g. a Xerox partner).
  // Anyone else is redirected home; the data API also enforces this server-side.
  const { role, permissions, loading: roleLoading } = useRole();
  const allowed =
    role === "admin" || (role === "custom" && canConfig(role, permissions, "machine-mapping"));
  useEffect(() => {
    if (!roleLoading && !allowed) router.replace("/");
  }, [roleLoading, allowed, router]);

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

  const actionNeeded = needingAttention(machines);

  function exportCSV() {
    const headers = ["Serial", "Model", "Model name", "Store", "Group", "Type", "Xerox Status", "BMS Status", "BMS store", "Mapping", "Last reading", "Reporting"];
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

  const none = <Muted>None</Muted>;
  const sortable = (key: SortKey) => (m: XeroxMachine) => sortValue(m, key);
  const columns: Column<XeroxMachine>[] = [
    { key: "serial_number", label: "Serial", sortValue: sortable("serial_number"), cell: (m) => <span className="font-medium whitespace-nowrap tabular-nums">{m.serial_number}</span> },
    { key: "model", label: "Model", sortValue: sortable("model"), cell: (m) => <Muted className="whitespace-nowrap">{m.model || "None"}</Muted> },
    { key: "model_name", label: "Model name", cell: (m) => (m.model_name ? <span className="font-medium whitespace-nowrap">{m.model_name}</span> : none) },
    { key: "store", label: "Store", sortValue: sortable("store"), cell: (m) => (m.store ? <span className="font-medium whitespace-nowrap">{m.store}</span> : none) },
    { key: "company_group", label: "Group", sortValue: sortable("company_group"), cell: (m) => <Muted className="whitespace-nowrap">{m.company_group || "None"}</Muted> },
    { key: "printer_type", label: "Type", cell: (m) => <Muted className="whitespace-nowrap">{m.printer_type || "None"}</Muted> },
    { key: "xerox", label: "Xerox", cell: (m) => <XeroxStatusBadge m={m} /> },
    { key: "bms_active", label: "BMS", sortValue: sortable("bms_active"), cell: (m) => <BmsBadge m={m} /> },
    {
      key: "bms_company",
      label: "BMS store",
      cell: (m) => (m.bms_company ? <span className={hasBmsMismatch(m) ? "font-semibold whitespace-nowrap text-deficit" : "font-medium whitespace-nowrap"}>{m.bms_company}</span> : none),
    },
    { key: "mapping", label: "Mapping", cell: (m) => <MappingBadge m={m} /> },
    { key: "latest_reading_date", label: "Last reading", sortValue: sortable("latest_reading_date"), cell: (m) => <ReadingBadge dateStr={m.latest_reading_date} /> },
    {
      key: "reporting",
      label: "On/Off",
      cell: (m) => <Switch aria-label={`Reporting for ${m.serial_number}`} checked={m.reporting_enabled !== false} onCheckedChange={(checked) => toggleReporting(m, checked)} />,
    },
    {
      key: "action",
      label: "",
      align: "right",
      cell: (m) => (
        <Button variant="outline" size="sm" onClick={() => openPanel(m)}>
          {m.store || m.company_group ? "Edit" : "Map"}
        </Button>
      ),
    },
  ];

  const summary = (
    <>
      <Badge variant="secondary">{machines.length} total</Badge>
      {actionNeeded > 0 && <Badge status="warning">{actionNeeded} need attention</Badge>}
    </>
  );
  const actions = (
    <>
      <Button variant="outline" size="sm" onClick={exportCSV}>
        <Download /> Export ({filtered.length})
      </Button>
      <Button variant="outline" size="sm" onClick={() => fetchData(true)} disabled={isRefreshing}>
        {isRefreshing ? <Spinner /> : <RefreshCw />} Refresh
      </Button>
    </>
  );

  const body = (
    <>
      {/* Embedded under Config the heading and the tab already name this, so the bar carries only the counts and actions. */}
      {/* On its own page the counts sit beside the title, except on a phone, where they come first here. */}
      {!embedded && <div className="flex items-center gap-2 sm:hidden">{summary}</div>}
      {embedded && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">{summary}</div>
          <div className="flex items-center gap-2">{actions}</div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(Object.keys(FILTER_LABELS) as QuickFilter[]).map((f) => {
          const count = filterCounts[f];
          const isActive = activeFilter === f;
          const isWarning = WARNING_FILTERS.includes(f) && count > 0 && !isActive;
          return (
            <Button key={f} variant={isActive ? "default" : "outline"} size="sm" aria-pressed={isActive} onClick={() => setActiveFilter(f)}>
              {FILTER_LABELS[f]}
              <Badge status={isWarning ? "warning" : "neutral"}>{count}</Badge>
            </Button>
          );
        })}
      </div>

      <div className="relative w-full sm:w-96">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
        <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search serial, store, group, model, BMS company" aria-label="Search machines" className="pl-9" />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      )}

      {isLoading ? (
        <Loading />
      ) : (
        <DataTable
          wide
          columns={columns}
          rows={filtered}
          rowKey={(m) => m.serial_number}
          rowClassName={(m) => (m.reporting_enabled === false ? "opacity-40" : undefined)}
          defaultSort={{ key: "store", dir: 1 }}
          onSortChange={(key, dir) => {
            setSortKey(key as SortKey);
            setSortDir(dir === 1 ? "asc" : "desc");
          }}
          pageSize={100}
          empty="No machines match the current filter"
        />
      )}

      {!isLoading && !error && <Muted>Showing {filtered.length} of {machines.length} machines</Muted>}

      <Dialog open={selected !== null} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent size="form">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.store || selected.company_group ? "Edit mapping" : "Map machine"} · {selected.serial_number}</DialogTitle>
              </DialogHeader>

              <div className="flex flex-wrap gap-1.5">
                <XeroxStatusBadge m={selected} />
                <BmsBadge m={selected} />
                <MappingBadge m={selected} />
                <ReadingBadge dateStr={selected.latest_reading_date} />
              </div>

              <Alert variant={selected.bms_found && !hasBmsMismatch(selected) ? "default" : "warning"}>
                <AlertTitle>BMS record</AlertTitle>
                <AlertDescription>
                  {selected.bms_found ? (
                    <>
                      Status: {selected.bms_active ? "Active" : "Inactive"}
                      {selected.bms_company && <span className="block">Company: {selected.bms_company}</span>}
                      {hasBmsMismatch(selected) && <span className="block font-medium">BMS company does not match store name</span>}
                    </>
                  ) : (
                    "This serial is not in BMS. It may need to be loaded or the serial is different."
                  )}
                </AlertDescription>
              </Alert>

              <form onSubmit={saveMapping} className="flex flex-col gap-4">
                <Field label="Store" htmlFor="map-store">
                  <Pick
                    id="map-store"
                    value={companies.some((c) => c.name === form.store) ? form.store : ""}
                    onChange={(v) => { if (v) setForm((f) => ({ ...f, store: v })); }}
                    placeholder="Select store"
                    options={companies.map((c) => ({ value: c.name, label: c.name }))}
                  />
                  <Input aria-label="Custom store name" value={form.store} onChange={(e) => setForm((f) => ({ ...f, store: e.target.value }))} placeholder="Or type a custom store name" />
                </Field>

                <Field label="Group" htmlFor="map-group">
                  <Pick
                    id="map-group"
                    value={groups.includes(form.company_group) ? form.company_group : ""}
                    onChange={(v) => { if (v) setForm((f) => ({ ...f, company_group: v })); }}
                    placeholder="Select group"
                    options={groups.map((g) => ({ value: g, label: g }))}
                  />
                  <Input aria-label="Custom group name" value={form.company_group} onChange={(e) => setForm((f) => ({ ...f, company_group: e.target.value }))} placeholder="Or type a custom group name" />
                </Field>

                <Field label="Printer type" htmlFor="map-type">
                  <Pick id="map-type" value={form.printer_type} onChange={(v) => setForm((f) => ({ ...f, printer_type: v }))} placeholder="Select type" options={PRINTER_TYPES.map((t) => ({ value: t, label: t }))} />
                </Field>

                <Field label="Model name" htmlFor="map-model" hint={selected.model ? `Xerox model: ${selected.model}` : undefined} error={saveError}>
                  <Input id="map-model" value={form.model_name} onChange={(e) => setForm((f) => ({ ...f, model_name: e.target.value }))} placeholder="e.g. B9125, Versant 180" />
                </Field>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
                  <Button type="submit" disabled={saving}>
                    {saving && <Spinner />}
                    {saving ? "Saving" : "Save"}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );

  if (embedded) return <div className="flex w-full min-w-0 flex-col gap-4">{body}</div>;
  return (
    <Page title="Machine mapping" titleExtra={<span className="contents max-sm:hidden">{summary}</span>} actions={actions}>
      {body}
    </Page>
  );
}
