"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { toast } from "sonner";
import {
  Package, Printer, Plus, Search, Save, ChevronRight, Check,
} from "lucide-react";
import {
  EQUIPMENT_STATUSES, STATUS_CONFIG, classifyCondition,
  CONDITION_CONFIG, type EquipmentStatus, type ConditionBucket,
} from "@/lib/equipment-utils";
import { JlSelect } from "@/components/ui/jl-select";
import { getStoreGroup, STORE_GROUPS } from "@/lib/store-groups";
import { useRole } from "@/lib/use-role";
import { BulkActionBar } from "@/components/equipment/bulk-action-bar";
import { PrintSection } from "@/components/equipment/print-section";
import { CompletenessBadge, completenessColors } from "@/components/equipment/completeness-badge";
import { PhotoButton } from "@/components/equipment/photo-button";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Machine {
  serial_number: string;
  model_name: string | null;
  printer_type: string | null;
  last_seen: string | null;
  condition_notes: string | null;
  replace_flag: string | null;
  age: string | null;
  install_date: string | null;
  latest_balance: number | string | null;
  latest_balance_date: string | null;
}

interface EquipmentItem {
  id: number;
  store: string;
  machine_type: string;
  make_model: string | null;
  serial: string | null;
  condition: string | null;
  located_at: string | null;
  status: EquipmentStatus;
  updated_at: string;
  photos: string[] | null;
}

interface Identity {
  name: string;
  mainGroup: string;
  storeGroup: string;
  holdingGroup: string;
  address: string;
  phone: string;
  managerName: string;
  managerEmail: string;
}

interface StoreResponse {
  identity?: Partial<Identity>;
  equipment?: EquipmentItem[];
  machines?: Machine[];
  store?: string;
}

interface Completeness {
  store: string;
  equipmentScore: number;
  printerScore: number;
  overallScore: number;
  itemBreakdown: { id: number; type: string; score: number; missing: string[] }[];
  printerBreakdown: { serial: string; score: number; missing: string[] }[];
}

// Condition → jl-badge modifier.
const CONDITION_BADGE: Record<ConditionBucket, string> = {
  good: "jl-badge--green",
  fair: "jl-badge--amber",
  poor: "jl-badge--red",
  unknown: "",
};

// Status → jl-badge modifier.
const STATUS_BADGE: Record<EquipmentStatus, string> = {
  active: "jl-badge--green",
  inactive: "",
  disposed: "jl-badge--red",
  transferred: "jl-badge--blue",
};

// All store names (from the group hierarchy) for the bulk reassign dropdown.
const ALL_STORE_NAMES = [...STORE_GROUPS.map((e) => e.store)].sort();

// ─── Kit checkbox ──────────────────────────────────────────────────────────────

function JlCheck({
  checked, indeterminate, onChange, label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="jl-check" onClick={(e) => e.stopPropagation()}>
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        ref={(el) => { if (el) el.indeterminate = !!indeterminate && !checked; }}
        onChange={onChange}
        onClick={(e) => e.stopPropagation()}
      />
      <span className="box">
        <Check />
      </span>
    </label>
  );
}

// ─── Health bar ────────────────────────────────────────────────────────────────

function HealthBar({ items }: { items: EquipmentItem[] }) {
  const counts: Record<ConditionBucket, number> = { good: 0, fair: 0, poor: 0, unknown: 0 };
  for (const it of items) counts[classifyCondition(it.condition)]++;
  const total = items.length || 1;
  const segs: { bucket: ConditionBucket; color: string }[] = [
    { bucket: "good", color: "var(--green-500)" },
    { bucket: "fair", color: "var(--amber-500)" },
    { bucket: "poor", color: "var(--red-500)" },
    { bucket: "unknown", color: "var(--ink-200)" },
  ];
  return (
    <div className="jl-health-bar" style={{ display: "flex", height: 8, borderRadius: "var(--r-pill)", overflow: "hidden", width: 160, background: "var(--ink-100)" }}>
      {segs.map((s) =>
        counts[s.bucket] > 0 ? (
          <div key={s.bucket} title={`${CONDITION_CONFIG[s.bucket].label}: ${counts[s.bucket]}`} style={{ width: `${(counts[s.bucket] / total) * 100}%`, background: s.color }} />
        ) : null
      )}
    </div>
  );
}

// ─── Relative time ──────────────────────────────────────────────────────────────

function relTime(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "Never";
  const diff = Date.now() - d;
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months !== 1 ? "s" : ""} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years !== 1 ? "s" : ""} ago`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StoreDetailPage() {
  const params = useParams();
  const router = useRouter();
  const storeName = decodeURIComponent(params.store as string);
  const { isAdmin } = useRole();

  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [baseline, setBaseline] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completeness, setCompleteness] = useState<Completeness | null>(null);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Multi-select (admin only). Tracked by item id so selection survives filter changes.
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const fetchedIdentityRef = useRef(false);

  const addHref = `/equipment/stores/${encodeURIComponent(storeName)}/add`;

  // Build a fallback identity from the static group hierarchy.
  const fallbackIdentity = useCallback((): Identity => {
    const g = getStoreGroup(storeName);
    return {
      name: storeName,
      mainGroup: g?.mainGroup ?? "",
      storeGroup: g?.storeGroup ?? "",
      holdingGroup: g?.holdingGroup ?? "",
      address: "",
      phone: "",
      managerName: "",
      managerEmail: "",
    };
  }, [storeName]);

  const load = useCallback(async () => {
    setLoading(true);
    // Prefer the new /api/stores/[store]; fall back to /api/equipment/stores/[store].
    let data: StoreResponse | null = null;
    try {
      const res = await fetch(`/api/stores/${encodeURIComponent(storeName)}`);
      if (res.ok) data = await res.json();
    } catch {
      data = null;
    }
    if (!data) {
      try {
        const res = await fetch(`/api/equipment/stores/${encodeURIComponent(storeName)}`);
        if (res.ok) data = await res.json();
      } catch {
        data = null;
      }
    }

    setItems(data?.equipment ?? []);
    setMachines(data?.machines ?? []);

    // Only seed identity from server the first time so we don't clobber unsaved edits.
    if (!fetchedIdentityRef.current) {
      const fb = fallbackIdentity();
      const merged: Identity = {
        ...fb,
        ...(data?.identity
          ? {
              name: data.identity.name ?? fb.name,
              mainGroup: data.identity.mainGroup ?? fb.mainGroup,
              storeGroup: data.identity.storeGroup ?? fb.storeGroup,
              holdingGroup: data.identity.holdingGroup ?? fb.holdingGroup,
              address: data.identity.address ?? "",
              phone: data.identity.phone ?? "",
              managerName: data.identity.managerName ?? "",
              managerEmail: data.identity.managerEmail ?? "",
            }
          : {}),
      };
      setIdentity(merged);
      setBaseline(merged);
      fetchedIdentityRef.current = true;
    }
    setLoading(false);
  }, [storeName, fallbackIdentity]);

  useEffect(() => { load(); }, [load]);

  // P19: completeness summary for this store (graceful 404 fallback during dev).
  useEffect(() => {
    let alive = true;
    fetch(`/api/stores/${encodeURIComponent(storeName)}/completeness`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Completeness) => { if (alive) setCompleteness(d); })
      .catch(() => { if (alive) setCompleteness(null); });
    return () => { alive = false; };
  }, [storeName]);

  const setField = (k: keyof Identity, v: string) =>
    setIdentity((prev) => (prev ? { ...prev, [k]: v } : prev));

  const dirty = useMemo(() => {
    if (!identity || !baseline) return false;
    return (
      identity.address !== baseline.address ||
      identity.phone !== baseline.phone ||
      identity.managerName !== baseline.managerName ||
      identity.managerEmail !== baseline.managerEmail
    );
  }, [identity, baseline]);

  const saveIdentity = async () => {
    if (!identity) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/stores/${encodeURIComponent(storeName)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: identity.address,
          phone: identity.phone,
          managerName: identity.managerName,
          managerEmail: identity.managerEmail,
        }),
      });
      if (!res.ok) throw new Error();
      const updated = (await res.json().catch(() => null)) as { identity?: Partial<Identity> } | null;
      const next: Identity = updated?.identity
        ? { ...identity, ...updated.identity }
        : identity;
      setIdentity(next);
      setBaseline(next);
      toast.success("Store details saved");
    } catch {
      toast.error("Failed to save store details");
    } finally {
      setSaving(false);
    }
  };

  const types = useMemo(() => [...new Set(items.map((i) => i.machine_type))].sort(), [items]);

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        if (filterType && item.machine_type !== filterType) return false;
        if (filterStatus && item.status !== filterStatus) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            item.machine_type.toLowerCase().includes(q) ||
            (item.make_model ?? "").toLowerCase().includes(q) ||
            (item.serial ?? "").toLowerCase().includes(q)
          );
        }
        return true;
      }),
    [items, filterType, filterStatus, search],
  );

  // ─── Multi-select helpers ──────────────────────────────────────────────────
  const filteredIds = useMemo(() => filtered.map((i) => i.id), [filtered]);

  const selectedIds = useMemo(() => [...selected], [selected]);

  // Header checkbox reflects/controls the CURRENTLY VISIBLE (filtered) rows.
  const allVisibleSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const someVisibleSelected = filteredIds.some((id) => selected.has(id));

  const toggleOne = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllVisible = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = filteredIds.length > 0 && filteredIds.every((id) => next.has(id));
      if (allOn) {
        for (const id of filteredIds) next.delete(id);
      } else {
        for (const id of filteredIds) next.add(id);
      }
      return next;
    });
  }, [filteredIds]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const activePrinters = machines.filter((m) => {
    if (!m.last_seen) return false;
    const days = (Date.now() - new Date(m.last_seen).getTime()) / 86400000;
    return days <= 45;
  }).length;

  const lastUpdated = useMemo(() => {
    const times = items.map((i) => i.updated_at).filter(Boolean).map((t) => new Date(t).getTime());
    if (times.length === 0) return null;
    return new Date(Math.max(...times)).toISOString();
  }, [items]);

  const groupChips = identity
    ? [identity.storeGroup, identity.mainGroup, identity.holdingGroup].filter(Boolean)
    : [];

  // Base 6 columns + optional leading checkbox column for admins.
  const EQ_COLS = isAdmin ? 7 : 6;

  return (
    <AppShell>
      {/* Sticky top bar */}
      <div
        className="jl-page-pad"
        style={{
          position: "sticky", top: 0, zIndex: 30,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          // height matches the top header (64px) so the two bars read as one band.
          gap: 12, height: 64, padding: "0 40px", background: "var(--surface)", boxShadow: "var(--sh-sm)",
        }}
      >
        <nav className="jl-breadcrumb">
          <Link href="/equipment">Stores</Link>
          <span className="sep">/</span>
          <span className="current">{storeName}</span>
        </nav>
        {dirty && (
          <button
            onClick={saveIdentity}
            disabled={saving}
            className="jl-btn jl-btn--primary jl-btn--sm jl-touch-btn"
            data-loading={saving ? "" : undefined}
          >
            <Save /> Save
          </button>
        )}
      </div>

      <div className="jl-page-pad" style={{ padding: "28px 40px 60px" }}>
        {/* Identity card */}
        <div className="jl-card" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <h1 className="jl-h1">{storeName}</h1>
            {completeness && (
              <Link href={`/stores/${encodeURIComponent(storeName)}/completeness`} title="View data completeness breakdown">
                <CompletenessBadge score={completeness.overallScore} size="md" />
              </Link>
            )}
          </div>
          {groupChips.length > 0 && (
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {groupChips.map((g) => (
                <span key={g} className="jl-badge">{g}</span>
              ))}
            </div>
          )}

          {identity && (
            <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              <div className="jl-field">
                <label>Address</label>
                <input className="jl-input" value={identity.address} onChange={(e) => setField("address", e.target.value)} placeholder="Store address…" />
              </div>
              <div className="jl-field">
                <label>Phone</label>
                <input className="jl-input" value={identity.phone} onChange={(e) => setField("phone", e.target.value)} placeholder="Contact number…" />
              </div>
              <div className="jl-field">
                <label>Manager Name</label>
                <input className="jl-input" value={identity.managerName} onChange={(e) => setField("managerName", e.target.value)} placeholder="Manager…" />
              </div>
              <div className="jl-field">
                <label>Manager Email</label>
                <input className="jl-input" type="email" value={identity.managerEmail} onChange={(e) => setField("managerEmail", e.target.value)} placeholder="name@jetline.co.za" />
              </div>
            </div>
          )}
        </div>

        {/* Summary KPI strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
          <div className="jl-kpi">
            <div className="jl-kpi__top">
              <span className="jl-kpi__label">Equipment</span>
              <span className="jl-chip jl-chip--sm jl-chip--neutral"><Package /></span>
            </div>
            <div className="jl-kpi__value">{items.length}</div>
          </div>
          <div className="jl-kpi">
            <div className="jl-kpi__top">
              <span className="jl-kpi__label">Active Printers</span>
              <span className="jl-chip jl-chip--sm jl-chip--neutral"><Printer /></span>
            </div>
            <div className="jl-kpi__value">{activePrinters}</div>
          </div>
          <div className="jl-kpi">
            <div className="jl-kpi__top">
              <span className="jl-kpi__label">Condition</span>
            </div>
            <HealthBar items={items} />
          </div>
          <div className="jl-kpi">
            <div className="jl-kpi__top">
              <span className="jl-kpi__label">Last Updated</span>
            </div>
            <div className="jl-kpi__value" style={{ fontSize: 20 }}>{relTime(lastUpdated)}</div>
          </div>
        </div>

        {/* Equipment section */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <h2 className="jl-h2">Equipment</h2>
            <div className="jl-search" style={{ flex: "1 1 180px", maxWidth: 260, marginLeft: 8 }}>
              <Search />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search equipment…" />
            </div>
            <JlSelect
              value={filterType}
              onChange={setFilterType}
              placeholder="All Types"
              style={{ width: 170 }}
              options={[{ value: "", label: "All Types" }, ...types.map((t) => ({ value: t, label: t }))]}
            />
            <div className="jl-segment" role="tablist" aria-label="Filter by status">
              <button type="button" role="tab" aria-selected={filterStatus === ""} onClick={() => setFilterStatus("")} className="jl-touch-toggle">
                All
              </button>
              {EQUIPMENT_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={filterStatus === s}
                  onClick={() => setFilterStatus(filterStatus === s ? "" : s)}
                  className="jl-touch-toggle"
                >
                  {STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
            <Link href={addHref} className="jl-btn jl-btn--primary jl-touch-btn" style={{ marginLeft: "auto" }}>
              <Plus /> Add Equipment
            </Link>
          </div>

          {/* Bulk action bar — admins only, when at least one item is selected */}
          {isAdmin && selectedIds.length > 0 && (
            <BulkActionBar
              selectedIds={selectedIds}
              stores={ALL_STORE_NAMES}
              onApplied={() => { clearSelection(); load(); }}
              onClear={clearSelection}
            />
          )}

          <div className="jl-table-wrap">
            {/* Desktop: table. Mobile: card stack (below). */}
            <div className="jl-table-desktop" style={{ overflowX: "auto" }}>
              <table className="jl-table">
                <thead>
                  <tr>
                    {isAdmin && (
                      <th style={{ width: 44 }}>
                        <JlCheck
                          checked={allVisibleSelected}
                          indeterminate={someVisibleSelected}
                          onChange={toggleAllVisible}
                          label="Select all visible equipment"
                        />
                      </th>
                    )}
                    <th>Type</th>
                    <th>Make / Model</th>
                    <th>Serial</th>
                    <th>Condition</th>
                    <th>Status</th>
                    <th style={{ width: 64, textAlign: "center" }}>Photos</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={EQ_COLS} style={{ padding: 40, textAlign: "center", color: "var(--ink-400)" }}>Loading…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={EQ_COLS} style={{ padding: 40, textAlign: "center", color: "var(--ink-400)" }}>
                      {items.length === 0 ? "No equipment recorded yet" : "No results match your filters"}
                    </td></tr>
                  ) : (
                    filtered.map((item) => {
                      const bucket = classifyCondition(item.condition);
                      const status = item.status ?? "active";
                      const isSelected = selected.has(item.id);
                      return (
                        <tr key={item.id}
                          onClick={() => router.push(`/equipment/items/${item.id}`)}
                          style={{ cursor: "pointer", background: isSelected ? "var(--red-tint)" : undefined }}
                        >
                          {isAdmin && (
                            <td style={{ width: 44 }} onClick={(e) => { e.stopPropagation(); toggleOne(item.id); }}>
                              <JlCheck
                                checked={isSelected}
                                onChange={() => toggleOne(item.id)}
                                label={`Select ${item.machine_type}`}
                              />
                            </td>
                          )}
                          <td className="cell-strong">{item.machine_type}</td>
                          <td>{item.make_model ?? <span className="jl-muted" style={{ fontStyle: "italic" }}>Not set</span>}</td>
                          <td><span className="jl-mono" style={{ color: "var(--ink-600)" }}>{item.serial ?? "Not set"}</span></td>
                          <td><span className={`jl-badge ${CONDITION_BADGE[bucket]}`}>{CONDITION_CONFIG[bucket].label}</span></td>
                          <td><span className={`jl-badge ${STATUS_BADGE[status]}`}>{STATUS_CONFIG[status].label}</span></td>
                          <td style={{ textAlign: "center" }}>
                            <PhotoButton itemId={item.id} initialPhotos={item.photos} canEdit={isAdmin} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile: tappable card stack (no column headers). */}
            <div className="jl-cards-mobile" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              {loading ? (
                <div style={{ padding: 32, textAlign: "center", color: "var(--ink-400)" }}>Loading…</div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center", color: "var(--ink-400)" }}>
                  {items.length === 0 ? "No equipment recorded yet" : "No results match your filters"}
                </div>
              ) : (
                filtered.map((item) => {
                  const bucket = classifyCondition(item.condition);
                  const status = item.status ?? "active";
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => router.push(`/equipment/items/${item.id}`)}
                      className="jl-card jl-card--pad-sm jl-card--interactive"
                      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 44 }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="jl-h3">{item.machine_type}</p>
                        <p className="jl-sm" style={{ color: item.make_model ? "var(--ink-600)" : "var(--ink-400)", fontStyle: item.make_model ? "normal" : "italic", marginTop: 2 }}>
                          {item.make_model ?? "No model set"}
                        </p>
                        {item.serial && (
                          <p className="jl-xs jl-mono" style={{ color: "var(--ink-500)", marginTop: 2 }}>{item.serial}</p>
                        )}
                        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                          <span className={`jl-badge ${CONDITION_BADGE[bucket]}`}>{CONDITION_CONFIG[bucket].label}</span>
                          <span className={`jl-badge ${STATUS_BADGE[status]}`}>{STATUS_CONFIG[status].label}</span>
                        </div>
                      </div>
                      <ChevronRight size={18} style={{ color: "var(--ink-300)", flexShrink: 0 }} />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Printers section */}
        <div>
          <h2 className="jl-h2" style={{ marginBottom: 14 }}>Printers</h2>
          <div className="jl-table-wrap">
            <div style={{ overflowX: "auto" }}>
              <table className="jl-table">
                <thead>
                  <tr>
                    <th>Serial</th>
                    <th>Model</th>
                    <th>Type</th>
                    <th>Install Date</th>
                    <th className="num">Balance</th>
                    <th>Last Seen</th>
                    <th>Replace?</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "var(--ink-400)" }}>Loading…</td></tr>
                  ) : machines.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "var(--ink-400)" }}>No Xerox printers mapped to this store</td></tr>
                  ) : (
                    machines.map((m) => {
                      const flag = m.replace_flag;
                      const flagBadge =
                        flag === "YES" ? "jl-badge--red"
                        : flag === "MAYBE" ? "jl-badge--amber"
                        : flag === "NO" ? "jl-badge--green"
                        : "";
                      const balance = m.latest_balance != null ? Number(m.latest_balance) : null;
                      return (
                        <tr key={m.serial_number}
                          onClick={() => router.push(`/equipment/printers/${encodeURIComponent(m.serial_number)}`)}
                          style={{ cursor: "pointer" }}
                        >
                          <td><span className="jl-mono" style={{ color: "var(--ink-600)" }}>{m.serial_number}</span></td>
                          <td className="cell-strong">{m.model_name ?? <span className="jl-muted" style={{ fontStyle: "italic", fontWeight: 400 }}>Not set</span>}</td>
                          <td style={{ color: "var(--ink-500)" }}>{m.printer_type ?? "Not set"}</td>
                          <td style={{ color: "var(--ink-500)" }}>
                            {m.install_date
                              ? new Date(m.install_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "2-digit" })
                              : <span className="jl-muted">Not set</span>}
                          </td>
                          <td className="num" style={{ color: "var(--ink-700)", fontVariantNumeric: "tabular-nums" }}
                            title={m.latest_balance_date ? `as at ${new Date(m.latest_balance_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}` : undefined}
                          >
                            {balance != null ? balance.toLocaleString("en-ZA") : <span className="jl-muted">—</span>}
                          </td>
                          <td style={{ color: "var(--ink-500)" }}>
                            {m.last_seen ? new Date(m.last_seen).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "2-digit" }) : "Never"}
                          </td>
                          <td>
                            {flag
                              ? <span className={`jl-badge ${flagBadge}`}>{flag}</span>
                              : <span className="jl-muted">Not set</span>}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Print Volumes section (P18) — PrintSection renders its own titled
            surface (its inner card is the .jl-card equivalent); do not nest. */}
        <div style={{ marginTop: 32 }}>
          <PrintSection store={storeName} />
        </div>
      </div>
    </AppShell>
  );
}
