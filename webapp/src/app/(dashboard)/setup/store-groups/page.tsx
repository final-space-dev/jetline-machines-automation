"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

export default function StoreGroupsPage() {
  const { isAdmin, loading: roleLoading } = useRole();

  const [rows, setRows] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingStore, setSavingStore] = useState<string | null>(null);
  const [query, setQuery] = useState("");

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
          [r.store, r.holdingGroup, r.storeGroup, r.group]
            .some((v) => (v ?? "").toLowerCase().includes(q)),
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

  // PATCH a single field for one store, then optimistically reflect the change.
  const patch = useCallback(
    async (store: string, patchBody: Partial<Record<Level, string> & { active: boolean }>) => {
      setSavingStore(store);
      setError(null);
      try {
        const res = await fetch("/api/setup/store-groups", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ store, ...patchBody }),
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
      } catch {
        setError("Failed to save");
      } finally {
        setSavingStore(null);
      }
    },
    [],
  );

  if (roleLoading || loading) {
    return (
      <AppShell>
        <div className="jl-card jl-card--pad-lg" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="jl-spinner jl-spinner--sm" />
          <span className="jl-sm jl-muted">Loading store groups</span>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* ---- Header ---- */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span className="jl-chip">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
              </svg>
            </span>
            <div>
              <h1 className="jl-h1">Store Groups</h1>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="jl-badge">{rows.length} stores</span>
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
            <button className="jl-btn jl-btn--soft jl-btn--sm" onClick={() => load()}>
              Retry
            </button>
          </div>
        )}

        {/* ---- Search ---- */}
        <div style={{ maxWidth: 380 }}>
          <div className="jl-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              placeholder="Search stores or groups"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {/* ---- 3-level editable table ---- */}
        <div className="jl-table-wrap">
          <div style={{ overflowX: "auto" }}>
            <table className="jl-table" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 180 }}>Store</th>
                  <th style={{ minWidth: 200 }}>Holding Group</th>
                  <th style={{ minWidth: 200 }}>Store Group</th>
                  <th style={{ minWidth: 200 }}>Group</th>
                  <th style={{ width: 120 }}>Active</th>
                </tr>
              </thead>
              <tbody>
                {totalShown === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "40px 16px" }}>
                      <span className="jl-sm jl-muted">
                        {query ? "No stores match your search." : "No stores configured yet."}
                      </span>
                    </td>
                  </tr>
                ) : (
                  grouped.map((g) => (
                    <HoldingGroup
                      key={g.holding}
                      holding={g.holding}
                      rows={g.rows}
                      holdingOptions={holdingOptions}
                      storeGroupOptions={storeGroupOptions}
                      groupOptions={groupOptions}
                      savingStore={savingStore}
                      disabled={!isAdmin}
                      onPatch={patch}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ---- One Holding Group section: a banded header row + its store rows. ----
function HoldingGroup({
  holding,
  rows,
  holdingOptions,
  storeGroupOptions,
  groupOptions,
  savingStore,
  disabled,
  onPatch,
}: {
  holding: string;
  rows: StoreRow[];
  holdingOptions: { value: string; label: string }[];
  storeGroupOptions: { value: string; label: string }[];
  groupOptions: { value: string; label: string }[];
  savingStore: string | null;
  disabled: boolean;
  onPatch: (
    store: string,
    body: Partial<Record<Level, string> & { active: boolean }>,
  ) => void;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={5}
          style={{
            padding: "12px 20px",
            background: "var(--surface-sunken)",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <span className="jl-eyebrow" style={{ color: "var(--red-600)" }}>
              Holding Group
            </span>
            <span className="jl-h3" style={{ color: "var(--ink-900)" }}>
              {holding}
            </span>
            <span className="jl-badge">{rows.length}</span>
          </span>
        </td>
      </tr>
      {rows.map((r) => {
        const saving = savingStore === r.store;
        return (
          <tr key={r.store}>
            <td className="cell-strong" style={{ paddingLeft: 32 }}>
              {r.store}
            </td>
            <td>
              <JlSelect
                value={r.holdingGroup ?? ""}
                onChange={(v) => onPatch(r.store, { holdingGroup: v })}
                options={holdingOptions}
                placeholder="Set holding group"
                disabled={disabled || saving}
              />
            </td>
            <td>
              <JlSelect
                value={r.storeGroup ?? ""}
                onChange={(v) => onPatch(r.store, { storeGroup: v })}
                options={storeGroupOptions}
                placeholder="Set store group"
                disabled={disabled || saving}
              />
            </td>
            <td>
              <JlSelect
                value={r.group ?? ""}
                onChange={(v) => onPatch(r.store, { group: v })}
                options={groupOptions}
                placeholder="Set group"
                disabled={disabled || saving}
              />
            </td>
            <td>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label className="jl-switch">
                  <input
                    type="checkbox"
                    checked={r.active}
                    disabled={disabled || saving}
                    onChange={(e) => onPatch(r.store, { active: e.target.checked })}
                  />
                  <span className="track" />
                  <span className="thumb" />
                </label>
                {saving && <span className="jl-spinner jl-spinner--sm" />}
              </div>
            </td>
          </tr>
        );
      })}
    </>
  );
}
