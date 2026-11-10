"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Package, Plus, Save, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { TabStrip } from "@/components/machines/tab-strip";
import { BulkActionBar } from "@/components/equipment/bulk-action-bar";
import { PhotoButton } from "@/components/equipment/photo-button";
import { PrintSection } from "@/components/equipment/print-section";
import { DataTable, type Column } from "@/components/machines/data-table";
import { Field } from "@/components/machines/field";
import { LinkButton } from "@/components/machines/link-button";
import { Loading } from "@/components/machines/loading";
import { ConditionBar } from "@/components/machines/mix-bar";
import { Page } from "@/components/machines/page";
import { Muted, Panel } from "@/components/machines/panel";
import { Pick } from "@/components/machines/pick";
import { CompletenessBadge, ConditionBadge, EQUIPMENT_STATUS_LABEL, EquipmentStatusBadge } from "@/components/machines/status-badge";
import { Tile, TileRow } from "@/components/machines/tile";
import { EQUIPMENT_STATUSES, classifyCondition, type ConditionBucket, type EquipmentStatus } from "@/lib/equipment-utils";
import { getStoreGroup, STORE_GROUPS } from "@/lib/store-groups";
import { count } from "@/lib/numbers";
import { toast } from "@/lib/toast";
import { GRID } from "@/lib/ui/ui-tokens";
import { useRole } from "@/lib/use-role";
import { formatDate } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Machine {
  serial_number: string;
  model_name: string | null;
  printer_type: string | null;
  last_seen: string | null;
  condition_notes: string | null;
  install_date: string | null;            // Latest install (BMS, current store)
  original_install_date: string | null;   // First-ever install → drives Age
  latest_balance: number | string | null;
  latest_balance_date: string | null;
}

/** Age in years from an original install date, computed live. */
function ageYears(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) months -= 1;
  if (months < 0) months = 0;
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m}m`;
  return m > 0 ? `${y}y ${m}m` : `${y}y`;
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

// All store names (from the group hierarchy) for the bulk reassign dropdown.
const ALL_STORE_NAMES = [...STORE_GROUPS.map((e) => e.store)].sort();

const ALL = "__all__";

const day = (iso: string) => formatDate(iso);

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
  const { isAdmin, role, store: userStore, loading: roleLoading } = useRole();

  // Store staff may only view their OWN store. If they land on another store's
  // page, bounce them to their own (the APIs also 403 cross-store).
  useEffect(() => {
    if (!roleLoading && role === "store_staff" && userStore && userStore !== storeName) {
      router.replace(`/equipment/stores/${encodeURIComponent(userStore)}`);
    }
  }, [roleLoading, role, userStore, storeName, router]);

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

  // Store page tabs: one thing at a time keeps the page calm.
  const [tab, setTab] = useState("equipment");

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

  // "Now" is read once, when the page opens, so a re-render never changes the count.
  const [openedAt] = useState(() => Date.now());
  const activePrinters = machines.filter((m) => {
    if (!m.last_seen) return false;
    const days = (openedAt - new Date(m.last_seen).getTime()) / 86400000;
    return days <= 45;
  }).length;

  const lastUpdated = useMemo(() => {
    const times = items.map((i) => i.updated_at).filter(Boolean).map((t) => new Date(t).getTime());
    if (times.length === 0) return null;
    return new Date(Math.max(...times)).toISOString();
  }, [items]);

  // A store's three groups are often the same name twice: each name once.
  const groupChips = identity
    ? [...new Set([identity.storeGroup, identity.mainGroup, identity.holdingGroup].filter(Boolean))]
    : [];

  const conditionCounts = useMemo(() => {
    const counts: Record<ConditionBucket, number> = { good: 0, fair: 0, poor: 0, unknown: 0 };
    for (const it of items) counts[classifyCondition(it.condition)]++;
    return counts;
  }, [items]);

  // ─── Columns ───────────────────────────────────────────────────────────────

  const equipmentColumns: Column<EquipmentItem>[] = [
    ...(isAdmin
      ? [{
          key: "select",
          width: "w-11",
          label: (
            <Checkbox
              aria-label="Select all visible equipment"
              checked={allVisibleSelected}
              indeterminate={someVisibleSelected && !allVisibleSelected}
              onCheckedChange={toggleAllVisible}
            />
          ),
          cell: (item: EquipmentItem) => (
            // The row opens the item: ticking it must not.
            <span className="inline-flex" onClick={(e) => e.stopPropagation()}>
              <Checkbox aria-label={`Select ${item.machine_type}`} checked={selected.has(item.id)} onCheckedChange={() => toggleOne(item.id)} />
            </span>
          ),
        } satisfies Column<EquipmentItem>]
      : []),
    {
      key: "type",
      label: "Type",
      sortValue: (item) => item.machine_type,
      cell: (item) => (
        <span className="inline-flex items-center gap-2.5 font-medium">
          {item.photos && item.photos.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/equipment/items/${item.id}/photos/view?i=0`} alt="" className="size-8 shrink-0 rounded-lg bg-muted object-cover" />
          ) : (
            <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-faint">
              <Package className="size-4" />
            </span>
          )}
          {item.machine_type}
        </span>
      ),
    },
    {
      key: "model",
      label: "Make / model",
      hideBelow: "sm",
      sortValue: (item) => item.make_model ?? "",
      cell: (item) => item.make_model ?? <Muted>Not set</Muted>,
    },
    {
      key: "serial",
      label: "Serial",
      hideBelow: "md",
      sortValue: (item) => item.serial ?? "",
      cell: (item) => (item.serial ? <span className="tabular-nums">{item.serial}</span> : <Muted>Not set</Muted>),
    },
    {
      key: "condition",
      label: "Condition",
      hideBelow: "sm",
      sortValue: (item) => classifyCondition(item.condition),
      cell: (item) => <ConditionBadge condition={item.condition} />,
    },
    {
      key: "status",
      label: "Status",
      sortValue: (item) => item.status ?? "active",
      cell: (item) => <EquipmentStatusBadge status={item.status} />,
    },
    {
      key: "photos",
      label: "Photos",
      hideBelow: "md",
      cell: (item) => <PhotoButton itemId={item.id} initialPhotos={item.photos} canEdit={isAdmin} />,
    },
  ];

  const printerColumns: Column<Machine>[] = [
    { key: "serial", label: "Serial", sortValue: (m) => m.serial_number, cell: (m) => <span className="tabular-nums">{m.serial_number}</span> },
    { key: "model", label: "Model", sortValue: (m) => m.model_name ?? "", cell: (m) => (m.model_name ? <span className="font-medium">{m.model_name}</span> : <Muted>Not set</Muted>) },
    { key: "type", label: "Type", hideBelow: "md", sortValue: (m) => m.printer_type ?? "", cell: (m) => m.printer_type ?? <Muted>Not set</Muted> },
    {
      key: "age",
      label: "Age",
      sortValue: (m) => (m.original_install_date ? -new Date(m.original_install_date).getTime() : 0),
      cell: (m) => (
        <span className="font-medium" title={m.original_install_date ? `Original install ${day(m.original_install_date)}` : "No original install date"}>
          {ageYears(m.original_install_date)}
        </span>
      ),
    },
    {
      key: "installed",
      label: "Installed",
      hideBelow: "lg",
      sortValue: (m) => (m.install_date ? new Date(m.install_date).getTime() : 0),
      cell: (m) => <span title="Latest install (current store)">{m.install_date ? day(m.install_date) : <Muted>—</Muted>}</span>,
    },
    {
      key: "balance",
      label: "Balance",
      align: "right",
      hideBelow: "sm",
      sortValue: (m) => (m.latest_balance != null ? Number(m.latest_balance) : -1),
      cell: (m) => {
        const balance = m.latest_balance != null ? Number(m.latest_balance) : null;
        return (
          <span className={GRID.num} title={m.latest_balance_date ? `as at ${day(m.latest_balance_date)}` : undefined}>
            {balance != null ? count(balance) : <Muted>—</Muted>}
          </span>
        );
      },
    },
    {
      key: "seen",
      label: "Last seen",
      hideBelow: "md",
      sortValue: (m) => (m.last_seen ? new Date(m.last_seen).getTime() : 0),
      cell: (m) => (m.last_seen ? day(m.last_seen) : "Never"),
    },
  ];

  return (
    <Page
      title={storeName}
      titleExtra={
        completeness && (
          // The store's own page is where its completeness shows; the parts of the score are on hover.
          <CompletenessBadge
            score={completeness.overallScore}
            title={`${Math.round(completeness.overallScore)}% complete · equipment ${Math.round(completeness.equipmentScore)}% · printers ${Math.round(completeness.printerScore)}%`}
          />
        )
      }
      crumbs={isAdmin ? [{ label: "Stores", href: "/equipment" }, { label: storeName }] : undefined}
      actions={
        dirty && (
          <Button onClick={saveIdentity} disabled={saving}>
            {saving ? <Spinner /> : <Save />} Save
          </Button>
        )
      }
    >
      <Panel caption="Store details" right={groupChips.map((g) => <Badge key={g} variant="secondary">{g}</Badge>)}>
        {identity && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Address" htmlFor="store-address">
              <Input id="store-address" value={identity.address} onChange={(e) => setField("address", e.target.value)} placeholder="Store address" />
            </Field>
            <Field label="Phone" htmlFor="store-phone">
              <Input id="store-phone" value={identity.phone} onChange={(e) => setField("phone", e.target.value)} placeholder="Contact number" />
            </Field>
            <Field label="Manager name" htmlFor="store-manager">
              <Input id="store-manager" value={identity.managerName} onChange={(e) => setField("managerName", e.target.value)} placeholder="Manager" />
            </Field>
            <Field label="Manager email" htmlFor="store-email">
              <Input id="store-email" type="email" value={identity.managerEmail} onChange={(e) => setField("managerEmail", e.target.value)} placeholder="name@jetline.co.za" />
            </Field>
          </div>
        )}
      </Panel>

      <TileRow>
        <Tile label="Equipment" value={items.length} />
        <Tile label="Active printers" value={activePrinters} />
        <Tile
          label="Condition"
          value={items.length > 0 ? `${conditionCounts.good} good` : "—"}
          prior={items.length > 0 ? <ConditionBar {...conditionCounts} className="mt-1" /> : undefined}
        />
        <Tile label="Last updated" value={relTime(lastUpdated)} />
      </TileRow>

      <Tabs value={tab} onValueChange={setTab}>
        <TabStrip>
          <TabsTrigger value="equipment">Equipment{items.length > 0 ? ` (${items.length})` : ""}</TabsTrigger>
          <TabsTrigger value="printers">Printers{machines.length > 0 ? ` (${machines.length})` : ""}</TabsTrigger>
          <TabsTrigger value="performance">Printer performance</TabsTrigger>
        </TabStrip>

        <TabsContent value="equipment" className="flex flex-col gap-3 pt-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
              <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search equipment" aria-label="Search equipment" className="pl-9" />
            </div>
            <Pick
              aria-label="Filter by type"
              className="w-44"
              value={filterType || ALL}
              onChange={(v) => setFilterType(v === ALL ? "" : v)}
              options={[{ value: ALL, label: "All types" }, ...types.map((t) => ({ value: t, label: t }))]}
            />
            <Segmented
              value={filterStatus || ALL}
              onValueChange={(v) => setFilterStatus(v === ALL ? "" : v)}
              options={[{ value: ALL, label: "All" }, ...EQUIPMENT_STATUSES.map((s) => ({ value: s, label: EQUIPMENT_STATUS_LABEL[s] }))]}
            />
            <LinkButton href={addHref} className="sm:ml-auto">
              <Plus /> Add equipment
            </LinkButton>
          </div>

          {/* Bulk actions: admins only, while at least one item is selected. */}
          {isAdmin && selectedIds.length > 0 && (
            <BulkActionBar
              selectedIds={selectedIds}
              stores={ALL_STORE_NAMES}
              onApplied={() => { clearSelection(); load(); }}
              onClear={clearSelection}
            />
          )}

          {loading ? (
            <Loading />
          ) : (
            <DataTable
              columns={equipmentColumns}
              rows={filtered}
              rowKey={(item) => item.id}
              onRowClick={(item) => router.push(`/equipment/items/${item.id}`)}
              rowClassName={(item) => (selected.has(item.id) ? "bg-accent" : undefined)}
              empty={items.length === 0 ? "No equipment recorded yet" : "No results match your filters"}
            />
          )}
        </TabsContent>

        <TabsContent value="printers" className="pt-4">
          {loading ? (
            <Loading />
          ) : (
            <DataTable
              columns={printerColumns}
              rows={machines}
              rowKey={(m) => m.serial_number}
              onRowClick={(m) => router.push(`/equipment/printers/${encodeURIComponent(m.serial_number)}`)}
              empty="No Xerox printers mapped to this store"
            />
          )}
        </TabsContent>

        {/* The Print volumes chart lives here so the Equipment and Printers lists stay uncluttered. */}
        <TabsContent value="performance" className="pt-4">
          <PrintSection store={storeName} />
        </TabsContent>
      </Tabs>
    </Page>
  );
}
