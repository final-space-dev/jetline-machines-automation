"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Upload, X } from "lucide-react";
import { Alert, AlertAction, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Confirm } from "@/components/machines/confirm";
import { DataTable, type Column } from "@/components/machines/data-table";
import { Field } from "@/components/machines/field";
import { FilePicker } from "@/components/machines/file-picker";
import { Loading } from "@/components/machines/loading";
import { Muted } from "@/components/machines/panel";
import { Pick } from "@/components/machines/pick";
import { RowActions } from "@/components/machines/row-actions";
import { GRID } from "@/lib/ui/ui-tokens";
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

  // The model whose deletion is being confirmed.
  const [deleting, setDeleting] = useState<ModelRow | null>(null);

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

  async function removeModel(id: number) {
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
      setDeleting(null);
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

  if (roleLoading) return <Loading />;

  const columns: Column<ModelRow>[] = [
    { key: "name", label: "Model Name", sortValue: (r) => r.name, cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "manufacturer", label: "Manufacturer", hideBelow: "sm", sortValue: (r) => r.manufacturer ?? "", cell: (r) => r.manufacturer || <Muted>Not set</Muted> },
    { key: "type", label: "Type", sortValue: (r) => r.equipment_type, cell: (r) => <Badge status="info">{r.equipment_type}</Badge> },
    { key: "year", label: "Year", align: "right", hideBelow: "md", sortValue: (r) => r.year_introduced ?? 0, cell: (r) => <span className={GRID.num}>{r.year_introduced ?? <Muted>Not set</Muted>}</span> },
    { key: "items", label: "Items", align: "right", hideBelow: "sm", sortValue: (r) => r.item_count, cell: (r) => <span className={GRID.num}>{r.item_count}</span> },
    ...(isAdmin
      ? [{ key: "actions", label: "", align: "right", cell: (r: ModelRow) => <RowActions onEdit={() => openEdit(r)} onDelete={() => setDeleting(r)} disabled={busy} /> } satisfies Column<ModelRow>]
      : []),
  ];

  return (
    <div className="flex w-full max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{rows.length} models</Badge>
          {!isAdmin && <Badge status="warning">Read only</Badge>}
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <FilePicker accept=".csv,text/csv" disabled={busy} onFiles={(files) => void importCsv(files[0])}>
              <Upload /> Import CSV
            </FilePicker>
            <Button size="sm" disabled={busy} onClick={openCreate}>
              <Plus /> Add Model
            </Button>
          </div>
        )}
      </div>

      {error && !showForm && (
        <Alert variant="destructive">
          <AlertTitle>{error}</AlertTitle>
          <AlertAction>
            <Button variant="ghost" size="icon-sm" onClick={() => setError(null)} aria-label="Dismiss">
              <X />
            </Button>
          </AlertAction>
        </Alert>
      )}
      {notice && (
        <Alert variant="info">
          <AlertTitle>{notice}</AlertTitle>
          <AlertAction>
            <Button variant="ghost" size="icon-sm" onClick={() => setNotice(null)} aria-label="Dismiss">
              <X />
            </Button>
          </AlertAction>
        </Alert>
      )}

      {loading ? (
        <Loading label="Loading models" />
      ) : (
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} empty="No models yet. Add one to start the catalogue." pageSize={50} />
      )}

      <Muted>CSV columns: name, manufacturer, equipment_type, year_introduced, notes. Header row required.</Muted>

      <Dialog open={showForm && isAdmin} onOpenChange={(o) => { if (!o) closeForm(); }}>
        <DialogContent size="form">
          <DialogHeader>
            <DialogTitle>{editingId == null ? "Add Model" : "Edit Model"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <Alert variant="destructive">
                <AlertTitle>{error}</AlertTitle>
              </Alert>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Model Name *" htmlFor="model-name">
                <Input id="model-name" autoFocus placeholder="Polar Mohr 76 EM" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>
              <Field label="Manufacturer" htmlFor="model-make">
                <Input id="model-make" placeholder="Polar Mohr" value={draft.manufacturer} onChange={(e) => setDraft({ ...draft, manufacturer: e.target.value })} />
              </Field>
              <Field label="Type *" htmlFor="model-type">
                <Pick id="model-type" value={draft.equipment_type} onChange={(v) => setDraft({ ...draft, equipment_type: v })} options={typeOptions} placeholder="Select type" />
              </Field>
              <Field label="Year Introduced" htmlFor="model-year">
                <Input id="model-year" inputMode="numeric" placeholder="2019" value={draft.year_introduced} onChange={(e) => setDraft({ ...draft, year_introduced: e.target.value.replace(/[^\d]/g, "") })} />
              </Field>
            </div>
            <Field label="Notes" htmlFor="model-notes">
              <Input id="model-notes" placeholder="Optional" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
              <Button type="submit" disabled={busy}>{editingId == null ? "Create" : "Update"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Confirm
        open={deleting !== null}
        onOpenChange={(o) => { if (!o) setDeleting(null); }}
        title={`Delete model "${deleting?.name ?? ""}"?`}
        detail="Items using it keep their make/model text."
        action="Delete"
        destructive
        pending={busy}
        onConfirm={() => { if (deleting) void removeModel(deleting.id); }}
      />
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
