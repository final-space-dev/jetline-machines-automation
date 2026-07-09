"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { PageLoading } from "@/components/ui/page-loading";
import { Plus, Check, X, Pencil, Trash2 } from "lucide-react";

interface TypeRow {
  id: number;
  name: string;
  count: number;
  created_at: string;
}

export default function EquipmentTypesPage() {
  const [rows, setRows] = useState<TypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/setup/equipment-types");
      const data = await res.json();
      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch {
      setError("Failed to load equipment types");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addType() {
    const name = newName.trim();
    if (!name || adding) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/setup/equipment-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to add type"); return; }
      setNewName("");
      await load();
    } finally {
      setAdding(false);
    }
  }

  async function saveEdit() {
    if (editId === null) return;
    const name = editName.trim();
    if (!name || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/setup/equipment-types", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editId, name }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save"); return; }
      setEditId(null);
      setEditName("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function deleteType(row: TypeRow) {
    if (row.count > 0) return;
    setError(null);
    const res = await fetch(`/api/setup/equipment-types?id=${row.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to delete");
      return;
    }
    await load();
  }

  if (loading) {
    return <AppShell><PageLoading variant="table" /></AppShell>;
  }

  const canAdd = !!newName.trim() && !adding;

  return (
    <AppShell>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-5)", maxWidth: 760 }}>
        <h1 className="jl-h1">Equipment Types</h1>

        {error && (
          <div className="jl-alert jl-alert--red" role="alert">
            <span className="jl-chip jl-chip--solid" style={{ width: 38, height: 38, borderRadius: "var(--r-sm)" }}>
              <X strokeWidth={2} />
            </span>
            <div className="jl-alert__body">
              <div className="jl-alert__text" style={{ marginTop: 0, color: "var(--red-600)", fontWeight: 600 }}>{error}</div>
            </div>
          </div>
        )}

        {/* Add row pinned above the table */}
        <div className="jl-card jl-card--pad-sm">
          <div style={{ display: "flex", gap: "var(--s-3)", alignItems: "center" }}>
            <input
              className="jl-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addType(); }}
              placeholder="Add a new equipment type"
              aria-label="New equipment type name"
            />
            <button
              type="button"
              className="jl-btn jl-btn--primary"
              onClick={addType}
              disabled={!canAdd}
              data-loading={adding ? "" : undefined}
            >
              <Plus /> Add Type
            </button>
          </div>
        </div>

        <div className="jl-table-wrap">
          <table className="jl-table">
            <thead>
              <tr>
                <th>Type</th>
                <th className="num" style={{ width: 110 }}>Items</th>
                <th style={{ width: 130, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: "center", color: "var(--ink-400)", padding: "var(--s-7)" }}>
                    No equipment types yet. Add one above.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const editing = editId === row.id;
                  const canDelete = row.count === 0;
                  return (
                    <tr key={row.id}>
                      <td>
                        {editing ? (
                          <input
                            autoFocus
                            className="jl-input"
                            style={{ height: 36, maxWidth: 340 }}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit();
                              if (e.key === "Escape") { setEditId(null); setEditName(""); }
                            }}
                            aria-label="Edit type name"
                          />
                        ) : (
                          <span className="cell-strong">{row.name}</span>
                        )}
                      </td>
                      <td className="num">
                        <span className={`jl-badge${row.count > 0 ? " jl-badge--blue" : ""}`}>{row.count}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "var(--s-2)" }}>
                          {editing ? (
                            <>
                              <button
                                type="button"
                                className="jl-btn jl-btn--soft jl-btn--icon jl-btn--sm"
                                onClick={saveEdit}
                                disabled={saving}
                                aria-label="Save"
                                title="Save"
                              >
                                <Check />
                              </button>
                              <button
                                type="button"
                                className="jl-btn jl-btn--ghost jl-btn--icon jl-btn--sm"
                                onClick={() => { setEditId(null); setEditName(""); }}
                                aria-label="Cancel"
                                title="Cancel"
                              >
                                <X />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="jl-btn jl-btn--ghost jl-btn--icon jl-btn--sm"
                                onClick={() => { setEditId(row.id); setEditName(row.name); }}
                                aria-label="Rename"
                                title="Rename"
                              >
                                <Pencil />
                              </button>
                              {canDelete ? (
                                <button
                                  type="button"
                                  className="jl-btn jl-btn--ghost jl-btn--icon jl-btn--sm"
                                  onClick={() => deleteType(row)}
                                  aria-label="Delete"
                                  title="Delete"
                                  style={{ color: "var(--red-500)" }}
                                >
                                  <Trash2 />
                                </button>
                              ) : (
                                <span className="jl-tip">
                                  <button
                                    type="button"
                                    className="jl-btn jl-btn--ghost jl-btn--icon jl-btn--sm"
                                    disabled
                                    aria-label="Delete"
                                  >
                                    <Trash2 />
                                  </button>
                                  <span className="jl-tip__bubble">In use, cannot delete</span>
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
