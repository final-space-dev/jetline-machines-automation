"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { DataTable, type Column } from "@/components/machines/data-table";
import { Field } from "@/components/machines/field";
import { Loading } from "@/components/machines/loading";
import { Muted } from "@/components/machines/panel";
import { Pick } from "@/components/machines/pick";
import { RowActions } from "@/components/machines/row-actions";
import { useRole } from "@/lib/use-role";

/**
 * Stores — the cornerstone CRM tab under Config. One row per store showing its
 * group hierarchy, its BMS connection (Company), and an inline active toggle.
 *
 * The active toggle drives the group-by-group audit workflow: switch a group's
 * stores off, review only the groups you've captured, then move on. Inactive
 * stores are hidden from the main views (All Stores / reports) but stay editable
 * here.
 *
 * Data:
 *   GET/PATCH /api/setup/store-groups  (rows incl. `company` + `active`)
 *   GET       /api/companies           (connection options for the dropdown)
 */

interface StoreRow {
  store: string;
  holdingGroup: string | null;
  storeGroup: string | null;
  group: string | null;
  company: string | null;
  active: boolean;
}

interface Company {
  id: number;
  name: string;
}

type Level = "holdingGroup" | "storeGroup" | "group";

const UNASSIGNED = "Unassigned";

interface EditForm {
  holdingGroup: string;
  storeGroup: string;
  group: string;
  company: string;
  active: boolean;
}

export function StoresPanel() {
  const { isAdmin, loading: roleLoading } = useRole();

  const [rows, setRows] = useState<StoreRow[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingStore, setSavingStore] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [editingStore, setEditingStore] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sgRes, coRes] = await Promise.all([
        fetch("/api/setup/store-groups"),
        fetch("/api/companies"),
      ]);
      const sgData = await sgRes.json();
      if (!sgRes.ok) {
        setError(sgData.error || "Failed to load stores");
        setRows([]);
        return;
      }
      setRows(Array.isArray(sgData.rows) ? sgData.rows : []);
      // Companies are the BMS connections a store can be linked to. Non-fatal if
      // it fails — the dropdown just falls back to whatever companies are known.
      if (coRes.ok) {
        const coData = await coRes.json();
        const list = Array.isArray(coData) ? coData : coData.companies ?? [];
        setCompanies(list.map((c: { id: number; name: string }) => ({ id: c.id, name: c.name })));
      }
    } catch {
      setError("Failed to load stores");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const optionsFor = useCallback(
    (level: Level) => {
      const seen = new Set<string>();
      for (const r of rows) {
        const v = r[level];
        if (v) seen.add(v);
      }
      return [...seen]
        .sort((a, b) => a.localeCompare(b))
        .map((v) => ({ value: v, label: v }));
    },
    [rows],
  );

  const holdingOptions = useMemo(() => optionsFor("holdingGroup"), [optionsFor]);
  const storeGroupOptions = useMemo(() => optionsFor("storeGroup"), [optionsFor]);
  const groupOptions = useMemo(() => optionsFor("group"), [optionsFor]);
  // Connection options come from the Companies list; union with any company
  // values already assigned to stores so an orphaned value still shows.
  const companyOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const c of companies) if (c.name) seen.add(c.name);
    for (const r of rows) if (r.company) seen.add(r.company);
    return [...seen].sort((a, b) => a.localeCompare(b)).map((v) => ({ value: v, label: v }));
  }, [companies, rows]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) =>
          [r.store, r.holdingGroup, r.storeGroup, r.group, r.company].some((v) =>
            (v ?? "").toLowerCase().includes(q),
          ),
        )
      : rows;

    const byHolding = new Map<string, StoreRow[]>();
    for (const r of filtered) {
      const key = r.holdingGroup ?? UNASSIGNED;
      if (!byHolding.has(key)) byHolding.set(key, []);
      byHolding.get(key)!.push(r);
    }
    return [...byHolding.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([holding, list]) => ({
        holding,
        rows: [...list].sort((a, b) => a.store.localeCompare(b.store)),
      }));
  }, [rows, query]);

  const activeCount = useMemo(() => rows.filter((r) => r.active).length, [rows]);

  const startEdit = useCallback((r: StoreRow) => {
    setError(null);
    setEditingStore(r.store);
    setForm({
      holdingGroup: r.holdingGroup ?? "",
      storeGroup: r.storeGroup ?? "",
      group: r.group ?? "",
      company: r.company ?? "",
      active: r.active,
    });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingStore(null);
    setForm(null);
  }, []);

  // Shared PATCH helper — patches an arbitrary field set for a store and merges
  // the returned row back into state.
  const patchStore = useCallback(
    async (store: string, body: Record<string, unknown>) => {
      setSavingStore(store);
      setError(null);
      try {
        const res = await fetch("/api/setup/store-groups", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ store, ...body }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to save");
          return false;
        }
        const updated = data.row as StoreRow | undefined;
        if (updated) setRows((prev) => prev.map((r) => (r.store === store ? updated : r)));
        return true;
      } catch {
        setError("Failed to save");
        return false;
      } finally {
        setSavingStore(null);
      }
    },
    [],
  );

  // One-click inline active toggle (the audit workflow lever).
  const toggleActive = useCallback(
    (r: StoreRow) => {
      if (!isAdmin) return;
      // Optimistic flip; patchStore reconciles with the server row.
      setRows((prev) => prev.map((x) => (x.store === r.store ? { ...x, active: !x.active } : x)));
      patchStore(r.store, { active: !r.active });
    },
    [isAdmin, patchStore],
  );

  const submitEdit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingStore || !form) return;
      const ok = await patchStore(editingStore, {
        holdingGroup: form.holdingGroup,
        storeGroup: form.storeGroup,
        group: form.group,
        company: form.company,
        active: form.active,
      });
      if (ok) {
        setEditingStore(null);
        setForm(null);
      }
    },
    [editingStore, form, patchStore],
  );

  if (roleLoading || loading) return <Loading label="Loading stores" />;

  const editingRow = editingStore ? rows.find((r) => r.store === editingStore) ?? null : null;
  const saving = editingRow !== null && savingStore === editingRow.store;
  // One table, ordered by holding group and then store, as the groups read.
  const ordered = grouped.flatMap((g) => g.rows.map((r) => ({ ...r, holding: g.holding })));
  const unassigned = <Muted>Unassigned</Muted>;

  const columns: Column<StoreRow & { holding: string }>[] = [
    { key: "store", label: "Store", sortValue: (r) => r.store, cell: (r) => <span className="font-medium">{r.store}</span> },
    { key: "holding", label: "Holding Group", hideBelow: "md", sortValue: (r) => r.holding, cell: (r) => (r.holdingGroup ? r.holding : unassigned) },
    { key: "storeGroup", label: "Store Group", hideBelow: "sm", sortValue: (r) => r.storeGroup ?? "", cell: (r) => r.storeGroup ?? unassigned },
    { key: "group", label: "Group", hideBelow: "lg", sortValue: (r) => r.group ?? "", cell: (r) => r.group ?? unassigned },
    { key: "company", label: "Connection", hideBelow: "md", sortValue: (r) => r.company ?? "", cell: (r) => r.company ?? <Muted>—</Muted> },
    {
      key: "active",
      label: "Active",
      sortValue: (r) => (r.active ? 1 : 0),
      // One click: the lever of the group-by-group audit.
      cell: (r) => (
        <Switch
          aria-label={r.active ? `${r.store} is active. Deactivate` : `${r.store} is inactive. Activate`}
          checked={r.active}
          disabled={!isAdmin || savingStore === r.store}
          onCheckedChange={() => toggleActive(r)}
        />
      ),
    },
    ...(isAdmin ? [{ key: "actions", label: "", align: "right", cell: (r: StoreRow) => <RowActions onEdit={() => startEdit(r)} /> } satisfies Column<StoreRow & { holding: string }>] : []),
  ];

  return (
    <div className="flex w-full max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <Input type="search" placeholder="Search stores, groups or connection" aria-label="Search stores" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{rows.length} stores</Badge>
          <Badge status="success">{activeCount} active</Badge>
          {!isAdmin && <Badge status="warning">Read only</Badge>}
        </div>
      </div>

      {error && !editingRow && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <AlertAction>
            <Button variant="outline" size="sm" onClick={() => load()}>Retry</Button>
          </AlertAction>
        </Alert>
      )}

      <DataTable
        columns={columns}
        rows={ordered}
        rowKey={(r) => r.store}
        empty={query ? "No stores match your search" : "No stores configured yet"}
      />

      <Dialog open={editingRow !== null && form !== null} onOpenChange={(o) => { if (!o) cancelEdit(); }}>
        <DialogContent size="form">
          <DialogHeader>
            <DialogTitle>{editingRow?.store}</DialogTitle>
          </DialogHeader>
          {form && (
            <form onSubmit={submitEdit} className="flex flex-col gap-4">
              {error && (
                <Alert variant="destructive" role="alert">
                  <AlertTitle>{error}</AlertTitle>
                </Alert>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Holding Group" htmlFor="store-holding">
                  <Pick id="store-holding" value={form.holdingGroup} onChange={(v) => setForm((f) => (f ? { ...f, holdingGroup: v } : f))} options={holdingOptions} placeholder="Set holding group" disabled={!isAdmin} />
                </Field>
                <Field label="Store Group" htmlFor="store-group">
                  <Pick id="store-group" value={form.storeGroup} onChange={(v) => setForm((f) => (f ? { ...f, storeGroup: v } : f))} options={storeGroupOptions} placeholder="Set store group" disabled={!isAdmin} />
                </Field>
                <Field label="Group" htmlFor="store-subgroup">
                  <Pick id="store-subgroup" value={form.group} onChange={(v) => setForm((f) => (f ? { ...f, group: v } : f))} options={groupOptions} placeholder="Set group" disabled={!isAdmin} />
                </Field>
                <Field label="BMS Connection" htmlFor="store-company">
                  <Pick id="store-company" value={form.company} onChange={(v) => setForm((f) => (f ? { ...f, company: v } : f))} options={companyOptions} placeholder="No connection" disabled={!isAdmin} />
                </Field>
              </div>
              <div className="flex items-center gap-2.5">
                <Switch id="store-active" checked={form.active} disabled={!isAdmin} onCheckedChange={(checked) => setForm((f) => (f ? { ...f, active: checked } : f))} />
                <Label htmlFor="store-active">Active</Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={cancelEdit} disabled={saving}>Cancel</Button>
                <Button type="submit" disabled={!isAdmin || saving}>
                  {saving && <Spinner />}
                  Save changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
