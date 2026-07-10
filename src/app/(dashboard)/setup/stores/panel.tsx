"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Search } from "lucide-react";
import { JlSelect } from "@/components/ui/jl-select";
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

  const totalShown = useMemo(
    () => grouped.reduce((n, g) => n + g.rows.length, 0),
    [grouped],
  );

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

  if (roleLoading || loading) {
    return (
      <div className="jl-card jl-card--pad-lg" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="jl-spinner jl-spinner--sm" />
        <span className="jl-sm jl-muted">Loading stores</span>
      </div>
    );
  }

  const editingRow = editingStore ? rows.find((r) => r.store === editingStore) ?? null : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* ---- Header ---- */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="jl-badge">{rows.length} stores</span>
          <span className="jl-badge jl-badge--green">{activeCount} active</span>
          {!isAdmin && <span className="jl-badge jl-badge--amber">Read only</span>}
        </div>
      </div>

      {/* ---- Error banner ---- */}
      {error && (
        <div className="jl-alert jl-alert--red" role="alert">
          <span className="jl-chip jl-chip--solid">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
          </span>
          <div className="jl-alert__body">
            <div className="jl-alert__title">Something went wrong</div>
            <div className="jl-alert__text">{error}</div>
          </div>
          <button className="jl-btn jl-btn--soft jl-btn--sm" onClick={() => load()}>Retry</button>
        </div>
      )}

      {/* ---- Search ---- */}
      <div style={{ maxWidth: 380 }}>
        <div className="jl-search">
          <Search size={16} />
          <input
            placeholder="Search stores, groups or connection"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* ---- Inline edit form-card ---- */}
      {editingRow && form && (
        <form onSubmit={submitEdit} className="jl-card" style={{ display: "flex", flexDirection: "column", gap: 14, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <span className="jl-h3" style={{ color: "var(--ink-900)" }}>{editingRow.store}</span>
            <span className="jl-sm jl-muted">Edit group, connection & status</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
            <div className="jl-field">
              <label>Holding Group</label>
              <JlSelect value={form.holdingGroup} onChange={(v) => setForm((f) => (f ? { ...f, holdingGroup: v } : f))} options={holdingOptions} placeholder="Set holding group" disabled={!isAdmin} />
            </div>
            <div className="jl-field">
              <label>Store Group</label>
              <JlSelect value={form.storeGroup} onChange={(v) => setForm((f) => (f ? { ...f, storeGroup: v } : f))} options={storeGroupOptions} placeholder="Set store group" disabled={!isAdmin} />
            </div>
            <div className="jl-field">
              <label>Group</label>
              <JlSelect value={form.group} onChange={(v) => setForm((f) => (f ? { ...f, group: v } : f))} options={groupOptions} placeholder="Set group" disabled={!isAdmin} />
            </div>
            <div className="jl-field">
              <label>BMS Connection</label>
              <JlSelect value={form.company} onChange={(v) => setForm((f) => (f ? { ...f, company: v } : f))} options={companyOptions} placeholder="No connection" disabled={!isAdmin} />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <label className="jl-switch">
              <input type="checkbox" checked={form.active} disabled={!isAdmin} onChange={(e) => setForm((f) => (f ? { ...f, active: e.target.checked } : f))} />
              <span className="track" />
              <span className="thumb" />
              <span className="label">Active</span>
            </label>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {savingStore === editingRow.store && <span className="jl-spinner jl-spinner--sm" />}
              <button type="button" className="jl-btn jl-btn--ghost" onClick={cancelEdit} disabled={savingStore === editingRow.store}>Cancel</button>
              <button type="submit" className="jl-btn jl-btn--primary" disabled={!isAdmin || savingStore === editingRow.store}>Save changes</button>
            </div>
          </div>
        </form>
      )}

      {/* ---- Table ---- */}
      <div className="jl-table-wrap">
        <div style={{ overflowX: "auto" }}>
          <table className="jl-table" style={{ minWidth: 980 }}>
            <thead>
              <tr>
                <th style={{ minWidth: 170 }}>Store</th>
                <th style={{ minWidth: 180 }}>Store Group</th>
                <th style={{ minWidth: 170 }}>Group</th>
                <th style={{ minWidth: 170 }}>Connection</th>
                <th style={{ width: 120 }}>Active</th>
                <th style={{ width: 56 }} />
              </tr>
            </thead>
            <tbody>
              {totalShown === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "40px 16px" }}>
                    <span className="jl-sm jl-muted">{query ? "No stores match your search." : "No stores configured yet."}</span>
                  </td>
                </tr>
              ) : (
                grouped.map((g) => (
                  <HoldingGroup
                    key={g.holding}
                    holding={g.holding}
                    rows={g.rows}
                    canEdit={isAdmin}
                    editingStore={editingStore}
                    savingStore={savingStore}
                    onEdit={startEdit}
                    onToggle={toggleActive}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function HoldingGroup({
  holding,
  rows,
  canEdit,
  editingStore,
  savingStore,
  onEdit,
  onToggle,
}: {
  holding: string;
  rows: StoreRow[];
  canEdit: boolean;
  editingStore: string | null;
  savingStore: string | null;
  onEdit: (row: StoreRow) => void;
  onToggle: (row: StoreRow) => void;
}) {
  const activeInGroup = rows.filter((r) => r.active).length;
  return (
    <>
      <tr>
        <td colSpan={6} style={{ padding: "10px 20px", background: "var(--surface-sunken)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <span className="jl-h3" style={{ color: "var(--ink-900)" }}>{holding}</span>
            <span className="jl-badge">{rows.length}</span>
            <span className="jl-badge jl-badge--green">{activeInGroup} active</span>
          </span>
        </td>
      </tr>
      {rows.map((r) => {
        const isEditing = editingStore === r.store;
        const isSaving = savingStore === r.store;
        return (
          <tr key={r.store} style={isEditing ? { background: "var(--red-tint)" } : undefined}>
            <td className="cell-strong" style={{ paddingLeft: 32 }}>{r.store}</td>
            <td>{r.storeGroup ?? <span className="jl-muted">Unassigned</span>}</td>
            <td>{r.group ?? <span className="jl-muted">Unassigned</span>}</td>
            <td>{r.company ?? <span className="jl-muted">—</span>}</td>
            <td>
              {/* Inline one-click active toggle — the audit workflow lever. */}
              <label className="jl-switch" title={r.active ? "Active — click to deactivate" : "Inactive — click to activate"} style={{ opacity: isSaving ? 0.5 : 1 }}>
                <input type="checkbox" checked={r.active} disabled={!canEdit || isSaving} onChange={() => onToggle(r)} />
                <span className="track" />
                <span className="thumb" />
              </label>
            </td>
            <td>
              {canEdit && (
                <button type="button" className="jl-btn jl-btn--ghost jl-btn--icon jl-btn--sm" aria-label={`Edit ${r.store}`} onClick={() => onEdit(r)}>
                  <Pencil size={15} />
                </button>
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}
