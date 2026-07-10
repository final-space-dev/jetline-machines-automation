"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Edit, Trash2, Upload, X } from "lucide-react";
import { JlSelect } from "@/components/ui/jl-select";
import { useRole } from "@/lib/use-role";

interface ModelRow {
  id: number;
  name: string;
  manufacturer: string | null;
  equipment_type: string;
  year_introduced: number | null;
  notes: string | null;
  created_at: string;
  item_count: number;
}

interface Draft {
  name: string;
  manufacturer: string;
  equipment_type: string;
  year_introduced: string;
  notes: string;
}

const EMPTY_DRAFT: Draft = { name: "", manufacturer: "", equipment_type: "", year_introduced: "", notes: "" };

function draftFromRow(r: ModelRow): Draft {
  return {
    name: r.name,
    manufacturer: r.manufacturer ?? "",
    equipment_type: r.equipment_type,
    year_introduced: r.year_introduced != null ? String(r.year_introduced) : "",
    notes: r.notes ?? "",
  };
}

export function ModelsPanel() {
  const { isAdmin, loading: roleLoading } = useRole();

  const [rows, setRows] = useState<ModelRow[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Single form state serves both Create and Edit. editingId === null while
  // creating; a real <form> card above the table handles both, no inline cells.
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, tRes] = await Promise.all([
        fetch("/api/setup/models"),
        fetch("/api/setup/equipment-types"),
      ]);
      const mJson = mRes.ok ? await mRes.json() : { rows: [] };
      setRows(Array.isArray(mJson.rows) ? mJson.rows : []);
      if (tRes.ok) {
        const tJson = await tRes.json();
        const names: string[] = Array.isArray(tJson.rows)
          ? tJson.rows.map((t: { name: string }) => t.name)
          : [];
        setTypes(names);
      }
    } catch {
      setError("Failed to load models");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const typeOptions = types.map((t) => ({ value: t, label: t }));

  function openCreate() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
    setNotice(null);
    setShowForm(true);
  }

  function openEdit(r: ModelRow) {
    setEditingId(r.id);
    setDraft(draftFromRow(r));
    setError(null);
    setNotice(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim() || !draft.equipment_type.trim()) {
      setError("Model name and type are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/setup/models", {
        method: editingId == null ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId == null ? draft : { id: editingId, ...draft }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || (editingId == null ? "Could not add model." : "Could not save model."));
        return;
      }
      await load();
      closeForm();
    } finally {
      setBusy(false);
    }
  }

  async function removeModel(id: number, name: string) {
    if (!window.confirm(`Delete model "${name}"? Items using it keep their make/model text.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/setup/models?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Could not delete model.");
        return;
      }
      if (editingId === id) closeForm();
      await load();
    } finally {
      setBusy(false);
    }
  }

  // ── CSV import ──────────────────────────────────────────────────────────────
  // Header row required. Recognised columns (case-insensitive):
  // name, manufacturer, equipment_type (or type), year_introduced (or year), notes.
  async function importCsv(file: File) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const text = await file.text();
      const drafts = parseCsv(text);
      if (drafts.length === 0) {
        setError("No valid rows found. Need a header with name and equipment_type.");
        return;
      }
      let ok = 0;
      let skipped = 0;
      for (const d of drafts) {
        const res = await fetch("/api/setup/models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(d),
        });
        if (res.ok) ok++;
        else skipped++;
      }
      await load();
      setNotice(`Imported ${ok} model(s)${skipped ? `, skipped ${skipped} (duplicate or invalid)` : ""}.`);
    } catch {
      setError("Could not read CSV file.");
    } finally {
      setBusy(false);
    }
  }

  if (roleLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 text-sm text-gray-500">Loading</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="jl-badge">{rows.length} models</span>
          {!isAdmin && <span className="jl-badge jl-badge--amber">Read only</span>}
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importCsv(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className="jl-btn jl-btn--secondary"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              <Upload /> Import CSV
            </button>
            <button
              type="button"
              className="jl-btn jl-btn--primary"
              disabled={busy}
              onClick={openCreate}
            >
              <Plus /> Add Model
            </button>
          </div>
        )}
      </div>

      {/* Notice / error banners */}
      {error && (
        <div className="bg-red-50 rounded-lg p-3 text-sm text-red-700 flex items-start justify-between gap-3">
          <span>{error}</span>
          <button type="button" className="p-0.5 hover:bg-red-100 rounded" onClick={() => setError(null)} aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {notice && (
        <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 flex items-start justify-between gap-3">
          <span>{notice}</span>
          <button type="button" className="p-0.5 hover:bg-gray-100 rounded" onClick={() => setNotice(null)} aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Create / Edit form card: real form, no inline table editing */}
      {showForm && isAdmin && (
        <form onSubmit={handleSubmit} className="space-y-3 bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-sm font-bold text-gray-900">
            {editingId == null ? "Add Model" : "Edit Model"}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Model Name *</label>
              <input
                autoFocus
                className="jl-input"
                placeholder="Polar Mohr 76 EM"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Manufacturer</label>
              <input
                className="jl-input"
                placeholder="Polar Mohr"
                value={draft.manufacturer}
                onChange={(e) => setDraft({ ...draft, manufacturer: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Type *</label>
              <JlSelect
                value={draft.equipment_type}
                onChange={(v) => setDraft({ ...draft, equipment_type: v })}
                options={typeOptions}
                placeholder="Select type"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Year Introduced</label>
              <input
                className="jl-input"
                inputMode="numeric"
                placeholder="2019"
                value={draft.year_introduced}
                onChange={(e) => setDraft({ ...draft, year_introduced: e.target.value.replace(/[^\d]/g, "") })}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <input
              className="jl-input"
              placeholder="Optional"
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </div>
          <div className="flex items-end gap-2">
            <button type="button" className="jl-btn jl-btn--ghost flex-1" onClick={closeForm}>
              Cancel
            </button>
            <button type="submit" className="jl-btn jl-btn--primary flex-1" disabled={busy}>
              {editingId == null ? "Create" : "Update"}
            </button>
          </div>
        </form>
      )}

      {/* Models table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-8 text-gray-500 text-sm">Loading models</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">No models yet. Add one to start the catalogue.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Model Name</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Manufacturer</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Year</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Items</th>
                  {isAdmin && <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {r.manufacturer || <span className="text-gray-400">Not set</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="jl-badge jl-badge--blue">{r.equipment_type}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right tabular-nums">
                      {r.year_introduced ?? <span className="text-gray-400">Not set</span>}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right tabular-nums">{r.item_count}</td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          className="p-1 hover:bg-gray-100 rounded mr-1"
                          title="Edit"
                          aria-label="Edit"
                          disabled={busy}
                          onClick={() => openEdit(r)}
                        >
                          <Edit className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                        <button
                          type="button"
                          className="p-1 hover:bg-red-50 rounded"
                          title="Delete"
                          aria-label="Delete"
                          disabled={busy}
                          onClick={() => void removeModel(r.id, r.name)}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">
        CSV columns: name, manufacturer, equipment_type, year_introduced, notes. Header row required.
      </p>
    </div>
  );
}

// Minimal CSV parser: handles quoted fields and commas inside quotes.
function parseCsv(text: string): Draft[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (keys: string[]) => header.findIndex((h) => keys.includes(h));
  const iName = idx(["name", "model", "model name", "model_name"]);
  const iMake = idx(["manufacturer", "make"]);
  const iType = idx(["equipment_type", "type", "equipment type"]);
  const iYear = idx(["year_introduced", "year", "year introduced"]);
  const iNotes = idx(["notes", "note"]);
  if (iName < 0 || iType < 0) return [];

  const out: Draft[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const name = (cells[iName] ?? "").trim();
    const equipment_type = (cells[iType] ?? "").trim();
    if (!name || !equipment_type) continue;
    out.push({
      name,
      equipment_type,
      manufacturer: iMake >= 0 ? (cells[iMake] ?? "").trim() : "",
      year_introduced: iYear >= 0 ? (cells[iYear] ?? "").trim().replace(/[^\d]/g, "") : "",
      notes: iNotes >= 0 ? (cells[iNotes] ?? "").trim() : "",
    });
  }
  return out;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { result.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  result.push(cur);
  return result;
}
