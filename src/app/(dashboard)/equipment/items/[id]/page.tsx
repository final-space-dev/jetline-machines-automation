"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { EquipmentItemSkeleton } from "@/components/equipment/skeleton";
import { EquipmentErrorBoundary } from "@/components/equipment/error-boundary";
import { useHotkeys } from "@/lib/use-hotkey";
import { addRecentItem } from "@/lib/recently-viewed";
import { useRole } from "@/lib/use-role";
import { toast } from "sonner";
import {
  Save, Trash2, AlertTriangle, Clock, Package,
  Wrench, ShoppingCart, Upload, X, Check,
} from "lucide-react";
import Link from "next/link";
import {
  EQUIPMENT_TYPES, EQUIPMENT_STATUSES, STATUS_CONFIG, ALL_XEROX_STORES,
  type EquipmentStatus,
} from "@/lib/equipment-utils";
import { JlSelect } from "@/components/ui/jl-select";
import { JlDate } from "@/components/ui/jl-date";
import { ModelSuggest } from "@/components/equipment/model-suggest";
import { FeedbackPanel } from "@/components/equipment/feedback-panel";

// ─── Types ───────────────────────────────────────────────────────────────────

interface EquipmentItem {
  id: number;
  store: string;
  machine_type: string;
  make_model: string | null;
  serial: string | null;
  condition: string | null;
  located_at: string | null;
  status: EquipmentStatus;
  purchase_date: string | null;
  supplier: string | null;
  purchase_price: string | null;
  warranty_expiry: string | null;
  last_serviced: string | null;
  next_service_due: string | null;
  service_provider: string | null;
  notes: string | null;
  photos: string[] | null;
  updated_at: string;
}

interface ChangeLogEntry {
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string;
  changed_at: string;
}

const CONDITION_BUCKETS = ["Good", "Fair", "Poor"] as const;
type ConditionBucket = typeof CONDITION_BUCKETS[number];

const REPLACE_OPTIONS = ["Yes", "Maybe", "No"] as const;
type ReplaceValue = typeof REPLACE_OPTIONS[number];

// Notes marker used to persist the replace-recommendation without a DB column.
const REPLACE_TAG = /\[replace:(Yes|Maybe|No)\]\s*/i;

function extractReplace(notes: string | null): ReplaceValue | null {
  if (!notes) return null;
  const m = notes.match(REPLACE_TAG);
  return m ? (m[1] as ReplaceValue) : null;
}
function stripReplace(notes: string | null): string {
  return (notes ?? "").replace(REPLACE_TAG, "").trimStart();
}
function withReplace(cleanNotes: string, replace: ReplaceValue | null): string {
  const body = cleanNotes ?? "";
  return replace ? `[replace:${replace}] ${body}`.trimEnd() : body;
}

function isBucket(v: string | null | undefined): v is ConditionBucket {
  return v === "Good" || v === "Fair" || v === "Poor";
}

// Map a condition / replace value onto a Jetline badge modifier.
function conditionBadge(v: ConditionBucket): string {
  return v === "Good" ? "jl-badge--green" : v === "Fair" ? "jl-badge--amber" : "jl-badge--red";
}
function statusBadge(s: EquipmentStatus): string {
  if (s === "active") return "jl-badge--green";
  if (s === "disposed") return "jl-badge--red";
  if (s === "transferred") return "jl-badge--blue";
  return "jl-badge";
}

// ─── Section card ─────────────────────────────────────────────────────────────

function Section({ icon: Icon, title, children }: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="jl-card" style={{ display: "grid", gap: "var(--s-5)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)" }}>
        <span className="jl-chip jl-chip--sm"><Icon /></span>
        <h2 className="jl-h3">{title}</h2>
      </div>
      {children}
    </section>
  );
}

// ─── Segmented control (Condition / Replace / Status) ─────────────────────────

function Segment<T extends string>({
  options, value, onSelect, labelFor, disabled,
}: {
  options: readonly T[];
  value: T | null;
  onSelect: (v: T) => void;
  labelFor?: (v: T) => string;
  disabled?: boolean;
}) {
  return (
    <div className="jl-segment" role="group">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          disabled={disabled}
          aria-selected={value === opt}
          onClick={() => onSelect(opt)}
        >
          {labelFor ? labelFor(opt) : opt}
        </button>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EquipmentItemPage() {
  const { id } = useParams();
  const router = useRouter();

  const [item, setItem] = useState<EquipmentItem | null>(null);
  const [log, setLog] = useState<ChangeLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<Partial<EquipmentItem>>({});

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const savedFlashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const loadedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Role flag from the authenticated session. While the session loads,
  // isAdmin is false so admin-only cards stay hidden (least-privileged default).
  const { isAdmin } = useRole();

  const load = useCallback(async () => {
    setLoading(true);
    loadedRef.current = false;
    try {
      const res = await fetch(`/api/equipment/items/${id}`);
      if (!res.ok) { router.push("/equipment"); return; }
      const data = await res.json();
      setItem(data.item);
      setLog(data.log ?? []);
      setForm(data.item);
      addRecentItem({
        type: "item",
        id: String(data.item.id),
        label: `${data.item.machine_type}${data.item.make_model ? ` · ${data.item.make_model}` : ""}`,
        sub: data.item.store,
        href: `/equipment/items/${data.item.id}`,
      });
    } finally {
      setLoading(false);
      loadedRef.current = true;
    }
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  const flashSaved = useCallback(() => {
    setSavedFlash(true);
    clearTimeout(savedFlashTimer.current);
    savedFlashTimer.current = setTimeout(() => setSavedFlash(false), 3000);
  }, []);

  const set = (k: keyof EquipmentItem, v: string | null) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };

  // Persist arbitrary fields. `immediate` PATCHes now (used by toggles / photos).
  const saveFields = useCallback(async (fields: Partial<EquipmentItem>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/equipment/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItem(data.item);
      setForm(data.item);
      setDirty(false);
      flashSaved();
      // Refresh change history quietly.
      fetch(`/api/equipment/items/${id}`).then((r) => r.json()).then((d) => setLog(d.log ?? [])).catch(() => {});
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }, [id, flashSaved]);

  const save = useCallback(() => {
    clearTimeout(autoSaveTimer.current);
    if (!dirty && !saving) return;
    saveFields(form);
  }, [dirty, saving, form, saveFields]);

  useHotkeys([
    { key: "s", modifiers: ["cmd"], onTrigger: () => { if (dirty) save(); } },
    { key: "s", modifiers: ["ctrl"], onTrigger: () => { if (dirty) save(); } },
    { key: "Escape", onTrigger: () => { if (item) router.push(`/equipment/stores/${encodeURIComponent(item.store)}`); } },
  ]);

  // Debounced auto-save 2s after last change.
  useEffect(() => {
    if (!loadedRef.current || !dirty) return;
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => { saveFields(form); }, 2000);
    return () => clearTimeout(autoSaveTimer.current);
  }, [form, dirty, saveFields]);

  useEffect(() => () => {
    clearTimeout(autoSaveTimer.current);
    clearTimeout(savedFlashTimer.current);
  }, []);

  const deleteItem = async () => {
    try {
      const res = await fetch(`/api/equipment/items/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Item deleted");
      router.push(`/equipment/stores/${encodeURIComponent(item!.store)}`);
    } catch {
      toast.error("Failed to delete");
    }
  };

  // ── Condition + Replace immediate save ──
  const selectCondition = (c: ConditionBucket) => {
    setForm((f) => ({ ...f, condition: c }));
    setDirty(false);
    saveFields({ condition: c });
  };

  const currentReplace = extractReplace(form.notes ?? null);
  const notesBody = stripReplace(form.notes ?? null);

  const selectReplace = (r: ReplaceValue) => {
    const next = withReplace(notesBody, currentReplace === r ? null : r);
    setForm((f) => ({ ...f, notes: next }));
    setDirty(false);
    saveFields({ notes: next });
  };

  const setNotesBody = (text: string) => {
    const next = withReplace(text, currentReplace);
    set("notes", next);
  };

  // ── Photos ──
  const uploadPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append("files", f));
      const res = await fetch(`/api/equipment/items/${id}/photos`, { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItem((it) => (it ? { ...it, photos: data.photos } : it));
      setForm((f) => ({ ...f, photos: data.photos }));
      toast.success(`${(data.added?.length ?? 0)} photo(s) uploaded`);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deletePhoto = async (url: string) => {
    try {
      const res = await fetch(`/api/equipment/items/${id}/photos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItem((it) => (it ? { ...it, photos: data.photos } : it));
      setForm((f) => ({ ...f, photos: data.photos }));
    } catch {
      toast.error("Failed to remove photo");
    }
  };

  if (loading) {
    return <AppShell><EquipmentItemSkeleton /></AppShell>;
  }
  if (!item) return null;

  const statCfg = STATUS_CONFIG[form.status ?? "active"];
  const conditionValue: ConditionBucket | null = isBucket(form.condition) ? form.condition : null;
  const legacyCondition = form.condition && !isBucket(form.condition) ? form.condition : null;
  const photos = form.photos ?? [];
  const itemLabel = [item.machine_type, item.make_model].filter(Boolean).join(" · ");
  const overdue = form.next_service_due != null && new Date(form.next_service_due) < new Date();

  return (
    <AppShell>
      <EquipmentErrorBoundary>
      <div style={{ background: "var(--canvas)", color: "var(--ink-900)", minHeight: "100vh" }}>
        {/* ── Sticky top bar ── */}
        <div style={{
          position: "sticky", top: 0, zIndex: 10,
          background: "var(--surface)", boxShadow: "var(--sh-sm)",
          padding: "0 var(--s-8)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: "var(--s-4)", height: 64,
        }}>
          <nav className="jl-breadcrumb" style={{ minWidth: 0 }}>
            <Link href={`/equipment/stores/${encodeURIComponent(item.store)}`}>{item.store}</Link>
            <span className="sep">/</span>
            <span className="current" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.machine_type}
            </span>

            {saving && (
              <span className="jl-badge" style={{ marginLeft: "var(--s-2)" }}>
                <span className="jl-spinner jl-spinner--sm" style={{ width: 12, height: 12, borderWidth: 2 }} /> Saving
              </span>
            )}
            {!saving && savedFlash && (
              <span className="jl-badge jl-badge--green" style={{ marginLeft: "var(--s-2)" }}>
                <Check /> Saved
              </span>
            )}
            {!saving && !savedFlash && dirty && (
              <span className="jl-badge jl-badge--amber" style={{ marginLeft: "var(--s-2)" }}>
                Unsaved changes
              </span>
            )}
          </nav>

          <div style={{ display: "flex", gap: "var(--s-3)", flexShrink: 0 }}>
            {isAdmin && (
              <button type="button" className="jl-btn jl-btn--soft" onClick={() => setShowDelete(true)}>
                <Trash2 /> Delete
              </button>
            )}
            <button
              type="button"
              className="jl-btn jl-btn--primary"
              onClick={save}
              disabled={saving || !dirty}
              data-loading={saving ? true : undefined}
            >
              <Save /> Save
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "var(--s-7) var(--s-8)", display: "grid", gap: "var(--s-6)" }}>

          {/* Record header */}
          <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--s-4)" }}>
            <div style={{ minWidth: 0 }}>
              <h1 className="jl-display">
                {item.machine_type}
                {item.make_model && (
                  <span className="jl-muted" style={{ fontWeight: "var(--fw-medium)", fontSize: "var(--fs-h2)", marginLeft: "var(--s-3)" }}>
                    {item.make_model}
                  </span>
                )}
              </h1>
              <div style={{ display: "flex", gap: "var(--s-2)", marginTop: "var(--s-3)", flexWrap: "wrap", alignItems: "center" }}>
                <span className={`jl-badge ${statusBadge(form.status ?? "active")}`}>{statCfg.label}</span>
                {conditionValue && (
                  <span className={`jl-badge ${conditionBadge(conditionValue)}`}>{conditionValue} condition</span>
                )}
                {item.serial && (
                  <span className="jl-badge jl-mono">S/N {item.serial}</span>
                )}
              </div>
            </div>
          </header>

          {/* ── Identity ── */}
          <Section icon={Package} title="Identity">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-5)" }}>
              <div className="jl-field">
                <label>Equipment type</label>
                <JlSelect
                  value={form.machine_type ?? ""}
                  onChange={(v) => set("machine_type", v)}
                  placeholder="Select type"
                  options={EQUIPMENT_TYPES.map((t) => ({ value: t, label: t }))}
                  disabled={!isAdmin}
                />
              </div>
              <div className="jl-field">
                <label>Store</label>
                <JlSelect
                  value={form.store ?? ""}
                  onChange={(v) => set("store", v)}
                  placeholder="Select store"
                  // Real store list only — free text would create phantom stores.
                  // Union with the current value so an existing off-list store still shows.
                  options={Array.from(new Set([...ALL_XEROX_STORES, ...(form.store ? [form.store] : [])]))
                    .sort((a, b) => a.localeCompare(b))
                    .map((s) => ({ value: s, label: s }))}
                  disabled={!isAdmin}
                />
              </div>
              <div className="jl-field">
                <label>Make / model</label>
                <ModelSuggest
                  value={form.make_model ?? ""}
                  onChange={(v) => set("make_model", v)}
                  placeholder="e.g. Polar Mohr 76EM"
                />
              </div>
              <div className="jl-field">
                <label>Serial number</label>
                <input
                  className="jl-input jl-mono"
                  value={form.serial ?? ""}
                  onChange={(e) => set("serial", e.target.value)}
                  placeholder="Serial"
                  disabled={!isAdmin}
                />
              </div>
            </div>
            <div className="jl-field">
              <label>Status</label>
              <Segment
                options={EQUIPMENT_STATUSES}
                value={form.status ?? null}
                onSelect={(s) => set("status", s)}
                labelFor={(s) => STATUS_CONFIG[s].label}
                disabled={!isAdmin}
              />
            </div>
          </Section>

          {/* ── Condition (all users) ── */}
          <Section icon={AlertTriangle} title="Condition">
            <div className="jl-field">
              <label>Condition</label>
              <Segment
                options={CONDITION_BUCKETS}
                value={conditionValue}
                onSelect={selectCondition}
              />
            </div>
            {legacyCondition && (
              <p className="jl-xs jl-faint">Legacy notes: {legacyCondition}</p>
            )}
            <div className="jl-field">
              <label>Replace</label>
              <Segment
                options={REPLACE_OPTIONS}
                value={currentReplace}
                onSelect={selectReplace}
              />
            </div>
            <div className="jl-field">
              <label>Notes</label>
              <textarea
                className="jl-textarea"
                value={notesBody}
                onChange={(e) => setNotesBody(e.target.value)}
                placeholder="Comments, faults observed, operator instructions, repair details"
                rows={4}
              />
            </div>
          </Section>

          {/* ── Procurement (admin) ── */}
          {isAdmin && (
            <Section icon={ShoppingCart} title="Procurement">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-5)" }}>
                <div className="jl-field">
                  <label>Purchase date</label>
                  <JlDate value={form.purchase_date ?? null} onChange={(v) => set("purchase_date", v)} placeholder="Select date" />
                </div>
                <div className="jl-field">
                  <label>Warranty expiry</label>
                  <JlDate value={form.warranty_expiry ?? null} onChange={(v) => set("warranty_expiry", v)} placeholder="Select date" />
                </div>
                <div className="jl-field">
                  <label>Supplier</label>
                  <ModelSuggest
                    source="suppliers"
                    value={form.supplier ?? ""}
                    onChange={(v) => set("supplier", v)}
                    placeholder="Where it was bought"
                  />
                </div>
                <div className="jl-field">
                  <label>Purchase price (ZAR)</label>
                  <input
                    className="jl-input"
                    type="number"
                    value={form.purchase_price ?? ""}
                    onChange={(e) => set("purchase_price", e.target.value || null)}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </Section>
          )}

          {/* ── Service (admin) ── */}
          {isAdmin && (
            <Section icon={Wrench} title="Service and maintenance">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--s-5)" }}>
                <div className="jl-field">
                  <label>Last serviced</label>
                  <JlDate value={form.last_serviced ?? null} onChange={(v) => set("last_serviced", v)} placeholder="Select date" />
                </div>
                <div className="jl-field">
                  <label>Next service due</label>
                  <JlDate value={form.next_service_due ?? null} onChange={(v) => set("next_service_due", v)} placeholder="Select date" />
                </div>
                <div className="jl-field">
                  <label>Service provider</label>
                  <input
                    className="jl-input"
                    value={form.service_provider ?? ""}
                    onChange={(e) => set("service_provider", e.target.value)}
                    placeholder="Company or technician"
                  />
                </div>
              </div>
              {overdue && form.next_service_due && (
                <div className="jl-alert jl-alert--amber">
                  <span className="jl-chip jl-chip--amber"><AlertTriangle /></span>
                  <div className="jl-alert__body">
                    <div className="jl-alert__title">Service overdue</div>
                    <div className="jl-alert__text">
                      Due {new Date(form.next_service_due).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}
                    </div>
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* ── Photos (admin) ── */}
          {isAdmin && (
            <Section icon={Package} title="Photos">
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => uploadPhotos(e.target.files)}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  className="jl-btn jl-btn--secondary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  data-loading={uploading ? true : undefined}
                >
                  <Upload /> Upload photos
                </button>
              </div>
              {photos.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "var(--s-3)" }}>
                  {photos.map((url) => (
                    <div key={url} style={{
                      position: "relative", aspectRatio: "1 / 1",
                      borderRadius: "var(--r-md)", overflow: "hidden",
                      background: "var(--surface-sunken)", boxShadow: "var(--sh-inset)",
                    }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="Equipment" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      <button
                        type="button"
                        onClick={() => deletePhoto(url)}
                        aria-label="Remove photo"
                        style={{
                          position: "absolute", top: 6, right: 6,
                          width: 26, height: 26, borderRadius: "50%",
                          background: "var(--ink-900)", color: "#fff",
                          boxShadow: "var(--sh-sm)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* ── Feedback & replacement requests (store + admin) ── */}
          <FeedbackPanel type="equipment" refId={String(id)} />

          {/* ── Change history (admin) ── */}
          {isAdmin && log.length > 0 && (
            <section style={{ display: "grid", gap: "var(--s-4)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)" }}>
                <span className="jl-chip jl-chip--sm"><Clock /></span>
                <h2 className="jl-h3">Change history</h2>
              </div>
              <div className="jl-table-wrap" style={{ overflowX: "auto" }}>
                <table className="jl-table">
                  <thead>
                    <tr>
                      {["Field", "Previous value", "New value", "Changed by", "When"].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {log.map((entry, i) => (
                      <tr key={i}>
                        <td className="cell-strong">{entry.field.replace(/_/g, " ")}</td>
                        <td className="jl-faint" style={{ fontStyle: "italic", maxWidth: 180 }}>{entry.old_value ?? ""}</td>
                        <td style={{ maxWidth: 180, color: "var(--ink-900)" }}>{entry.new_value ?? ""}</td>
                        <td className="jl-muted">{entry.changed_by}</td>
                        <td className="jl-faint" style={{ whiteSpace: "nowrap" }}>
                          {new Date(entry.changed_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}{" "}
                          <span style={{ color: "var(--ink-300)" }}>
                            {new Date(entry.changed_at).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <div style={{ height: "var(--s-8)" }} />
        </div>
      </div>

      {/* ── Delete confirm modal ── */}
      <div className="jl-overlay" data-open={showDelete ? true : undefined} onClick={() => setShowDelete(false)}>
        <div className="jl-modal" onClick={(e) => e.stopPropagation()}>
          <div style={{ display: "flex", gap: "var(--s-3)", alignItems: "flex-start" }}>
            <span className="jl-chip jl-chip--solid"><AlertTriangle /></span>
            <div>
              <h3 className="jl-modal__title">Delete equipment item</h3>
              <p className="jl-modal__text">
                Permanently delete <strong style={{ color: "var(--ink-900)" }}>{itemLabel}</strong>?
                This removes all associated change history. This cannot be undone.
              </p>
            </div>
          </div>
          <div className="jl-modal__foot">
            <button type="button" className="jl-btn jl-btn--ghost" onClick={() => setShowDelete(false)}>Cancel</button>
            <button type="button" className="jl-btn jl-btn--primary" onClick={deleteItem}>
              <Trash2 /> Delete permanently
            </button>
          </div>
        </div>
      </div>
      </EquipmentErrorBoundary>
    </AppShell>
  );
}
