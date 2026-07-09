"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Search } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { JlSelect } from "@/components/ui/jl-select";
import { useRole } from "@/lib/use-role";

// Row shape as returned by GET /api/setup/store-groups (camelCase).
interface StoreRow {
  store: string;
  holdingGroup: string | null;
  storeGroup: string | null;
  group: string | null;
  active: boolean;
}

// The three editable grouping levels, top -> bottom.
type Level = "holdingGroup" | "storeGroup" | "group";

const UNASSIGNED = "Unassigned";

// Working copy of the form while a store is being edited.
interface EditForm {
  holdingGroup: string;
  storeGroup: string;
  group: string;
  active: boolean;
}

export default function StoreGroupsPage() {
  const { isAdmin, loading: roleLoading } = useRole();

  const [rows, setRows] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingStore, setSavingStore] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Which store's edit form is open, plus its working values.
  const [editingStore, setEditingStore] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/setup/store-groups");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load store groups");
        setRows([]);
        return;
      }
      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch {
      setError("Failed to load store groups");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Distinct, sorted option lists per level — drawn from every value seen across
  // the fleet so a store can be reassigned to any existing group at that level.
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

  // Filter, then group rows by Holding Group for the banded, hierarchical table.
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) =>
          [r.store, r.holdingGroup, r.storeGroup, r.group].some((v) =>
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
    // Sort holding groups, and stores within each, for a stable read.
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

  // Open the inline edit form for a store, seeded with its current assignments.
  const startEdit = useCallback((r: StoreRow) => {
    setError(null);
    setEditingStore(r.store);
    setForm({
      holdingGroup: r.holdingGroup ?? "",
      storeGroup: r.storeGroup ?? "",
      group: r.group ?? "",
      active: r.active,
    });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingStore(null);
    setForm(null);
  }, []);

  // PATCH the full set of edited fields for one store, then reflect the change.
  const submitEdit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingStore || !form) return;
      const store = editingStore;

      setSavingStore(store);
      setError(null);
      try {
        const res = await fetch("/api/setup/store-groups", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          // Send strings (never null) so the API's `typeof === "string"` guard
          // fires; an empty string is trimmed to NULL server-side and clears it.
          body: JSON.stringify({
            store,
            holdingGroup: form.holdingGroup,
            storeGroup: form.storeGroup,
            group: form.group,
            active: form.active,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to save");
          return;
        }
        const updated = data.row as StoreRow | undefined;
        if (updated) {
          setRows((prev) => prev.map((r) => (r.store === store ? updated : r)));
        }
        setEditingStore(null);
        setForm(null);
      } catch {
        setError("Failed to save");
      } finally {
        setSavingStore(null);
      }
    },
    [editingStore, form],
  );

  if (roleLoading || loading) {
    return (
      <AppShell>
        <main className="mx-auto max-w-6xl">
          <div
            className="jl-card jl-card--pad-lg"
            style={{ display: "flex", alignItems: "center", gap: 12 }}
          >
            <span className="jl-spinner jl-spinner--sm" />
            <span className="jl-sm jl-muted">Loading store groups</span>
          </div>
        </main>
      </AppShell>
    );
  }

  const editingRow = editingStore
    ? rows.find((r) => r.store === editingStore) ?? null
    : null;

  return (
    <AppShell>
      <main
        className="mx-auto max-w-6xl"
        style={{ display: "flex", flexDirection: "column", gap: 18 }}
      >
        {/* ---- Header ---- */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <h1 className="jl-h1">Store Groups</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="jl-badge">{rows.length} stores</span>
            {!isAdmin && <span className="jl-badge jl-badge--amber">Read only</span>}
          </div>
        </div>

        {/* ---- Error banner ---- */}
        {error && (
          <div className="jl-alert jl-alert--red" role="alert">
            <span className="jl-chip jl-chip--solid">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              </svg>
            </span>
            <div className="jl-alert__body">
              <div className="jl-alert__title">Something went wrong</div>
              <div className="jl-alert__text">{error}</div>
            </div>
            <button className="jl-btn jl-btn--soft jl-btn--sm" onClick={() => load()}>
              Retry
            </button>
          </div>
        )}

        {/* ---- Search ---- */}
        <div style={{ maxWidth: 380 }}>
          <div className="jl-search">
            <Search size={16} />
            <input
              placeholder="Search stores or groups"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {/* ---- Inline edit form-card (opens above the table) ---- */}
        {editingRow && form && (
          <form
            onSubmit={submitEdit}
            className="jl-card"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              padding: 18,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <span className="jl-h3" style={{ color: "var(--ink-900)" }}>
                {editingRow.store}
              </span>
              <span className="jl-sm jl-muted">Edit group assignments</span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 14,
              }}
            >
              <div className="jl-field">
                <label>Holding Group</label>
                <JlSelect
                  value={form.holdingGroup}
                  onChange={(v) => setForm((f) => (f ? { ...f, holdingGroup: v } : f))}
                  options={holdingOptions}
                  placeholder="Set holding group"
                  disabled={!isAdmin}
                />
              </div>
              <div className="jl-field">
                <label>Store Group</label>
                <JlSelect
                  value={form.storeGroup}
                  onChange={(v) => setForm((f) => (f ? { ...f, storeGroup: v } : f))}
                  options={storeGroupOptions}
                  placeholder="Set store group"
                  disabled={!isAdmin}
                />
              </div>
              <div className="jl-field">
                <label>Group</label>
                <JlSelect
                  value={form.group}
                  onChange={(v) => setForm((f) => (f ? { ...f, group: v } : f))}
                  options={groupOptions}
                  placeholder="Set group"
                  disabled={!isAdmin}
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <label className="jl-switch">
                <input
                  type="checkbox"
                  checked={form.active}
                  disabled={!isAdmin}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, active: e.target.checked } : f))
                  }
                />
                <span className="track" />
                <span className="thumb" />
                <span className="label">Active</span>
              </label>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {savingStore === editingRow.store && (
                  <span className="jl-spinner jl-spinner--sm" />
                )}
                <button
                  type="button"
                  className="jl-btn jl-btn--ghost"
                  onClick={cancelEdit}
                  disabled={savingStore === editingRow.store}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="jl-btn jl-btn--primary"
                  disabled={!isAdmin || savingStore === editingRow.store}
                >
                  Save changes
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ---- Read-only 3-level table (white card, sunken header, hover rows) ---- */}
        <div className="jl-table-wrap">
          <div style={{ overflowX: "auto" }}>
            <table className="jl-table" style={{ minWidth: 880 }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 180 }}>Store</th>
                  <th style={{ minWidth: 200 }}>Holding Group</th>
                  <th style={{ minWidth: 200 }}>Store Group</th>
                  <th style={{ minWidth: 200 }}>Group</th>
                  <th style={{ width: 110 }}>Active</th>
                  <th style={{ width: 64 }} />
                </tr>
              </thead>
              <tbody>
                {totalShown === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "40px 16px" }}>
                      <span className="jl-sm jl-muted">
                        {query
                          ? "No stores match your search."
                          : "No stores configured yet."}
                      </span>
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
                      onEdit={startEdit}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </AppShell>
  );
}

// ---- One Holding Group section: a plain band header + its read-only rows. ----
function HoldingGroup({
  holding,
  rows,
  canEdit,
  editingStore,
  onEdit,
}: {
  holding: string;
  rows: StoreRow[];
  canEdit: boolean;
  editingStore: string | null;
  onEdit: (row: StoreRow) => void;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={6}
          style={{ padding: "10px 20px", background: "var(--surface-sunken)" }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <span className="jl-h3" style={{ color: "var(--ink-900)" }}>
              {holding}
            </span>
            <span className="jl-badge">{rows.length}</span>
          </span>
        </td>
      </tr>
      {rows.map((r) => {
        const isEditing = editingStore === r.store;
        return (
          <tr
            key={r.store}
            style={
              isEditing ? { background: "var(--red-tint)" } : undefined
            }
          >
            <td className="cell-strong" style={{ paddingLeft: 32 }}>
              {r.store}
            </td>
            <td>
              {r.holdingGroup ?? <span className="jl-muted">Unassigned</span>}
            </td>
            <td>
              {r.storeGroup ?? <span className="jl-muted">Unassigned</span>}
            </td>
            <td>{r.group ?? <span className="jl-muted">Unassigned</span>}</td>
            <td>
              {r.active ? (
                <span className="jl-badge jl-badge--green">Active</span>
              ) : (
                <span className="jl-badge">Inactive</span>
              )}
            </td>
            <td>
              {canEdit && (
                <button
                  type="button"
                  className="jl-btn jl-btn--ghost jl-btn--icon jl-btn--sm"
                  aria-label={`Edit ${r.store}`}
                  onClick={() => onEdit(r)}
                >
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
