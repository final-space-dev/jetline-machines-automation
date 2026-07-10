"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp, Search } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { JlSelect } from "@/components/ui/jl-select";

interface ModelRow {
  id: number;
  name: string;
  manufacturer: string | null;
  equipment_type: string;
  year_introduced: number | null;
  notes: string | null;
  item_count: number;
}

interface ItemRow {
  id: number;
  store: string;
  serial: string | null;
  condition: string | null;
  status: string | null;
  located_at: string | null;
}

type SortKey = "name" | "manufacturer" | "equipment_type" | "item_count";
type SortDir = "asc" | "desc";

export default function EquipmentModelsCataloguePage() {
  const [rows, setRows] = useState<ModelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/setup/models");
        const json = res.ok ? await res.json() : { rows: [] };
        if (active) setRows(Array.isArray(json.rows) ? json.rows : []);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const typeOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.equipment_type));
    return [
      { value: "", label: "All types" },
      ...[...set].sort().map((t) => ({ value: t, label: t })),
    ];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (typeFilter && r.equipment_type !== typeFilter) return false;
      if (q) {
        const hay = `${r.name} ${r.manufacturer ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "item_count") {
        cmp = a.item_count - b.item_count;
      } else {
        const av = (a[sortKey] ?? "").toString().toLowerCase();
        const bv = (b[sortKey] ?? "").toString().toLowerCase();
        cmp = av.localeCompare(bv);
      }
      return cmp * dir;
    });
  }, [rows, typeFilter, search, sortKey, sortDir]);

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prevKey;
      }
      setSortDir(key === "item_count" ? "desc" : "asc");
      return key;
    });
  }, []);

  const openModel = useCallback(async (model: ModelRow) => {
    if (expandedId === model.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(model.id);
    setItems([]);
    setItemsLoading(true);
    try {
      // Items using this model: match legacy make_model text across all stores.
      const res = await fetch(`/api/equipment?q=${encodeURIComponent(model.name)}&limit=500`);
      const json = res.ok ? await res.json() : { rows: [] };
      const all: ItemRow[] = Array.isArray(json.rows) ? json.rows : [];
      const exact = all.filter(
        (r) => (r as ItemRow & { make_model?: string }).make_model?.trim().toLowerCase() === model.name.toLowerCase()
      );
      setItems(exact.length > 0 ? exact : all);
    } finally {
      setItemsLoading(false);
    }
  }, [expandedId]);

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return null;
    return sortDir === "asc"
      ? <ChevronUp className="w-3.5 h-3.5" />
      : <ChevronDown className="w-3.5 h-3.5" />;
  };

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Header + filters */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="jl-h1" style={{ margin: 0 }}>Model Catalogue</h1>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="jl-search" style={{ width: 260 }}>
              <Search />
              <input
                placeholder="Search models"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <JlSelect
              value={typeFilter}
              onChange={setTypeFilter}
              options={typeOptions}
              placeholder="All types"
              style={{ width: 200 }}
            />
          </div>
        </div>

        {/* Catalogue table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="text-center py-8 text-gray-500 text-sm">Loading catalogue</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">No models match your filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="w-9 px-4 py-2" aria-hidden />
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 uppercase hover:text-gray-900"
                        onClick={() => toggleSort("name")}
                      >
                        Model {sortIcon("name")}
                      </button>
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 uppercase hover:text-gray-900"
                        onClick={() => toggleSort("manufacturer")}
                      >
                        Manufacturer {sortIcon("manufacturer")}
                      </button>
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 uppercase hover:text-gray-900"
                        onClick={() => toggleSort("equipment_type")}
                      >
                        Type {sortIcon("equipment_type")}
                      </button>
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 uppercase hover:text-gray-900"
                        onClick={() => toggleSort("item_count")}
                      >
                        Items {sortIcon("item_count")}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((m) => (
                    <FragmentRow
                      key={m.id}
                      model={m}
                      open={expandedId === m.id}
                      items={items}
                      itemsLoading={itemsLoading}
                      onToggle={() => void openModel(m)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function FragmentRow({
  model,
  open,
  items,
  itemsLoading,
  onToggle,
}: {
  model: ModelRow;
  open: boolean;
  items: ItemRow[];
  itemsLoading: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="hover:bg-gray-50 cursor-pointer" onClick={onToggle}>
        <td className="px-4 py-3 text-gray-400">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </td>
        <td className="px-4 py-3 text-sm font-medium text-gray-900">{model.name}</td>
        <td className="px-4 py-3 text-sm text-gray-700">
          {model.manufacturer || <span className="text-gray-400">Not set</span>}
        </td>
        <td className="px-4 py-3">
          <span className="jl-badge jl-badge--blue">{model.equipment_type}</span>
        </td>
        <td className="px-4 py-3 text-right">
          <span className={`jl-badge ${model.item_count > 0 ? "jl-badge--green" : ""}`}>
            {model.item_count}
          </span>
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={5} className="p-0 bg-gray-50">
            {itemsLoading ? (
              <div className="text-center py-5 text-gray-500 text-sm">Loading items</div>
            ) : items.length === 0 ? (
              <div className="text-center py-5 text-gray-500 text-sm">No items are using this model yet.</div>
            ) : (
              <div className="p-4 overflow-x-auto">
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <table className="w-full" style={{ minWidth: 640 }}>
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Store</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Serial</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Located At</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Condition</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.map((it) => (
                        <tr
                          key={it.id}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => { window.location.href = `/equipment/items/${it.id}`; }}
                        >
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{it.store}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{it.serial || <span className="text-gray-400">Not set</span>}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{it.located_at || <span className="text-gray-400">Not set</span>}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{it.condition || <span className="text-gray-400">Not set</span>}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{it.status || <span className="text-gray-400">Not set</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
