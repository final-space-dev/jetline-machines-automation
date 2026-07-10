"use client";

import { useCallback, useEffect, useState } from "react";
import { PageLoading } from "@/components/ui/page-loading";
import { Plus, Edit, Trash2 } from "lucide-react";

interface TypeRow {
  id: number;
  name: string;
  count: number;
  created_at: string;
}

export function EquipmentTypesPanel() {
  const [rows, setRows] = useState<TypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
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

  function openCreate() {
    setEditingId(null);
    setName("");
    setError(null);
    setIsCreating(true);
  }

  function openEdit(row: TypeRow) {
    setEditingId(row.id);
    setName(row.name);
    setError(null);
    setIsCreating(true);
  }

  function closeForm() {
    setIsCreating(false);
    setEditingId(null);
    setName("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = editingId === null
        ? await fetch("/api/setup/equipment-types", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: trimmed }),
          })
        : await fetch("/api/setup/equipment-types", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: editingId, name: trimmed }),
          });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save type"); return; }
      closeForm();
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
    return <PageLoading variant="table" />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-end">
        <button type="button" onClick={openCreate} className="jl-btn jl-btn--primary jl-btn--sm">
          <Plus className="w-4 h-4" />
          New Type
        </button>
      </div>

      {error && (
        <div className="bg-red-50 rounded-lg p-2 text-sm text-red-700">{error}</div>
      )}

      {isCreating && (
        <form onSubmit={handleSubmit} className="space-y-3 bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-sm font-bold text-gray-900">
            {editingId === null ? "New Equipment Type" : "Edit Equipment Type"}
          </h2>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="jl-input"
              required
              placeholder="e.g. Laminator"
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
          <div className="text-center py-8 text-gray-500 text-sm">No equipment types yet. Create one to get started.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Items</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => {
                const canDelete = row.count === 0;
                return (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.count}</td>
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
                        onClick={() => deleteType(row)}
                        disabled={!canDelete}
                        className="p-1 hover:bg-red-50 rounded disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                        aria-label="Delete"
                        title={canDelete ? "Delete" : "In use, cannot delete"}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
