"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Check, X, Upload } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { JlSelect } from "@/components/ui/jl-select";

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

export default function SetupModelsPage() {
  const [rows, setRows] = useState<ModelRow[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT);

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

  async function createModel(draft: Draft): Promise<boolean> {
    if (!draft.name.trim() || !draft.equipment_type.trim()) {
      setError("Name and type are required");
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/setup/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Could not add model");
        return false;
      }
      await load();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (editingId == null) return;
    if (!editDraft.name.trim() || !editDraft.equipment_type.trim()) {
      setError("Name and type are required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/setup/models", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...editDraft }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Could not save model");
        return;
      }
      setEditingId(null);
      await load();
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
        setError(j.error || "Could not delete model");
        return;
      }
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
      setError(`Imported ${ok} model(s)${skipped ? `, skipped ${skipped} (duplicate or invalid)` : ""}.`);
    } catch {
      setError("Could not read CSV file");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-5)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--s-4)", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span className="jl-chip">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M3 9h18M9 20V9" />
              </svg>
            </span>
            <h1 className="jl-h1">Model Catalogue</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)" }}>
            <span className="jl-badge">{rows.length} models</span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: "none" }}
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
              disabled={busy || adding}
              onClick={() => { setAdding(true); setAddDraft(EMPTY_DRAFT); setError(null); }}
            >
              <Plus /> Add Model
            </button>
          </div>
        </div>

        {error && (
          <div className="jl-alert jl-alert--red" role="alert">
            <span className="jl-chip jl-chip--solid">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              </svg>
            </span>
            <div className="jl-alert__body">
              <div className="jl-alert__title">Notice</div>
              <div className="jl-alert__text">{error}</div>
            </div>
            <button type="button" className="jl-btn jl-btn--soft jl-btn--sm" onClick={() => setError(null)}>
              Dismiss
            </button>
          </div>
        )}

        <div className="jl-table-wrap">
          <div style={{ overflowX: "auto" }}>
            <table className="jl-table" style={{ minWidth: 880 }}>
              <thead>
                <tr>
                  <th>Model Name</th>
                  <th>Manufacturer</th>
                  <th>Type</th>
                  <th className="num">Year</th>
                  <th className="num">Items</th>
                  <th style={{ width: 120, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {adding && (
                  <tr>
                    <td>
                      <input
                        autoFocus
                        className="jl-input"
                        style={{ height: 36 }}
                        placeholder="Polar Mohr 76 EM"
                        value={addDraft.name}
                        onChange={(e) => setAddDraft({ ...addDraft, name: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="jl-input"
                        style={{ height: 36 }}
                        placeholder="Polar Mohr"
                        value={addDraft.manufacturer}
                        onChange={(e) => setAddDraft({ ...addDraft, manufacturer: e.target.value })}
                      />
                    </td>
                    <td>
                      <JlSelect
                        value={addDraft.equipment_type}
                        onChange={(v) => setAddDraft({ ...addDraft, equipment_type: v })}
                        options={typeOptions}
                        placeholder="Select type"
                        style={{ minWidth: 170 }}
                      />
                    </td>
                    <td className="num">
                      <input
                        className="jl-input"
                        style={{ height: 36, width: 84, textAlign: "right" }}
                        placeholder="2019"
                        inputMode="numeric"
                        value={addDraft.year_introduced}
                        onChange={(e) => setAddDraft({ ...addDraft, year_introduced: e.target.value.replace(/[^\d]/g, "") })}
                      />
                    </td>
                    <td className="num" style={{ color: "var(--ink-400)" }}>0</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <div style={{ display: "inline-flex", gap: "var(--s-2)" }}>
                        <button
                          type="button"
                          className="jl-btn jl-btn--soft jl-btn--icon jl-btn--sm"
                          title="Save"
                          aria-label="Save"
                          disabled={busy}
                          onClick={async () => { if (await createModel(addDraft)) setAdding(false); }}
                        >
                          <Check />
                        </button>
                        <button
                          type="button"
                          className="jl-btn jl-btn--ghost jl-btn--icon jl-btn--sm"
                          title="Cancel"
                          aria-label="Cancel"
                          onClick={() => { setAdding(false); setError(null); }}
                        >
                          <X />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "var(--ink-400)", padding: "var(--s-7)" }}>
                      <span className="jl-sm jl-muted">Loading models</span>
                    </td>
                  </tr>
                ) : rows.length === 0 && !adding ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "var(--ink-400)", padding: "var(--s-7)" }}>
                      No models yet. Add one to start the catalogue.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const isEditing = editingId === r.id;
                    return (
                      <tr key={r.id}>
                        <td>
                          {isEditing ? (
                            <input
                              className="jl-input"
                              style={{ height: 36 }}
                              value={editDraft.name}
                              onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                            />
                          ) : (
                            <span className="cell-strong">{r.name}</span>
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input
                              className="jl-input"
                              style={{ height: 36 }}
                              value={editDraft.manufacturer}
                              onChange={(e) => setEditDraft({ ...editDraft, manufacturer: e.target.value })}
                            />
                          ) : (
                            r.manufacturer || <span style={{ color: "var(--ink-400)" }}>Not set</span>
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <JlSelect
                              value={editDraft.equipment_type}
                              onChange={(v) => setEditDraft({ ...editDraft, equipment_type: v })}
                              options={typeOptions}
                              placeholder="Select type"
                              style={{ minWidth: 170 }}
                            />
                          ) : (
                            <span className="jl-badge jl-badge--blue">{r.equipment_type}</span>
                          )}
                        </td>
                        <td className="num">
                          {isEditing ? (
                            <input
                              className="jl-input"
                              style={{ height: 36, width: 84, textAlign: "right" }}
                              inputMode="numeric"
                              value={editDraft.year_introduced}
                              onChange={(e) => setEditDraft({ ...editDraft, year_introduced: e.target.value.replace(/[^\d]/g, "") })}
                            />
                          ) : (
                            r.year_introduced ?? <span style={{ color: "var(--ink-400)" }}>Not set</span>
                          )}
                        </td>
                        <td className="num cell-strong">
                          {r.item_count}
                        </td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <div style={{ display: "inline-flex", gap: "var(--s-2)" }}>
                            {isEditing ? (
                              <>
                                <button type="button" className="jl-btn jl-btn--soft jl-btn--icon jl-btn--sm" title="Save" aria-label="Save" disabled={busy} onClick={saveEdit}>
                                  <Check />
                                </button>
                                <button type="button" className="jl-btn jl-btn--ghost jl-btn--icon jl-btn--sm" title="Cancel" aria-label="Cancel" onClick={() => { setEditingId(null); setError(null); }}>
                                  <X />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="jl-btn jl-btn--ghost jl-btn--icon jl-btn--sm"
                                  title="Edit"
                                  aria-label="Edit"
                                  onClick={() => { setEditingId(r.id); setEditDraft(draftFromRow(r)); setError(null); }}
                                >
                                  <Pencil />
                                </button>
                                <button
                                  type="button"
                                  className="jl-btn jl-btn--ghost jl-btn--icon jl-btn--sm"
                                  title="Delete"
                                  aria-label="Delete"
                                  style={{ color: "var(--red-500)" }}
                                  onClick={() => void removeModel(r.id, r.name)}
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

        <p className="jl-xs jl-faint">
          CSV columns: name, manufacturer, equipment_type, year_introduced, notes. Header row required.
        </p>
      </div>
    </AppShell>
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
