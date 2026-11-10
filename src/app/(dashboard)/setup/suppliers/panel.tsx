"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Confirm } from "@/components/machines/confirm";
import { DataTable, type Column } from "@/components/machines/data-table";
import { Field } from "@/components/machines/field";
import { Loading } from "@/components/machines/loading";
import { Muted } from "@/components/machines/panel";
import { RowActions } from "@/components/machines/row-actions";
import { useRole } from "@/lib/use-role";

/**
 * Suppliers — a shared CRM picklist used by both equipment and printers to record
 * where an item was bought. Backed by /api/setup/suppliers.
 */

interface Supplier {
  id: number;
  name: string;
  contact: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

interface Form {
  name: string;
  contact: string;
  phone: string;
  email: string;
  notes: string;
}

const EMPTY: Form = { name: "", contact: "", phone: "", email: "", notes: "" };

export function SuppliersPanel() {
  const { isAdmin } = useRole();
  const [rows, setRows] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  // editingId: null = closed, 0 = adding new, >0 = editing that supplier.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  // The supplier whose deletion is being confirmed.
  const [deleting, setDeleting] = useState<Supplier | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/setup/suppliers");
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to load suppliers"); setRows([]); return; }
      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch {
      setError("Failed to load suppliers"); setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.contact, r.phone, r.email].some((v) => (v ?? "").toLowerCase().includes(q)),
    );
  }, [rows, query]);

  const openAdd = () => { setForm(EMPTY); setEditingId(0); setError(null); };
  const openEdit = (s: Supplier) => {
    setForm({ name: s.name, contact: s.contact ?? "", phone: s.phone ?? "", email: s.email ?? "", notes: s.notes ?? "" });
    setEditingId(s.id);
    setError(null);
  };
  const close = () => { setEditingId(null); setForm(EMPTY); };

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError(null);
    try {
      const isNew = editingId === 0;
      const res = await fetch("/api/setup/suppliers", {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isNew ? form : { id: editingId, ...form }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save"); return; }
      const row = data.row as Supplier;
      setRows((prev) => (isNew ? [...prev, row] : prev.map((r) => (r.id === row.id ? row : r))).sort((a, b) => a.name.localeCompare(b.name)));
      close();
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  }, [form, editingId]);

  const remove = useCallback(async (s: Supplier) => {
    setSaving(true);
    try {
      const res = await fetch("/api/setup/suppliers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: s.id }),
      });
      if (res.ok) setRows((prev) => prev.filter((r) => r.id !== s.id));
      else { const d = await res.json(); setError(d.error || "Failed to delete"); }
    } finally {
      setSaving(false);
      setDeleting(null);
    }
  }, []);

  if (loading) return <Loading label="Loading suppliers" />;

  const dash = (v: string | null) => v ?? <Muted>—</Muted>;
  const columns: Column<Supplier>[] = [
    { key: "name", label: "Name", sortValue: (s) => s.name, cell: (s) => <span className="font-medium">{s.name}</span> },
    { key: "contact", label: "Contact", hideBelow: "sm", sortValue: (s) => s.contact ?? "", cell: (s) => dash(s.contact) },
    { key: "phone", label: "Phone", hideBelow: "md", cell: (s) => dash(s.phone) },
    { key: "email", label: "Email", hideBelow: "md", cell: (s) => dash(s.email) },
    ...(isAdmin
      ? [{ key: "actions", label: "", align: "right", cell: (s: Supplier) => <RowActions onEdit={() => openEdit(s)} onDelete={() => setDeleting(s)} disabled={saving} /> } satisfies Column<Supplier>]
      : []),
  ];

  return (
    <div className="flex w-full max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{rows.length} suppliers</Badge>
          {!isAdmin && <Badge status="warning">Read only</Badge>}
        </div>
        {isAdmin && (
          <Button size="sm" onClick={openAdd}>
            <Plus /> Add supplier
          </Button>
        )}
      </div>

      {error && editingId === null && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      )}

      <div className="relative w-full sm:w-80">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
        <Input type="search" placeholder="Search suppliers" aria-label="Search suppliers" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(s) => s.id}
        empty={query ? "No suppliers match your search" : "No suppliers yet. Add one, or they'll appear here once equipment records reference them."}
      />

      <Dialog open={editingId !== null} onOpenChange={(o) => { if (!o) close(); }}>
        <DialogContent size="form">
          <DialogHeader>
            <DialogTitle>{editingId === 0 ? "New supplier" : "Edit supplier"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="flex flex-col gap-4">
            {error && (
              <Alert variant="destructive" role="alert">
                <AlertTitle>{error}</AlertTitle>
              </Alert>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name *" htmlFor="supplier-name">
                <Input id="supplier-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Supplier name" autoFocus />
              </Field>
              <Field label="Contact person" htmlFor="supplier-contact">
                <Input id="supplier-contact" value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} placeholder="Contact name" />
              </Field>
              <Field label="Phone" htmlFor="supplier-phone">
                <Input id="supplier-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Contact number" />
              </Field>
              <Field label="Email" htmlFor="supplier-email">
                <Input id="supplier-email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="name@supplier.co.za" />
              </Field>
            </div>
            <Field label="Notes" htmlFor="supplier-notes">
              <Textarea id="supplier-notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Account number, terms, etc." rows={3} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Spinner />}
                {editingId === 0 ? "Create" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Confirm
        open={deleting !== null}
        onOpenChange={(o) => { if (!o) setDeleting(null); }}
        title={`Delete supplier "${deleting?.name ?? ""}"?`}
        detail="Items already referencing it keep their stored value."
        action="Delete"
        destructive
        pending={saving}
        onConfirm={() => { if (deleting) remove(deleting); }}
      />
    </div>
  );
}
