"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Trash2, Plus, Search, Building2 } from "lucide-react";
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
    if (!confirm(`Delete supplier "${s.name}"? Items already referencing it keep their stored value.`)) return;
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
    }
  }, []);

  if (loading) {
    return (
      <div className="jl-card jl-card--pad-lg" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="jl-spinner jl-spinner--sm" />
        <span className="jl-sm jl-muted">Loading suppliers</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="jl-badge">{rows.length} suppliers</span>
          {!isAdmin && <span className="jl-badge jl-badge--amber">Read only</span>}
        </div>
        {isAdmin && (
          <button type="button" className="jl-btn jl-btn--primary" onClick={openAdd}>
            <Plus size={16} /> Add supplier
          </button>
        )}
      </div>

      {error && (
        <div className="jl-alert jl-alert--red" role="alert">
          <div className="jl-alert__body"><div className="jl-alert__text">{error}</div></div>
        </div>
      )}

      <div style={{ maxWidth: 380 }}>
        <div className="jl-search">
          <Search size={16} />
          <input placeholder="Search suppliers" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {/* Add / edit form */}
      {editingId !== null && (
        <form onSubmit={submit} className="jl-card" style={{ display: "flex", flexDirection: "column", gap: 14, padding: 18 }}>
          <span className="jl-h3" style={{ color: "var(--ink-900)" }}>{editingId === 0 ? "New supplier" : "Edit supplier"}</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
            <div className="jl-field">
              <label>Name *</label>
              <input className="jl-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Supplier name" autoFocus />
            </div>
            <div className="jl-field">
              <label>Contact person</label>
              <input className="jl-input" value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} placeholder="Contact name" />
            </div>
            <div className="jl-field">
              <label>Phone</label>
              <input className="jl-input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Contact number" />
            </div>
            <div className="jl-field">
              <label>Email</label>
              <input className="jl-input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="name@supplier.co.za" />
            </div>
          </div>
          <div className="jl-field">
            <label>Notes</label>
            <textarea className="jl-textarea" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Account number, terms, etc." />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
            {saving && <span className="jl-spinner jl-spinner--sm" />}
            <button type="button" className="jl-btn jl-btn--ghost" onClick={close} disabled={saving}>Cancel</button>
            <button type="submit" className="jl-btn jl-btn--primary" disabled={saving}>{editingId === 0 ? "Create" : "Save changes"}</button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="jl-table-wrap">
        <div style={{ overflowX: "auto" }}>
          <table className="jl-table" style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <th style={{ minWidth: 180 }}>Name</th>
                <th>Contact</th>
                <th>Phone</th>
                <th>Email</th>
                {isAdmin && <th style={{ width: 96 }} />}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} style={{ textAlign: "center", padding: "40px 16px" }}>
                    <span className="jl-sm jl-muted">
                      {query ? "No suppliers match your search." : "No suppliers yet. Add one, or they'll appear here once equipment records reference them."}
                    </span>
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id}>
                    <td className="cell-strong">
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <Building2 size={15} style={{ color: "var(--ink-400)" }} /> {s.name}
                      </span>
                    </td>
                    <td style={{ color: "var(--ink-600)" }}>{s.contact ?? <span className="jl-muted">—</span>}</td>
                    <td style={{ color: "var(--ink-600)" }}>{s.phone ?? <span className="jl-muted">—</span>}</td>
                    <td style={{ color: "var(--ink-600)" }}>{s.email ?? <span className="jl-muted">—</span>}</td>
                    {isAdmin && (
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button type="button" className="jl-btn jl-btn--ghost jl-btn--icon jl-btn--sm" aria-label={`Edit ${s.name}`} onClick={() => openEdit(s)}>
                            <Pencil size={15} />
                          </button>
                          <button type="button" className="jl-btn jl-btn--ghost jl-btn--icon jl-btn--sm" aria-label={`Delete ${s.name}`} onClick={() => remove(s)}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
