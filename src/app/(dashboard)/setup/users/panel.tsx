"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { JlSelect } from "@/components/ui/jl-select";
import { useRole } from "@/lib/use-role";
import { STORE_GROUPS } from "@/lib/store-groups";
import { Eye, EyeOff, Pencil, Trash2, Plus, X } from "lucide-react";

type Role = "admin" | "store_staff";

// Public user shape returned by /api/setup/users — never carries a password.
interface UserRow {
  id: number;
  email: string;
  name: string;
  role: Role;
  store: string | null;
}

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "store_staff", label: "Store staff" },
];

// Distinct, sorted store list drawn from the fleet's store hierarchy.
const STORE_OPTIONS = [...new Set(STORE_GROUPS.map((s) => s.store))]
  .sort((a, b) => a.localeCompare(b))
  .map((s) => ({ value: s, label: s }));

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Add / Edit form state ─────────────────────────────────────────────────
interface FormState {
  email: string;
  name: string;
  role: Role;
  store: string;
  password: string;
}

const EMPTY_FORM: FormState = { email: "", name: "", role: "store_staff", store: "", password: "" };

export function UsersPanel() {
  const { isAdmin, loading: roleLoading } = useRole();

  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal: null = closed, "new" = create, or the user being edited.
  const [editing, setEditing] = useState<"new" | UserRow | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/setup/users");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load users");
        setRows([]);
        return;
      }
      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch {
      setError("Failed to load users");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const admins = useMemo(() => rows.filter((r) => r.role === "admin").length, [rows]);
  const staff = useMemo(() => rows.filter((r) => r.role === "store_staff").length, [rows]);

  if (roleLoading || loading) {
    return (
      <div className="jl-card jl-card--pad-lg" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="jl-spinner jl-spinner--sm" />
        <span className="jl-sm jl-muted">Loading users</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ---- Header ---- */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="jl-badge jl-badge--red">{admins} admin</span>
          <span className="jl-badge jl-badge--blue">{staff} store staff</span>
          {isAdmin && (
            <button className="jl-btn jl-btn--primary jl-btn--sm" onClick={() => setEditing("new")}>
              <Plus size={16} /> Add User
            </button>
          )}
        </div>
      </div>

      {/* ---- Error banner ---- */}
      {error && (
        <div className="jl-alert jl-alert--red" role="alert">
          <span className="jl-chip jl-chip--solid">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
          </span>
          <div className="jl-alert__body">
            <div className="jl-alert__title">Something went wrong</div>
            <div className="jl-alert__text">{error}</div>
          </div>
          <button className="jl-btn jl-btn--soft jl-btn--sm" onClick={() => load()}>
            Retry
          </button>
        </div>
      )}

      {/* ---- Users table ---- */}
      <div className="jl-table-wrap">
        <div style={{ overflowX: "auto" }}>
          <table className="jl-table" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>Name</th>
                <th style={{ minWidth: 220 }}>Email</th>
                <th style={{ width: 140 }}>Role</th>
                <th style={{ minWidth: 140 }}>Store</th>
                <th style={{ width: 110, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "40px 16px" }}>
                    <span className="jl-sm jl-muted">No users yet.</span>
                  </td>
                </tr>
              ) : (
                rows.map((u) => (
                  <tr key={u.id}>
                    <td className="cell-strong">
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                        <span className="jl-avatar jl-avatar--sm">{initials(u.name)}</span>
                        {u.name}
                      </span>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      {u.role === "admin" ? (
                        <span className="jl-badge jl-badge--red">Admin</span>
                      ) : (
                        <span className="jl-badge jl-badge--blue">Store staff</span>
                      )}
                    </td>
                    <td>{u.store ?? <span className="jl-muted">Global</span>}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button
                          className="jl-btn jl-btn--ghost jl-btn--icon jl-btn--sm"
                          onClick={() => setEditing(u)}
                          disabled={!isAdmin}
                          aria-label={`Edit ${u.name}`}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="jl-btn jl-btn--ghost jl-btn--icon jl-btn--sm"
                          onClick={() => setDeleting(u)}
                          disabled={!isAdmin}
                          aria-label={`Delete ${u.name}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- Add / Edit modal ---- */}
      {editing !== null && (
        <UserModal
          user={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      {/* ---- Delete confirm modal ---- */}
      {deleting !== null && (
        <DeleteModal
          user={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// ── Add / Edit user modal ─────────────────────────────────────────────────
function UserModal({
  user,
  onClose,
  onSaved,
}: {
  user: UserRow | null; // null = create
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = user !== null;

  const [form, setForm] = useState<FormState>(
    user
      ? { email: user.email, name: user.name, role: user.role, store: user.store ?? "", password: "" }
      : EMPTY_FORM,
  );
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side guards mirror the API's validation.
    if (!isEdit && !form.email.trim()) return setError("Email is required");
    if (!form.name.trim()) return setError("Name is required");
    if (!isEdit && !form.password) return setError("Password is required");
    if (form.role === "store_staff" && !form.store) return setError("Store is required for store staff");

    setSaving(true);
    try {
      let res: Response;
      if (isEdit) {
        // PATCH: only send fields the API accepts (email is immutable).
        const body: Record<string, unknown> = {
          name: form.name.trim(),
          role: form.role,
          store: form.role === "store_staff" ? form.store : "",
        };
        if (form.password) body.password = form.password;
        res = await fetch(`/api/setup/users/${user!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/setup/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: form.email.trim(),
            name: form.name.trim(),
            role: form.role,
            store: form.role === "store_staff" ? form.store : "",
            password: form.password,
          }),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to save user");
        return;
      }
      onSaved();
    } catch {
      setError("Failed to save user");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="jl-overlay" data-open onMouseDown={onClose}>
      <div
        className="jl-modal"
        style={{ maxWidth: 480 }}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Edit user" : "Add user"}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div className="jl-modal__title">{isEdit ? "Edit user" : "Add user"}</div>
          <button
            className="jl-btn jl-btn--ghost jl-btn--icon jl-btn--sm"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 20 }}>
          <div className="jl-field">
            <label htmlFor="u-email">Email</label>
            <input
              id="u-email"
              className="jl-input"
              type="email"
              autoComplete="off"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              disabled={isEdit}
              required={!isEdit}
            />
            {isEdit && <span className="hint">Email cannot be changed.</span>}
          </div>

          <div className="jl-field">
            <label htmlFor="u-name">Name</label>
            <input
              id="u-name"
              className="jl-input"
              type="text"
              autoComplete="off"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
            />
          </div>

          <div className="jl-field">
            <label>Role</label>
            <JlSelect
              value={form.role}
              onChange={(v) => set("role", v as Role)}
              options={ROLE_OPTIONS}
              placeholder="Select role"
            />
          </div>

          {form.role === "store_staff" && (
            <div className="jl-field">
              <label>Store</label>
              <JlSelect
                value={form.store}
                onChange={(v) => set("store", v)}
                options={STORE_OPTIONS}
                placeholder="Select store"
              />
            </div>
          )}

          <div className="jl-field">
            <label htmlFor="u-password">{isEdit ? "New password" : "Password"}</label>
            <div className="jl-input-group">
              <input
                id="u-password"
                className="jl-input"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder={isEdit ? "Leave blank to keep current" : ""}
                required={!isEdit}
                style={{ paddingRight: 48 }}
              />
              <span className="trail">
                <button
                  type="button"
                  className="jl-btn jl-btn--ghost jl-btn--icon jl-btn--sm"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </span>
            </div>
          </div>

          {error && (
            <div className="jl-alert jl-alert--red" role="alert">
              <div className="jl-alert__body">
                <div className="jl-alert__text">{error}</div>
              </div>
            </div>
          )}

          <div className="jl-modal__foot">
            <button type="button" className="jl-btn jl-btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="jl-btn jl-btn--primary"
              disabled={saving}
              data-loading={saving || undefined}
            >
              {isEdit ? "Save changes" : "Create user"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete confirm modal ──────────────────────────────────────────────────
function DeleteModal({
  user,
  onClose,
  onDeleted,
}: {
  user: UserRow;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/setup/users/${user.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to delete user");
        return;
      }
      onDeleted();
    } catch {
      setError("Failed to delete user");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="jl-overlay" data-open onMouseDown={onClose}>
      <div
        className="jl-modal"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Delete user"
      >
        <div className="jl-modal__title">Delete user</div>
        <div className="jl-modal__text">
          Delete <strong style={{ color: "var(--ink-900)" }}>{user.name}</strong> ({user.email})?
          This cannot be undone.
        </div>

        {error && (
          <div className="jl-alert jl-alert--red" role="alert" style={{ marginTop: 16 }}>
            <div className="jl-alert__body">
              <div className="jl-alert__text">{error}</div>
            </div>
          </div>
        )}

        <div className="jl-modal__foot">
          <button type="button" className="jl-btn jl-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="jl-btn jl-btn--primary"
            onClick={handleDelete}
            disabled={deleting}
            data-loading={deleting || undefined}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
