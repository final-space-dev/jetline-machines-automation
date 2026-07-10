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
  Plus, Search, ChevronRight, ChevronDown, Package,
  X, Download,
} from "lucide-react";
import { CompletenessBadge } from "@/components/equipment/completeness-badge";

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

// ─── Store Card ───────────────────────────────────────────────────────────────

function StoreCard({ store }: { store: ResolvedStore; onAdd?: (storeName: string) => void; score?: number | null }) {
  const total = store.equipment_count;
  const { good, fair, poor } = store.condition;
  const unknown = Math.max(0, total - good - fair - poor);
  const hasData = store.has_data;

  return (
    <a
      href={`/equipment/stores/${encodeURIComponent(store.name)}`}
      className="jl-card jl-card--interactive"
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", textDecoration: "none", color: "inherit" }}
      title={`Open ${store.name}`}
    >
      <span
        className={hasData ? "jl-dot jl-dot--green" : "jl-dot jl-dot--amber"}
        style={{ flexShrink: 0 }}
        title={hasData ? "Has equipment data" : "No equipment data yet"}
      />
      <span style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 0, maxWidth: "45%" }}>
        {store.name}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {hasData && total > 0 && <ConditionBar good={good} fair={fair} poor={poor} unknown={unknown} />}
      </div>
      <ChevronRight size={16} style={{ color: "var(--ink-300)", flexShrink: 0 }} />
    </a>
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
          <ConditionBar good={bucket.good} fair={bucket.fair} poor={bucket.poor} unknown={unknown} />
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
  const [view, setView] = useState<GroupView>("storeGroup");
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

  // All Stores is admin-only. Store staff are redirected to their own store
  // (defence-in-depth alongside the role-scoped APIs).
  useEffect(() => {
    if (!roleLoading && isStoreStaff) {
      router.replace(store ? `/equipment/stores/${encodeURIComponent(store)}` : "/");
    }
  }, [roleLoading, isStoreStaff, store, router]);

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
      // By Store Group buckets on storeGroup ALONE (holding group is irrelevant
      // here — same-named store groups across holdings merge into one column).
      // By Main Group buckets on mainGroup.
      const key = view === "mainGroup" ? s.mainGroup : s.storeGroup;
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
        ) : (
          // ── Grouped views: columns of groups, stores stacked below each collapsible header ──
          <div className="jl-group-columns">
            {buckets.map((b) => {
              const isCollapsed = !!collapsed[b.key];
              return (
                <div key={b.key} className="jl-group-col">
                  <button
                    type="button"
                    className="jl-group-col__head"
                    onClick={() => toggleGroup(b.key)}
                    aria-expanded={!isCollapsed}
                    title={isCollapsed ? "Expand" : "Collapse"}
                  >
                    <ChevronDown
                      size={15}
                      style={{ color: "var(--ink-400)", flexShrink: 0, transform: isCollapsed ? "rotate(-90deg)" : "none", transition: "transform var(--t-fast) var(--ease)" }}
                    />
                    <div className="jl-group-col__title">{b.title}</div>
                    <span className="jl-badge">{b.stores.length}</span>
                  </button>
                  {!isCollapsed && (
                    <div className="jl-group-col__stores">
                      {[...b.stores]
                        .sort((a, s) => a.name.localeCompare(s.name))
                        .map((s) => <StoreCard key={s.name} store={s} />)}
                    </div>
                  )}
                </div>
              );
            })}
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
