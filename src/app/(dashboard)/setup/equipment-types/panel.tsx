"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/machines/data-table";
import { Field } from "@/components/machines/field";
import { Loading } from "@/components/machines/loading";
import { RowActions } from "@/components/machines/row-actions";
import { GRID } from "@/lib/ui/ui-tokens";

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

  if (loading) return <Loading />;

  const columns: Column<TypeRow>[] = [
    { key: "name", label: "Type", sortValue: (r) => r.name, cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "count", label: "Items", align: "right", sortValue: (r) => r.count, cell: (r) => <span className={GRID.num}>{r.count}</span> },
    {
      key: "actions",
      label: "",
      align: "right",
      // A type in use cannot be deleted.
      cell: (r) => <RowActions onEdit={() => openEdit(r)} onDelete={r.count === 0 ? () => deleteType(r) : undefined} />,
    },
  ];

  return (
    <div className="flex w-full max-w-4xl flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus /> New Type
        </Button>
      </div>

      {error && !isCreating && (
        <Alert variant="destructive">
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      )}

      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} empty="No equipment types yet. Create one to get started." />

      <Dialog open={isCreating} onOpenChange={(o) => { if (!o) closeForm(); }}>
        <DialogContent size="form">
          <DialogHeader>
            <DialogTitle>{editingId === null ? "New Equipment Type" : "Edit Equipment Type"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <Alert variant="destructive">
                <AlertTitle>{error}</AlertTitle>
              </Alert>
            )}
            <Field label="Name *" htmlFor="type-name">
              <Input id="type-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Laminator" />
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
