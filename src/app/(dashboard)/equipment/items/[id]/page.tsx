"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, Save, Trash2, Upload, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { EquipmentErrorBoundary } from "@/components/equipment/error-boundary";
import { FeedbackPanel } from "@/components/equipment/feedback-panel";
import { ModelSuggest } from "@/components/equipment/model-suggest";
import { Confirm } from "@/components/machines/confirm";
import { DayField } from "@/components/machines/day-field";
import { Field } from "@/components/machines/field";
import { FilePicker } from "@/components/machines/file-picker";
import { Loading } from "@/components/machines/loading";
import { Page } from "@/components/machines/page";
import { Panel } from "@/components/machines/panel";
import { Pick } from "@/components/machines/pick";
import { ConditionBadge, EQUIPMENT_STATUS_LABEL, EquipmentStatusBadge } from "@/components/machines/status-badge";
import { ALL_XEROX_STORES, EQUIPMENT_STATUSES, EQUIPMENT_TYPES, type EquipmentStatus } from "@/lib/equipment-utils";
import { addRecentItem } from "@/lib/recently-viewed";
import { toast } from "@/lib/toast";
import { SURFACE, TYPE } from "@/lib/ui/ui-tokens";
import { cn } from "@/lib/ui/utils";
import { useHotkeys } from "@/lib/use-hotkey";
import { useRole } from "@/lib/use-role";

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

/** Age in years+months from the install date, computed live. */
function ageFromInstall(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) months -= 1;
  if (months < 0) months = 0;
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} month${m !== 1 ? "s" : ""}`;
  return m > 0 ? `${y}y ${m}m` : `${y} year${y !== 1 ? "s" : ""}`;
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
  const uploadPhotos = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
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
    }
  };

  const deletePhoto = async (index: number) => {
    try {
      const res = await fetch(`/api/equipment/items/${id}/photos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItem((it) => (it ? { ...it, photos: data.photos } : it));
      setForm((f) => ({ ...f, photos: data.photos }));
    } catch {
      toast.error("Failed to remove photo");
    }
  };

  if (loading) return <Loading />;
  if (!item) return null;

  const conditionValue: ConditionBucket | null = isBucket(form.condition) ? form.condition : null;
  const legacyCondition = form.condition && !isBucket(form.condition) ? form.condition : null;
  const photos = form.photos ?? [];
  const itemLabel = [item.machine_type, item.make_model].filter(Boolean).join(" · ");
  const overdue = form.next_service_due != null && new Date(form.next_service_due) < new Date();
  const storeHref = `/equipment/stores/${encodeURIComponent(item.store)}`;

  return (
    <EquipmentErrorBoundary>
      <Page
        title={item.machine_type}
        titleExtra={
          saving ? (
            <Badge variant="secondary"><Spinner /> Saving</Badge>
          ) : savedFlash ? (
            <Badge status="success"><Check /> Saved</Badge>
          ) : dirty ? (
            <Badge status="warning">Unsaved changes</Badge>
          ) : null
        }
        crumbs={[{ label: item.store, href: storeHref }, { label: itemLabel }]}
        actions={
          <>
            {isAdmin && (
              <Button variant="outline" onClick={() => setShowDelete(true)}>
                <Trash2 /> Delete
              </Button>
            )}
            <Button onClick={save} disabled={saving || !dirty}>
              {saving ? <Spinner /> : <Save />} Save
            </Button>
          </>
        }
      >
        <div className="flex w-full max-w-5xl flex-col gap-5">
          {/* Record header: what it is on the left, the first photo on the right, so you see which machine this is. */}
          <header className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              {item.make_model && <span className={TYPE.section}>{item.make_model}</span>}
              <div className="flex flex-wrap items-center gap-2">
                <EquipmentStatusBadge status={form.status ?? "active"} />
                {conditionValue && <ConditionBadge condition={conditionValue} />}
                {item.serial && <Badge variant="secondary">S/N {item.serial}</Badge>}
              </div>
            </div>
            {photos.length > 0 && (
              <a href={photos[0]} target="_blank" rel="noreferrer" title="View photo" className={cn(SURFACE.cardRaised, "relative block h-40 w-56 shrink-0 overflow-hidden")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photos[0]} alt={itemLabel} className="block size-full object-cover" />
                {photos.length > 1 && <Badge variant="secondary" className="absolute right-1.5 bottom-1.5">+{photos.length - 1}</Badge>}
              </a>
            )}
          </header>

          <Panel caption="Identity" bodyClassName="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Equipment type" htmlFor="item-type">
                <Pick
                  id="item-type"
                  value={form.machine_type ?? ""}
                  onChange={(v) => set("machine_type", v)}
                  placeholder="Select type"
                  options={Array.from(new Set([...EQUIPMENT_TYPES, ...(form.machine_type ? [form.machine_type] : [])])).map((t) => ({ value: t, label: t }))}
                  disabled={!isAdmin}
                />
              </Field>
              <Field label="Store" htmlFor="item-store">
                <Pick
                  id="item-store"
                  value={form.store ?? ""}
                  onChange={(v) => set("store", v)}
                  placeholder="Select store"
                  // Real store list only: free text would create phantom stores.
                  // Union with the current value so an existing off-list store still shows.
                  options={Array.from(new Set([...ALL_XEROX_STORES, ...(form.store ? [form.store] : [])]))
                    .sort((a, b) => a.localeCompare(b))
                    .map((s) => ({ value: s, label: s }))}
                  disabled={!isAdmin}
                />
              </Field>
              <Field label="Make / model">
                <ModelSuggest value={form.make_model ?? ""} onChange={(v) => set("make_model", v)} placeholder="e.g. Polar Mohr 76EM" />
              </Field>
              <Field label="Serial number" htmlFor="item-serial">
                <Input id="item-serial" value={form.serial ?? ""} onChange={(e) => set("serial", e.target.value)} placeholder="Serial" disabled={!isAdmin} />
              </Field>
            </div>
            <Field label="Status">
              <Segmented
                value={form.status ?? ""}
                onValueChange={(s) => set("status", s)}
                options={EQUIPMENT_STATUSES.map((s) => ({ value: s, label: EQUIPMENT_STATUS_LABEL[s] }))}
                disabled={!isAdmin}
              />
            </Field>
          </Panel>

          {/* Condition: every user. */}
          <Panel caption="Condition" bodyClassName="flex flex-col gap-4">
            <Field label="Condition" hint={legacyCondition ? `Legacy notes: ${legacyCondition}` : undefined}>
              <Segmented value={conditionValue ?? ""} onValueChange={(c) => selectCondition(c as ConditionBucket)} options={CONDITION_BUCKETS.map((c) => ({ value: c, label: c }))} />
            </Field>
            <Field label="Replace">
              <Segmented value={currentReplace ?? ""} onValueChange={(r) => selectReplace(r as ReplaceValue)} options={REPLACE_OPTIONS.map((r) => ({ value: r, label: r }))} />
            </Field>
            <Field label="Notes" htmlFor="item-notes">
              <Textarea id="item-notes" value={notesBody} onChange={(e) => setNotesBody(e.target.value)} placeholder="Comments, faults observed, operator instructions, repair details" rows={4} />
            </Field>
          </Panel>

          {/* Lifecycle (admin): assets are tracked from when they go into service, not when they were bought. */}
          {isAdmin && (
            <Panel caption="Lifecycle">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Installed" htmlFor="item-installed" hint="When it first entered service.">
                  <DayField id="item-installed" value={form.purchase_date ?? null} onChange={(v) => set("purchase_date", v)} placeholder="First install date" />
                </Field>
                <Field label="Age" hint="Calculated from the install date.">
                  <p className="py-1.5 font-medium">{ageFromInstall(form.purchase_date)}</p>
                </Field>
                <Field label="Warranty expiry" htmlFor="item-warranty">
                  <DayField id="item-warranty" value={form.warranty_expiry ?? null} onChange={(v) => set("warranty_expiry", v)} placeholder="Select date" />
                </Field>
                <Field label="Supplier">
                  <ModelSuggest source="suppliers" value={form.supplier ?? ""} onChange={(v) => set("supplier", v)} placeholder="Where it came from" />
                </Field>
              </div>
            </Panel>
          )}

          {isAdmin && (
            <Panel caption="Service and maintenance" bodyClassName="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Last serviced" htmlFor="item-serviced">
                  <DayField id="item-serviced" value={form.last_serviced ?? null} onChange={(v) => set("last_serviced", v)} placeholder="Select date" />
                </Field>
                <Field label="Next service due" htmlFor="item-due">
                  <DayField id="item-due" value={form.next_service_due ?? null} onChange={(v) => set("next_service_due", v)} placeholder="Select date" />
                </Field>
                <Field label="Service provider" htmlFor="item-provider">
                  <Input id="item-provider" value={form.service_provider ?? ""} onChange={(e) => set("service_provider", e.target.value)} placeholder="Company or technician" />
                </Field>
              </div>
              {overdue && form.next_service_due && (
                <Alert variant="warning">
                  <AlertTitle>Service overdue</AlertTitle>
                  <AlertDescription>
                    Due {new Date(form.next_service_due).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}
                  </AlertDescription>
                </Alert>
              )}
            </Panel>
          )}

          {isAdmin && (
            <Panel
              caption="Photos"
              right={
                <FilePicker accept="image/*" multiple disabled={uploading} onFiles={uploadPhotos}>
                  {uploading ? <Spinner /> : <Upload />} Upload photos
                </FilePicker>
              }
            >
              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
                  {photos.map((url, i) => (
                    <div key={url} className="relative aspect-square overflow-hidden rounded-xl bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="Equipment" className="block size-full object-cover" />
                      <Button variant="secondary" size="icon-xs" className="absolute top-1.5 right-1.5" onClick={() => deletePhoto(i)} aria-label="Remove photo">
                        <X />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          )}

          {/* Activity: comments, field changes and requests in one timeline. */}
          <FeedbackPanel type="equipment" refId={String(id)} />
        </div>

        <Confirm
          open={showDelete}
          onOpenChange={setShowDelete}
          title="Delete equipment item"
          detail={`Permanently delete ${itemLabel}? This removes all associated change history. This cannot be undone.`}
          action="Delete permanently"
          destructive
          onConfirm={deleteItem}
        />
      </Page>
    </EquipmentErrorBoundary>
  );
}
