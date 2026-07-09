"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { PageLoading } from "@/components/ui/page-loading";
import { JlSelect } from "@/components/ui/jl-select";
import { Plus, Check, X, Pencil, Trash2 } from "lucide-react";

interface ConditionRow {
  id: number;
  label: string;
  color: string;
  keywords: string[];
}

const COLOR_OPTIONS = [
  { value: "green", label: "Green" },
  { value: "amber", label: "Amber" },
  { value: "red", label: "Red" },
  { value: "blue", label: "Blue" },
  { value: "grey", label: "Grey" },
];

// Maps a condition colour to the kit badge modifier class.
const BADGE_CLASS: Record<string, string> = {
  green: "jl-badge jl-badge--green",
  amber: "jl-badge jl-badge--amber",
  red: "jl-badge jl-badge--red",
  blue: "jl-badge jl-badge--blue",
  grey: "jl-badge",
};

function colorBadge(color: string, label: string) {
  return <span className={BADGE_CLASS[color] ?? "jl-badge"}>{label}</span>;
}

export default function ConditionsPage() {
  const [rows, setRows] = useState<ConditionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("grey");
  const [newKeywords, setNewKeywords] = useState("");
  const [adding, setAdding] = useState(false);

  const [editId, setEditId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editColor, setEditColor] = useState("grey");
  const [editKeywords, setEditKeywords] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/setup/conditions");
      const data = await res.json();
      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch {
      setError("Failed to load conditions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addCondition() {
    const label = newLabel.trim();
    if (!label || adding) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/setup/conditions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, color: newColor, keywords: newKeywords }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to add"); return; }
      setNewLabel(""); setNewColor("grey"); setNewKeywords("");
      await load();
    } finally {
      setAdding(false);
    }
  }

  function startEdit(row: ConditionRow) {
    setEditId(row.id);
    setEditLabel(row.label);
    setEditColor(row.color);
    setEditKeywords(row.keywords.join(", "));
  }

  async function saveEdit() {
    if (editId === null || saving) return;
    const label = editLabel.trim();
    if (!label) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/setup/conditions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editId, label, color: editColor, keywords: editKeywords }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save"); return; }
      setEditId(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function deleteCondition(id: number) {
    setError(null);
    const res = await fetch(`/api/setup/conditions?id=${id}`, { method: "DELETE" });
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

  const canAdd = !!newLabel.trim() && !adding;

  return (
    <AppShell>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-5)", maxWidth: 980 }}>
        <h1 className="jl-h1">Conditions</h1>

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

        {/* Add row — pinned above the table */}
        <div className="jl-card jl-card--pad-sm">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(160px,1fr) 150px minmax(200px,1.4fr) auto", gap: "var(--s-3)", alignItems: "center" }}>
            <input
              className="jl-input"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addCondition(); }}
              placeholder="Condition label"
              aria-label="New condition label"
            />
            <JlSelect value={newColor} onChange={setNewColor} options={COLOR_OPTIONS} />
            <input
              className="jl-input"
              value={newKeywords}
              onChange={(e) => setNewKeywords(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addCondition(); }}
              placeholder="Keyword triggers (comma separated)"
              aria-label="New condition keywords"
            />
            <button
              type="button"
              className="jl-btn jl-btn--primary"
              onClick={addCondition}
              disabled={!canAdd}
              data-loading={adding ? "" : undefined}
            >
              <Plus /> Add
            </button>
          </div>
        </div>

        <div className="jl-table-wrap">
          <table className="jl-table">
            <thead>
              <tr>
                <th style={{ width: 190 }}>Label</th>
                <th style={{ width: 150 }}>Colour</th>
                <th>Keyword Triggers</th>
                <th style={{ width: 120, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "var(--ink-400)", padding: "var(--s-7)" }}>
                    No conditions yet. Add one above.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const editing = editId === row.id;
                  return (
                    <tr key={row.id}>
                      <td>
                        {editing ? (
                          <input
                            className="jl-input"
                            style={{ height: 36 }}
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            aria-label="Edit label"
                          />
                        ) : (
                          <span className="cell-strong">{row.label}</span>
                        )}
                      </td>
                      <td>
                        {editing ? (
                          <JlSelect value={editColor} onChange={setEditColor} options={COLOR_OPTIONS} style={{ maxWidth: 140 }} />
                        ) : (
                          colorBadge(row.color, COLOR_OPTIONS.find((c) => c.value === row.color)?.label ?? row.color)
                        )}
                      </td>
                      <td>
                        {editing ? (
                          <input
                            className="jl-input"
                            style={{ height: 36 }}
                            value={editKeywords}
                            onChange={(e) => setEditKeywords(e.target.value)}
                            placeholder="comma, separated, keywords"
                            aria-label="Edit keywords"
                          />
                        ) : (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-2)" }}>
                            {row.keywords.length === 0 ? (
                              <span style={{ color: "var(--ink-400)", fontSize: "var(--fs-xs)" }}>None</span>
                            ) : (
                              row.keywords.map((k) => (
                                <span key={k} className="jl-tag" style={{ height: 24 }}>{k}</span>
                              ))
                            )}
                          </div>
                        )}
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
                                onClick={() => setEditId(null)}
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
                                onClick={() => startEdit(row)}
                                aria-label="Edit"
                                title="Edit"
                              >
                                <Pencil />
                              </button>
                              <button
                                type="button"
                                className="jl-btn jl-btn--ghost jl-btn--icon jl-btn--sm"
                                onClick={() => deleteCondition(row.id)}
                                aria-label="Delete"
                                title="Delete"
                                style={{ color: "var(--red-500)" }}
                              >
                                <Trash2 />
                              </button>
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
