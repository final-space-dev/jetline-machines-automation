"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/machines/data-table";
import { Field } from "@/components/machines/field";
import { Loading } from "@/components/machines/loading";
import { Muted } from "@/components/machines/panel";
import { Pick } from "@/components/machines/pick";
import { RowActions } from "@/components/machines/row-actions";

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

// A condition's colour as a kit badge status.
const STATUS: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  green: "success",
  amber: "warning",
  red: "danger",
  blue: "info",
  grey: "neutral",
};

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

  if (loading) return <Loading />;

  const columns: Column<ConditionRow>[] = [
    { key: "label", label: "Label", sortValue: (r) => r.label, cell: (r) => <span className="font-medium">{r.label}</span> },
    { key: "color", label: "Colour", cell: (r) => <Badge status={STATUS[r.color] ?? "neutral"}>{COLOR_OPTIONS.find((c) => c.value === r.color)?.label ?? r.color}</Badge> },
    {
      key: "keywords",
      label: "Keyword Triggers",
      hideBelow: "sm",
      cell: (r) =>
        r.keywords.length === 0 ? (
          <Muted>None</Muted>
        ) : (
          <span className="flex flex-wrap gap-1.5">
            {r.keywords.map((k) => <Badge key={k} variant="secondary">{k}</Badge>)}
          </span>
        ),
    },
    { key: "actions", label: "", align: "right", cell: (r) => <RowActions onEdit={() => openEdit(r)} onDelete={() => deleteCondition(r.id)} /> },
  ];

  return (
    <div className="flex w-full max-w-5xl flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus /> New Condition
        </Button>
      </div>

      {error && !isCreating && (
        <Alert variant="destructive">
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      )}

      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} empty="No conditions yet. Create one to get started." />

      <Dialog open={isCreating} onOpenChange={(o) => { if (!o) closeForm(); }}>
        <DialogContent size="form">
          <DialogHeader>
            <DialogTitle>{editingId === null ? "New Condition" : "Edit Condition"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <Alert variant="destructive">
                <AlertTitle>{error}</AlertTitle>
              </Alert>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Label *" htmlFor="condition-label">
                <Input id="condition-label" autoFocus value={label} onChange={(e) => setLabel(e.target.value)} required placeholder="e.g. Needs Repair" />
              </Field>
              <Field label="Colour" htmlFor="condition-colour">
                <Pick id="condition-colour" value={color} onChange={setColor} options={COLOR_OPTIONS} />
              </Field>
            </div>
            <Field label="Keyword Triggers" htmlFor="condition-keywords">
              <Input id="condition-keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="Comma separated, e.g. broken, jam, error" />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
              <Button type="submit" disabled={saving}>{editingId === null ? "Create" : "Update"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
