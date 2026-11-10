"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Spinner } from "@/components/ui/spinner";
import { Confirm } from "@/components/machines/confirm";
import { DataTable, type Column } from "@/components/machines/data-table";
import { Field } from "@/components/machines/field";
import { Loading } from "@/components/machines/loading";
import { Muted } from "@/components/machines/panel";
import { Pick } from "@/components/machines/pick";
import { RowActions } from "@/components/machines/row-actions";
import {
  NAV_CAPS,
  CONFIG_CAPS,
  type Permissions,
  EMPTY_PERMISSIONS,
  normalisePermissions,
} from "@/lib/permissions";
import { STORE_GROUPS } from "@/lib/store-groups";
import { useRole } from "@/lib/use-role";

type Role = "admin" | "store_staff" | "custom";

// Public user shape returned by /api/setup/users — never carries a password.
interface UserRow {
  id: number;
  email: string;
  name: string;
  role: Role;
  store: string | null;
  permissions: Permissions | null;
}

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "store_staff", label: "Store staff" },
  { value: "custom", label: "Custom access" },
];

// Distinct, sorted store list drawn from the fleet's store hierarchy.
const STORE_OPTIONS = [...new Set(STORE_GROUPS.map((s) => s.store))]
  .sort((a, b) => a.localeCompare(b))
  .map((s) => ({ value: s, label: s }));

// Human-readable summary of a custom user's grant for the table (e.g.
// "Machine Reports · Machine Mapping"). Falls back to "No access" when empty.
function grantSummary(permissions: Permissions | null): string {
  const p = normalisePermissions(permissions);
  const labels = [
    ...NAV_CAPS.filter((c) => p.nav.includes(c.key)).map((c) => c.label),
    ...CONFIG_CAPS.filter((c) => p.config.includes(c.key)).map((c) => c.label),
  ];
  if (labels.length === 0) return "No access";
  if (labels.length <= 3) return labels.join(" · ");
  return `${labels.slice(0, 2).join(" · ")} +${labels.length - 2} more`;
}

// ── Add / Edit form state ─────────────────────────────────────────────────
interface FormState {
  email: string;
  name: string;
  role: Role;
  store: string;
  permissions: Permissions;
  password: string;
}

const EMPTY_FORM: FormState = {
  email: "",
  name: "",
  role: "store_staff",
  store: "",
  permissions: EMPTY_PERMISSIONS,
  password: "",
};

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
  const custom = useMemo(() => rows.filter((r) => r.role === "custom").length, [rows]);

  if (roleLoading || loading) return <Loading label="Loading users" />;

  const columns: Column<UserRow>[] = [
    {
      key: "name",
      label: "Name",
      sortValue: (u) => u.name,
      cell: (u) => (
        <span className="inline-flex items-center gap-2.5 font-medium">
          <Avatar name={u.name} size="sm" />
          {u.name}
        </span>
      ),
    },
    { key: "email", label: "Email", hideBelow: "sm", sortValue: (u) => u.email, cell: (u) => u.email },
    {
      key: "role",
      label: "Role",
      sortValue: (u) => u.role,
      cell: (u) => (u.role === "admin" ? <Badge status="danger">Admin</Badge> : u.role === "custom" ? <Badge status="neutral">Custom</Badge> : <Badge status="info">Store staff</Badge>),
    },
    {
      key: "store",
      label: "Store",
      hideBelow: "md",
      sortValue: (u) => u.store ?? "",
      cell: (u) => (u.role === "custom" ? <Muted>{grantSummary(u.permissions)}</Muted> : u.store ?? <Muted>Global</Muted>),
    },
    ...(isAdmin
      ? [{ key: "actions", label: "", align: "right", cell: (u: UserRow) => <RowActions onEdit={() => setEditing(u)} onDelete={() => setDeleting(u)} /> } satisfies Column<UserRow>]
      : []),
  ];

  return (
    <div className="flex w-full max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Badge status="danger">{admins} admin</Badge>
        <Badge status="info">{staff} store staff</Badge>
        {custom > 0 && <Badge status="neutral">{custom} custom</Badge>}
        {isAdmin && (
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus /> Add User
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <AlertAction>
            <Button variant="outline" size="sm" onClick={() => load()}>Retry</Button>
          </AlertAction>
        </Alert>
      )}

      <DataTable columns={columns} rows={rows} rowKey={(u) => u.id} empty="No users yet" />

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
      ? {
          email: user.email,
          name: user.name,
          role: user.role,
          store: user.store ?? "",
          permissions: normalisePermissions(user.permissions),
          password: "",
        }
      : EMPTY_FORM,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  function toggleCap(kind: "nav" | "config", key: string) {
    setForm((prev) => {
      const list = prev.permissions[kind];
      const next = list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
      return { ...prev, permissions: { ...prev.permissions, [kind]: next } };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side guards mirror the API's validation.
    if (!isEdit && !form.email.trim()) return setError("Email is required");
    if (!form.name.trim()) return setError("Name is required");
    if (!isEdit && !form.password) return setError("Password is required");
    if (form.role === "store_staff" && !form.store) return setError("Store is required for store staff");
    if (
      form.role === "custom" &&
      form.permissions.nav.length === 0 &&
      form.permissions.config.length === 0
    ) {
      return setError("Select at least one menu item or config section");
    }

    setSaving(true);
    try {
      let res: Response;
      if (isEdit) {
        // PATCH: only send fields the API accepts (email is immutable).
        const body: Record<string, unknown> = {
          name: form.name.trim(),
          role: form.role,
          store: form.role === "store_staff" ? form.store : "",
          permissions: form.role === "custom" ? form.permissions : undefined,
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
            permissions: form.role === "custom" ? form.permissions : undefined,
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
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent size="form">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit user" : "Add user"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Email" htmlFor="u-email" hint={isEdit ? "Email cannot be changed." : undefined}>
            <Input id="u-email" type="email" autoComplete="off" value={form.email} onChange={(e) => set("email", e.target.value)} disabled={isEdit} required={!isEdit} />
          </Field>
          <Field label="Name" htmlFor="u-name">
            <Input id="u-name" autoComplete="off" value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </Field>
          <Field label="Role" htmlFor="u-role">
            <Pick id="u-role" value={form.role} onChange={(v) => set("role", v as Role)} options={ROLE_OPTIONS} placeholder="Select role" />
          </Field>

          {form.role === "store_staff" && (
            <Field label="Store" htmlFor="u-store">
              <Pick id="u-store" value={form.store} onChange={(v) => set("store", v)} options={STORE_OPTIONS} placeholder="Select store" />
            </Field>
          )}

          {form.role === "custom" && (
            <>
              <Field label="Menu items">
                <div className="flex flex-col gap-2.5">
                  {NAV_CAPS.map((c) => (
                    <div key={c.key} className="flex items-center gap-2.5">
                      <Checkbox id={`u-nav-${c.key}`} checked={form.permissions.nav.includes(c.key)} onCheckedChange={() => toggleCap("nav", c.key)} />
                      <Label htmlFor={`u-nav-${c.key}`}>{c.label}</Label>
                    </div>
                  ))}
                </div>
              </Field>
              <Field label="Config sections" hint="The Config menu appears when at least one section is selected.">
                <div className="flex flex-col gap-2.5">
                  {CONFIG_CAPS.map((c) => (
                    <div key={c.key} className="flex items-center gap-2.5">
                      <Checkbox id={`u-config-${c.key}`} checked={form.permissions.config.includes(c.key)} onCheckedChange={() => toggleCap("config", c.key)} />
                      <Label htmlFor={`u-config-${c.key}`}>{c.label}</Label>
                    </div>
                  ))}
                </div>
              </Field>
            </>
          )}

          <Field label={isEdit ? "New password" : "Password"} htmlFor="u-password">
            <PasswordInput
              id="u-password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder={isEdit ? "Leave blank to keep current" : ""}
              required={!isEdit}
            />
          </Field>

          {error && (
            <Alert variant="destructive" role="alert">
              <AlertTitle>{error}</AlertTitle>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner />}
              {isEdit ? "Save changes" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
    <Confirm
      open
      onOpenChange={(o) => { if (!o) onClose(); }}
      title="Delete user"
      detail={error ?? `Delete ${user.name} (${user.email})? This cannot be undone.`}
      action="Delete"
      destructive
      pending={deleting}
      onConfirm={handleDelete}
    />
  );
}
