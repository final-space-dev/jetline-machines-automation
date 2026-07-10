"use client";

import { useCallback, useEffect, useState } from "react";
import { PageLoading } from "@/components/ui/page-loading";
import { JlSelect } from "@/components/ui/jl-select";
import { Plus, Edit, Trash2 } from "lucide-react";

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

export function ConditionsPanel() {
  const [rows, setRows] = useState<ConditionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("grey");
  const [keywords, setKeywords] = useState("");
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

  function openCreate() {
    setEditingId(null);
    setLabel("");
    setColor("grey");
    setKeywords("");
    setError(null);
    setIsCreating(true);
  }

  function openEdit(row: ConditionRow) {
    setEditingId(row.id);
    setLabel(row.label);
    setColor(row.color);
    setKeywords(row.keywords.join(", "));
    setError(null);
    setIsCreating(true);
  }

  function closeForm() {
    setIsCreating(false);
    setEditingId(null);
    setLabel("");
    setColor("grey");
    setKeywords("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = editingId === null
        ? await fetch("/api/setup/conditions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ label: trimmed, color, keywords }),
          })
        : await fetch("/api/setup/conditions", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: editingId, label: trimmed, color, keywords }),
          });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save"); return; }
      closeForm();
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
    return <PageLoading variant="table" />;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-end">
        <button type="button" onClick={openCreate} className="jl-btn jl-btn--primary jl-btn--sm">
          <Plus className="w-4 h-4" />
          New Condition
        </button>
      </div>

      {error && (
        <div className="bg-red-50 rounded-lg p-2 text-sm text-red-700">{error}</div>
      )}

      {isCreating && (
        <form onSubmit={handleSubmit} className="space-y-3 bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-sm font-bold text-gray-900">
            {editingId === null ? "New Condition" : "Edit Condition"}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Label *</label>
              <input
                autoFocus
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="jl-input"
                required
                placeholder="e.g. Needs Repair"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Colour</label>
              <JlSelect value={color} onChange={setColor} options={COLOR_OPTIONS} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Keyword Triggers</label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="jl-input"
              placeholder="Comma separated, e.g. broken, jam, error"
            />
          </div>
          <div className="flex items-end gap-2">
            <button type="button" onClick={closeForm} className="jl-btn jl-btn--ghost flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="jl-btn jl-btn--primary flex-1">
              {editingId === null ? "Create" : "Update"}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {rows.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">No conditions yet. Create one to get started.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Label</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Colour</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Keyword Triggers</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.label}</td>
                  <td className="px-4 py-3">
                    {colorBadge(row.color, COLOR_OPTIONS.find((c) => c.value === row.color)?.label ?? row.color)}
                  </td>
                  <td className="px-4 py-3">
                    {row.keywords.length === 0 ? (
                      <span className="text-xs text-gray-400">None</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {row.keywords.map((k) => (
                          <span key={k} className="jl-tag" style={{ height: 24 }}>{k}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      className="p-1 hover:bg-gray-100 rounded mr-1"
                      aria-label="Edit"
                    >
                      <Edit className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCondition(row.id)}
                      className="p-1 hover:bg-red-50 rounded"
                      aria-label="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
