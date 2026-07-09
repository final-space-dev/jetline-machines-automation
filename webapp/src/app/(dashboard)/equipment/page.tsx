"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { useRole } from "@/lib/use-role";
import { EQUIPMENT_TYPES, EQUIPMENT_STATUSES, STATUS_CONFIG, type EquipmentStatus } from "@/lib/equipment-utils";
import { JlSelect } from "@/components/ui/jl-select";
import { getStoreGroup, getMainGroups, getStoreGroupsByMain } from "@/lib/store-groups";
import { toast } from "sonner";
import {
  Plus, Search, ChevronRight, ChevronDown, Package, Printer,
  X, Download,
} from "lucide-react";
import { CompletenessBadge } from "@/components/equipment/completeness-badge";
import { formatK } from "@/components/equipment/print-section";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StoreCard {
  name: string;
  mainGroup?: string;
  storeGroup?: string;
  holdingGroup?: string;
  equipment_count: number;
  machine_count: number;
  has_data: boolean;
  condition: { good: number; fair: number; poor: number };
  monthlyVolume?: number;
  printerHealth?: { active: number; replaceFlagged: number };
}

/** Store with group fields guaranteed resolved (API value or client-side fallback). */
interface ResolvedStore extends StoreCard {
  mainGroup: string;
  storeGroup: string;
}

interface EquipmentItem {
  id?: number;
  store: string;
  machine_type: string;
  make_model: string;
  serial: string;
  condition: string;
  located_at: string;
  status: EquipmentStatus;
}

type GroupView = "store" | "storeGroup" | "mainGroup";

const VIEW_STORAGE_KEY = "jl.equipment.groupView";

const UNGROUPED_MAIN = "Other Stores";
const UNGROUPED_SUB = "Ungrouped";

// ─── Stores list (from ALL_XEROX_STORES) ──────────────────────────────────────

const STORE_NAMES = ["Alberton","Bedfordview","Benoni","Blackheath","Boksburg","Brooklyn","Bryanston","Centurion","Century City","Constantia","Die Bult","Durban","Fixtrade","Fourways","Fox Street","Foxstreet","Gardens","George","Greenpoint","Hillcrest","Hydepark","Illovo","Klerksdorp","Kyalami","Loftus","Melrose","Menlyn","Midrand","Mmabatho","Modderfontein","Montana","Nelspruit","Parktown","Pietermaritzburg","Polokwane","Potchefstroom","Randburg","Rivonia","Rosebank","Rustenburg","Sandown","Stellenbosch","Sunninghill","Tygervalley","Umhlanga","Waterfront","Wits","Woodmead"];

// Responsive store grid — cards lift on canvas via shadow (no white-on-white).
const GRID: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 };

// ─── Add Equipment Modal ──────────────────────────────────────────────────────

function AddEquipmentModal({
  defaultStore,
  onClose,
  onSaved,
}: {
  defaultStore?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<EquipmentItem>({
    store: defaultStore ?? "",
    machine_type: "",
    make_model: "",
    serial: "",
    condition: "",
    located_at: "",
    status: "active",
  });
  const [saving, setSaving] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  const set = (k: keyof EquipmentItem, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.store || !form.machine_type) {
      toast.error("Store and equipment type are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Equipment added");
      onSaved();
      onClose();
    } catch {
      toast.error("Failed to add equipment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="jl-overlay"
      data-open
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="jl-modal" style={{ maxWidth: 520 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
          <h2 className="jl-modal__title">Add Equipment</h2>
          <button onClick={onClose} className="jl-btn jl-btn--ghost jl-btn--icon jl-btn--sm" aria-label="Close"><X size={16} /></button>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="jl-field">
              <label>Store *</label>
              <JlSelect
                value={form.store}
                onChange={(v) => set("store", v)}
                placeholder="Select store"
                options={STORE_NAMES.map((s) => ({ value: s, label: s }))}
              />
            </div>
            <div className="jl-field">
              <label>Type *</label>
              <JlSelect
                value={form.machine_type}
                onChange={(v) => set("machine_type", v)}
                placeholder="Select type"
                options={EQUIPMENT_TYPES.map((t) => ({ value: t, label: t }))}
              />
            </div>
          </div>

          <div className="jl-field">
            <label>Make / Model</label>
            <input className="jl-input" value={form.make_model} onChange={(e) => set("make_model", e.target.value)} placeholder="e.g. Polar Mohr 76EM" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="jl-field">
              <label>Serial Number</label>
              <input className="jl-input" value={form.serial} onChange={(e) => set("serial", e.target.value)} placeholder="Serial" />
            </div>
            <div className="jl-field">
              <label>Located At</label>
              <input className="jl-input" value={form.located_at} onChange={(e) => set("located_at", e.target.value)} placeholder="If different from store" />
            </div>
          </div>

          <div className="jl-field">
            <label>Condition</label>
            <textarea
              className="jl-textarea"
              value={form.condition}
              onChange={(e) => set("condition", e.target.value)}
              placeholder="Describe the condition"
              rows={3}
            />
          </div>

          <div className="jl-field">
            <label>Status</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {EQUIPMENT_STATUSES.map((s) => {
                const cfg = STATUS_CONFIG[s];
                const active = form.status === s;
                return (
                  <button
                    key={s}
                    onClick={() => set("status", s)}
                    className="jl-touch-btn"
                    style={{
                      padding: "6px 14px", borderRadius: "var(--r-pill)", fontSize: 12, fontWeight: 700,
                      cursor: "pointer",
                      background: active ? cfg.bg : "var(--ink-50)",
                      color: active ? cfg.color : "var(--ink-500)",
                      boxShadow: active ? `inset 0 0 0 1.5px ${cfg.color}` : "none",
                      transition: "all var(--t-fast) var(--ease)",
                    }}
                  >{cfg.label}</button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="jl-modal__foot">
          <button onClick={onClose} className="jl-btn jl-btn--ghost jl-touch-btn">Cancel</button>
          <button onClick={save} disabled={saving} data-loading={saving ? "" : undefined} className="jl-btn jl-btn--primary jl-touch-btn">
            <Plus size={15} />
            Add Equipment
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Condition health bar (8px desktop, 12px mobile via .jl-health-bar) ───────

function ConditionBar({ good, fair, poor, unknown }: { good: number; fair: number; poor: number; unknown: number }) {
  return (
    <div className="jl-health-bar" style={{ display: "flex", gap: 3, height: 8 }}>
      {good > 0 && (
        <div title={`${good} in good condition`} style={{ flex: good, background: "var(--green-500)", borderRadius: 99, transition: "flex var(--t-slow)" }} />
      )}
      {fair > 0 && (
        <div title={`${fair} in fair condition`} style={{ flex: fair, background: "var(--amber-500)", borderRadius: 99 }} />
      )}
      {poor > 0 && (
        <div title={`${poor} in poor condition`} style={{ flex: poor, background: "var(--red-500)", borderRadius: 99 }} />
      )}
      {unknown > 0 && (
        <div title={`${unknown} not assessed`} style={{ flex: unknown, background: "var(--ink-200)", borderRadius: 99 }} />
      )}
    </div>
  );
}

function ConditionLegend({ good, fair, poor }: { good: number; fair: number; poor: number }) {
  const items = [
    { label: "Good", val: good, color: "var(--green-700)" },
    { label: "Fair", val: fair, color: "var(--amber-700)" },
    { label: "Poor", val: poor, color: "var(--red-600)" },
  ].filter((x) => x.val > 0);
  if (items.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 7 }}>
      {items.map((x) => (
        <span key={x.label} style={{ fontSize: 10.5, fontWeight: 700, color: x.color }}>{x.val} {x.label}</span>
      ))}
    </div>
  );
}

// ─── Store Card ───────────────────────────────────────────────────────────────

function StoreCard({ store, onAdd, score }: { store: ResolvedStore; onAdd: (storeName: string) => void; score?: number | null }) {
  const total = store.equipment_count;
  const { good, fair, poor } = store.condition;
  const unknown = Math.max(0, total - good - fair - poor);
  const hasData = store.has_data;
  const groupLabel = store.storeGroup && store.storeGroup !== UNGROUPED_SUB ? store.storeGroup : undefined;

  return (
    <div
      className="jl-card jl-card--pad-sm"
      style={{ display: "flex", flexDirection: "column", gap: 14, opacity: hasData ? 1 : 0.9 }}
    >
      {/* Store name + actions */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className={hasData ? "jl-dot jl-dot--green" : "jl-dot jl-dot--amber"} title={hasData ? "Has equipment data" : "No equipment data yet"} />
            <p className="jl-h3" style={{ letterSpacing: "-0.01em" }}>{store.name}</p>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
            {groupLabel && (
              <span className="jl-badge jl-badge--blue">{groupLabel}</span>
            )}
            <span className={hasData ? "jl-badge jl-badge--green" : "jl-badge"}>
              <Package size={12} />
              {hasData ? `${total} items` : "No data yet"}
            </span>
            {store.machine_count > 0 && (
              <span className="jl-badge">
                <Printer size={12} /> {store.machine_count} printers
              </span>
            )}
            {typeof store.monthlyVolume === "number" && store.monthlyVolume > 0 && (
              <span
                className="jl-badge"
                title={`${store.monthlyVolume.toLocaleString("en-ZA")} prints in the last 30 days`}
              >
                {formatK(store.monthlyVolume)} prints
              </span>
            )}
            {store.printerHealth && store.printerHealth.active > 0 && (
              <span
                className={store.printerHealth.replaceFlagged > 0 ? "jl-badge jl-badge--amber" : "jl-badge jl-badge--green"}
                title={`${store.printerHealth.active} active printer${store.printerHealth.active !== 1 ? "s" : ""}, ${store.printerHealth.replaceFlagged} flagged for replacement`}
              >
                {store.printerHealth.active} active
                {store.printerHealth.replaceFlagged > 0 ? ` / ${store.printerHealth.replaceFlagged} replace` : ""}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          <button
            onClick={() => onAdd(store.name)}
            className="jl-btn jl-btn--soft jl-btn--icon jl-btn--sm"
            title="Add equipment"
            aria-label={`Add equipment to ${store.name}`}
          ><Plus size={15} /></button>
          <a
            href={`/equipment/stores/${encodeURIComponent(store.name)}`}
            className="jl-btn jl-btn--ghost jl-btn--icon jl-btn--sm"
            title="Open store"
            aria-label={`Open ${store.name}`}
          ><ChevronRight size={15} /></a>
        </div>
      </div>

      {/* Condition health bar */}
      {hasData && total > 0 && (
        <div>
          <ConditionBar good={good} fair={fair} poor={poor} unknown={unknown} />
          <ConditionLegend good={good} fair={fair} poor={poor} />
        </div>
      )}

      {/* Completeness badge (bottom-right) */}
      {typeof score === "number" && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "auto" }}>
          <a
            href={`/stores/${encodeURIComponent(store.name)}/completeness`}
            style={{ textDecoration: "none" }}
            title="View data completeness breakdown"
          >
            <CompletenessBadge score={score} />
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Group Header Card ─────────────────────────────────────────────────────────

interface GroupBucket {
  key: string;
  title: string;
  stores: ResolvedStore[];
  totalEquipment: number;
  good: number;
  fair: number;
  poor: number;
}

function GroupHeaderCard({
  bucket,
  collapsed,
  onToggle,
}: {
  bucket: GroupBucket;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const unknown = Math.max(0, bucket.totalEquipment - bucket.good - bucket.fair - bucket.poor);
  return (
    <button
      onClick={onToggle}
      className="jl-card jl-card--pad-sm jl-card--interactive"
      aria-expanded={!collapsed}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 16,
        marginBottom: 14,
      }}
    >
      <span className="jl-chip jl-chip--sm jl-chip--neutral">
        {collapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
      </span>

      <div style={{ minWidth: 0, flex: "0 0 auto" }}>
        <p className="jl-h3" style={{ whiteSpace: "nowrap" }}>
          {bucket.title}{" "}
          <span className="jl-muted" style={{ fontSize: 13, fontWeight: 600 }}>
            ({bucket.stores.length} {bucket.stores.length === 1 ? "store" : "stores"})
          </span>
        </p>
        <div style={{ marginTop: 6 }}>
          <span className="jl-badge">
            <Package size={12} /> {bucket.totalEquipment} items
          </span>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 120, maxWidth: 360 }}>
        {bucket.totalEquipment > 0 && (
          <>
            <ConditionBar good={bucket.good} fair={bucket.fair} poor={bucket.poor} unknown={unknown} />
            <ConditionLegend good={bucket.good} fair={bucket.fair} poor={bucket.poor} />
          </>
        )}
      </div>
    </button>
  );
}

// ─── KPI Card (jl-kpi) ────────────────────────────────────────────────────────

function KpiCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="jl-kpi">
      <div className="jl-kpi__top">
        <span className="jl-kpi__label">{label}</span>
      </div>
      <div className="jl-kpi__value" style={accent ? { color: accent } : undefined}>{value}</div>
    </div>
  );
}

// ─── Group View Toggle (jl-segment) ───────────────────────────────────────────

const VIEW_OPTIONS: { value: GroupView; label: string }[] = [
  { value: "store", label: "By Store" },
  { value: "storeGroup", label: "By Store Group" },
  { value: "mainGroup", label: "By Main Group" },
];

function GroupViewToggle({ view, onChange }: { view: GroupView; onChange: (v: GroupView) => void }) {
  return (
    <div className="jl-segment" role="tablist" style={{ flexWrap: "wrap" }}>
      {VIEW_OPTIONS.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={view === o.value}
          onClick={() => onChange(o.value)}
          className="jl-touch-btn"
        >{o.label}</button>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EquipmentCRMPage() {
  const [stores, setStores] = useState<StoreCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalStore, setModalStore] = useState<string | undefined>();
  const [view, setView] = useState<GroupView>("store");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  // P19: single admin call maps a completeness score per store onto the cards,
  // avoiding one /completeness request per visible card (N+1). Keyed lowercase.
  const [scoreMap, setScoreMap] = useState<Record<string, number>>({});

  // Role gate: the 48-store grid is admin-only. Store staff are sent straight
  // to their own store page (middleware also enforces this at the routing
  // layer; this guard prevents the grid rendering during client navigation).
  const router = useRouter();
  const { isAdmin, role, store, loading: roleLoading } = useRole();
  const isStoreStaff = role === "store_staff";

  useEffect(() => {
    if (isStoreStaff && store) {
      router.replace(`/stores/${encodeURIComponent(store)}`);
    }
  }, [isStoreStaff, store, router]);

  // SSR-safe: read persisted toggle after mount (default "store" on first render → no hydration mismatch)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved === "store" || saved === "storeGroup" || saved === "mainGroup") {
        setView(saved);
      }
    } catch {
      // localStorage unavailable — keep default
    }
  }, []);

  const changeView = useCallback((v: GroupView) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, v);
    } catch {
      // ignore persistence failures
    }
  }, []);

  const fetchStores = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/equipment/all-stores");
      const data = await res.json();
      setStores(Array.isArray(data.stores) ? data.stores : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStores(); }, [fetchStores]);

  // Single data-quality fetch -> overallScore per store (see comment above).
  // Gracefully no-ops if the route 404s during dev or the user is not admin.
  useEffect(() => {
    let alive = true;
    fetch("/api/reports/data-quality")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((rows: { store: string; overallScore: number }[]) => {
        if (!alive || !Array.isArray(rows)) return;
        const map: Record<string, number> = {};
        for (const row of rows) {
          if (row && typeof row.store === "string" && typeof row.overallScore === "number") {
            map[row.store.trim().toLowerCase()] = row.overallScore;
          }
        }
        setScoreMap(map);
      })
      .catch(() => { /* scores optional */ });
    return () => { alive = false; };
  }, []);

  const openAdd = (storeName?: string) => { setModalStore(storeName); setShowModal(true); };

  // Resolve group fields: prefer API values, fall back to client-side getStoreGroup.
  const resolved = useMemo<ResolvedStore[]>(() => {
    return stores.map((s) => {
      const entry = getStoreGroup(s.name);
      return {
        ...s,
        mainGroup: s.mainGroup ?? entry?.mainGroup ?? UNGROUPED_MAIN,
        storeGroup: s.storeGroup ?? entry?.storeGroup ?? UNGROUPED_SUB,
        holdingGroup: s.holdingGroup ?? entry?.holdingGroup,
      };
    });
  }, [stores]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return resolved;
    return resolved.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.storeGroup.toLowerCase().includes(q) ||
      s.mainGroup.toLowerCase().includes(q)
    );
  }, [resolved, search]);

  // KPI stats (over full dataset, not search-filtered).
  const totalItems = resolved.reduce((s, x) => s + x.equipment_count, 0);
  const storesWithData = resolved.filter((s) => s.has_data).length;
  const needingAttention = resolved.filter((s) => !s.has_data).length;
  const totalPoor = resolved.reduce((s, x) => s + x.condition.poor, 0);

  // ── Bucketing for grouped views ──
  const buckets = useMemo<GroupBucket[]>(() => {
    if (view === "store") return [];

    const byKey = new Map<string, GroupBucket>();

    const ensure = (key: string, title: string): GroupBucket => {
      let b = byKey.get(key);
      if (!b) {
        b = { key, title, stores: [], totalEquipment: 0, good: 0, fair: 0, poor: 0 };
        byKey.set(key, b);
      }
      return b;
    };

    for (const s of filtered) {
      const key = view === "mainGroup" ? s.mainGroup : `${s.mainGroup}||${s.storeGroup}`;
      const title = view === "mainGroup" ? s.mainGroup : s.storeGroup;
      const b = ensure(key, title);
      b.stores.push(s);
      b.totalEquipment += s.equipment_count;
      b.good += s.condition.good;
      b.fair += s.condition.fair;
      b.poor += s.condition.poor;
    }

    // Order buckets by the canonical hierarchy, ungrouped last.
    const ordered: GroupBucket[] = [];
    const pushIfPresent = (key: string) => {
      const b = byKey.get(key);
      if (b) { ordered.push(b); byKey.delete(key); }
    };

    if (view === "mainGroup") {
      for (const main of getMainGroups()) pushIfPresent(main);
    } else {
      for (const main of getMainGroups()) {
        for (const grp of getStoreGroupsByMain(main)) pushIfPresent(`${main}||${grp}`);
      }
    }
    // Any remaining (ungrouped / unknown) buckets, alphabetically.
    const rest = Array.from(byKey.values()).sort((a, b) => a.title.localeCompare(b.title));
    return [...ordered, ...rest];
  }, [view, filtered]);

  const toggleGroup = (key: string) =>
    setCollapsed((c) => ({ ...c, [key]: !c[key] }));

  // Never render the 48-store grid to store staff (or before the role resolves).
  // Store staff are redirected by the effect above; render a neutral shell in
  // the meantime so no store's data flashes.
  if (roleLoading || !isAdmin) {
    return (
      <AppShell>
        <div className="jl-page-pad" style={{ padding: "12px 24px" }} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="jl-page-pad" style={{ padding: "12px 24px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28, gap: 16, flexWrap: "wrap" }}>
          <h1 className="jl-h1">Equipment</h1>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href="/api/equipment/export" download className="jl-btn jl-btn--secondary jl-touch-btn">
              <Download size={16} /> Export CSV
            </a>
            <button onClick={() => openAdd()} className="jl-btn jl-btn--primary jl-touch-btn">
              <Plus size={16} /> Add Equipment
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="jl-grid-kpi" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
          <KpiCard label="Total Items" value={totalItems} />
          <KpiCard label="Stores with Data" value={storesWithData} accent="var(--green-700)" />
          <KpiCard label="Needs Attention" value={needingAttention} accent={needingAttention > 0 ? "var(--amber-700)" : "var(--green-700)"} />
          <KpiCard label="Poor Condition" value={totalPoor} accent={totalPoor > 0 ? "var(--red-600)" : "var(--green-700)"} />
        </div>

        {/* Controls: view toggle + search */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          <GroupViewToggle view={view} onChange={changeView} />
          <div className="jl-search" style={{ width: 340, maxWidth: "100%" }}>
            <Search size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search stores"
              style={search ? { paddingRight: 42 } : undefined}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="jl-btn jl-btn--ghost jl-btn--icon jl-btn--sm"
                style={{ position: "absolute", right: 6 }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, height: 160, color: "var(--ink-400)", fontSize: 13.5 }}>
            <span className="jl-spinner jl-spinner--sm" /> Loading stores
          </div>
        ) : filtered.length === 0 ? (
          <div className="jl-card" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160, color: "var(--ink-400)", fontSize: 13.5 }}>
            No stores match your search.
          </div>
        ) : view === "store" ? (
          // ── Flat A–Z grid, all stores together ──
          <div className="jl-grid-stores" style={GRID}>
            {[...filtered]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((s) => <StoreCard key={s.name} store={s} onAdd={openAdd} score={scoreMap[s.name.trim().toLowerCase()]} />)}
          </div>
        ) : (
          // ── Grouped views ──
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {buckets.map((b) => (
              <div key={b.key}>
                <GroupHeaderCard
                  bucket={b}
                  collapsed={!!collapsed[b.key]}
                  onToggle={() => toggleGroup(b.key)}
                />
                {!collapsed[b.key] && (
                  <div className="jl-grid-stores" style={GRID}>
                    {[...b.stores]
                      .sort((a, s) => a.name.localeCompare(s.name))
                      .map((s) => <StoreCard key={s.name} store={s} onAdd={openAdd} score={scoreMap[s.name.trim().toLowerCase()]} />)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <AddEquipmentModal
          defaultStore={modalStore}
          onClose={() => { setShowModal(false); setModalStore(undefined); }}
          onSaved={fetchStores}
        />
      )}
    </AppShell>
  );
}
