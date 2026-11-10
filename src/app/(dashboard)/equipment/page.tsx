"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Download, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Empty } from "@/components/machines/empty";
import { Field } from "@/components/machines/field";
import { LinkButton } from "@/components/machines/link-button";
import { Loading } from "@/components/machines/loading";
import { ConditionBar } from "@/components/machines/mix-bar";
import { Page } from "@/components/machines/page";
import { Pick } from "@/components/machines/pick";
import { EQUIPMENT_STATUS_LABEL } from "@/components/machines/status-badge";
import { Tile, TileRow } from "@/components/machines/tile";
import { EQUIPMENT_STATUSES, EQUIPMENT_TYPES, type EquipmentStatus } from "@/lib/equipment-utils";
import { getMainGroups, getStoreGroup, getStoreGroupsByMain } from "@/lib/store-groups";
import { toast } from "@/lib/toast";
import { SURFACE, TYPE } from "@/lib/ui/ui-tokens";
import { cn } from "@/lib/ui/utils";
import { useRole } from "@/lib/use-role";

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

// ─── Add Equipment dialog ─────────────────────────────────────────────────────

function AddEquipmentDialog({
  open,
  defaultStore,
  onClose,
  onSaved,
}: {
  open: boolean;
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
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent size="form">
        <DialogHeader>
          <DialogTitle>Add Equipment</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Store *" htmlFor="add-store">
              <Pick id="add-store" value={form.store} onChange={(v) => set("store", v)} placeholder="Select store" options={STORE_NAMES.map((s) => ({ value: s, label: s }))} />
            </Field>
            <Field label="Type *" htmlFor="add-type">
              <Pick id="add-type" value={form.machine_type} onChange={(v) => set("machine_type", v)} placeholder="Select type" options={EQUIPMENT_TYPES.map((t) => ({ value: t, label: t }))} />
            </Field>
          </div>
          <Field label="Make / Model" htmlFor="add-model">
            <Input id="add-model" value={form.make_model} onChange={(e) => set("make_model", e.target.value)} placeholder="e.g. Polar Mohr 76EM" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Serial Number" htmlFor="add-serial">
              <Input id="add-serial" value={form.serial} onChange={(e) => set("serial", e.target.value)} placeholder="Serial" />
            </Field>
            <Field label="Located At" htmlFor="add-located">
              <Input id="add-located" value={form.located_at} onChange={(e) => set("located_at", e.target.value)} placeholder="If different from store" />
            </Field>
          </div>
          <Field label="Condition" htmlFor="add-condition">
            <Textarea id="add-condition" value={form.condition} onChange={(e) => set("condition", e.target.value)} placeholder="Describe the condition" rows={3} />
          </Field>
          <Field label="Status">
            <Segmented
              value={form.status}
              onValueChange={(v) => set("status", v)}
              options={EQUIPMENT_STATUSES.map((s) => ({ value: s, label: EQUIPMENT_STATUS_LABEL[s] }))}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Spinner /> : <Plus />}
            Add Equipment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Store row ────────────────────────────────────────────────────────────────

function StoreRow({ store, score }: { store: ResolvedStore; score?: number }) {
  const total = store.equipment_count;
  const { good, fair, poor } = store.condition;
  const unknown = Math.max(0, total - good - fair - poor);

  return (
    <Link
      href={`/equipment/stores/${encodeURIComponent(store.name)}`}
      title={typeof score === "number" ? `Open ${store.name} · ${Math.round(score)}% complete` : `Open ${store.name}`}
      className="flex items-center gap-2.5 rounded-lg px-2 py-2 outline-none hover:bg-muted focus-visible:bg-muted"
    >
      <span className={cn(TYPE.data, "max-w-1/2 shrink-0 truncate font-semibold")}>{store.name}</span>
      <span className="min-w-0 flex-1">
        {store.has_data && total > 0 ? <ConditionBar good={good} fair={fair} poor={poor} unknown={unknown} /> : null}
      </span>
      {!store.has_data && <Badge status="warning">No data</Badge>}
      <ChevronRight className="size-4 shrink-0 text-faint" />
    </Link>
  );
}

interface GroupBucket {
  key: string;
  title: string;
  stores: ResolvedStore[];
  totalEquipment: number;
  good: number;
  fair: number;
  poor: number;
}

const VIEW_OPTIONS: { value: GroupView; label: string }[] = [
  { value: "storeGroup", label: "By Store Group" },
  { value: "mainGroup", label: "By Main Group" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EquipmentCRMPage() {
  const [stores, setStores] = useState<StoreCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalKey, setModalKey] = useState(0);
  const [view, setView] = useState<GroupView>("storeGroup");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  // P19: single admin call maps a completeness score per store onto the rows,
  // avoiding one /completeness request per visible store (N+1). Keyed lowercase.
  const [scoreMap, setScoreMap] = useState<Record<string, number>>({});

  // Role gate: the 48-store grid is admin-only. Store staff are sent straight
  // to their own store page (middleware also enforces this at the routing
  // layer; this guard prevents the grid rendering during client navigation).
  const router = useRouter();
  const { isAdmin, role, store, loading: roleLoading } = useRole();
  const isStoreStaff = role === "store_staff";

  useEffect(() => {
    if (!roleLoading && isStoreStaff) {
      router.replace(store ? `/equipment/stores/${encodeURIComponent(store)}` : "/");
    }
  }, [roleLoading, isStoreStaff, store, router]);

  // SSR-safe: read the persisted toggle after mount (no hydration mismatch).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved === "storeGroup" || saved === "mainGroup") setView(saved);
    } catch {
      // localStorage unavailable: keep the default
    }
  }, []);

  const changeView = useCallback((v: string) => {
    setView(v as GroupView);
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
      // here: same-named store groups across holdings merge into one column).
      // By Main Group buckets on mainGroup.
      const key = view === "mainGroup" ? s.mainGroup : s.storeGroup;
      const b = ensure(key, key);
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

  const toggleGroup = (key: string) => setCollapsed((c) => ({ ...c, [key]: !c[key] }));

  // Never render the 48-store grid to store staff (or before the role resolves).
  // Store staff are redirected by the effect above; render the bare page in the
  // meantime so no store's data flashes.
  if (roleLoading || !isAdmin) {
    return <Page title="Equipment"><span /></Page>;
  }

  return (
    <Page
      title="Equipment"
      actions={
        <>
          <LinkButton href="/api/equipment/export" download variant="outline">
            <Download /> Export CSV
          </LinkButton>
          <Button onClick={() => { setModalKey((k) => k + 1); setShowModal(true); }}>
            <Plus /> Add Equipment
          </Button>
        </>
      }
    >
      <TileRow>
        <Tile label="Total Items" value={totalItems} />
        <Tile label="Stores with Data" value={storesWithData} />
        <Tile label="Needs Attention" value={needingAttention} tone={needingAttention > 0 ? "danger" : "default"} />
        <Tile label="Poor Condition" value={totalPoor} tone={totalPoor > 0 ? "danger" : "default"} />
      </TileRow>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented value={view} onValueChange={changeView} options={VIEW_OPTIONS} />
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search stores" aria-label="Search stores" className="pl-9" />
        </div>
      </div>

      {loading ? (
        <Loading label="Loading stores" />
      ) : filtered.length === 0 ? (
        <Empty title="No stores match your search" />
      ) : (
        // Columns of groups; the stores stack under each collapsible heading.
        <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {buckets.map((b) => {
            const isCollapsed = !!collapsed[b.key];
            return (
              <section key={b.key} className={cn(SURFACE.card, "flex min-w-0 flex-col p-2")}>
                <Button
                  variant="ghost"
                  className="h-auto w-full justify-start gap-2 px-2 py-2"
                  onClick={() => toggleGroup(b.key)}
                  aria-expanded={!isCollapsed}
                  title={isCollapsed ? "Expand" : "Collapse"}
                >
                  {isCollapsed ? <ChevronRight /> : <ChevronDown />}
                  <span className={cn(TYPE.section, "min-w-0 flex-1 truncate text-left")}>{b.title}</span>
                  <Badge variant="secondary">{b.stores.length}</Badge>
                </Button>
                {!isCollapsed && (
                  <div className="flex flex-col">
                    {[...b.stores]
                      .sort((a, s) => a.name.localeCompare(s.name))
                      .map((s) => <StoreRow key={s.name} store={s} score={scoreMap[s.name.trim().toLowerCase()]} />)}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <AddEquipmentDialog key={modalKey} open={showModal} onClose={() => setShowModal(false)} onSaved={fetchStores} />
    </Page>
  );
}
