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
      ? <ChevronUp size={13} style={{ marginLeft: 4 }} />
      : <ChevronDown size={13} style={{ marginLeft: 4 }} />;
  };

  const headBtnStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    font: "inherit",
    color: "inherit",
    letterSpacing: "inherit",
    textTransform: "inherit" as React.CSSProperties["textTransform"],
    cursor: "pointer",
  };

  return (
    <AppShell>
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "var(--s-6)",
            gap: "var(--s-3)",
            flexWrap: "wrap",
          }}
        >
          <h1 className="jl-h1" style={{ margin: 0 }}>Model Catalogue</h1>
          <div style={{ display: "flex", gap: "var(--s-3)", alignItems: "center", flexWrap: "wrap" }}>
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

        {loading ? (
          <div className="jl-card" style={{ textAlign: "center", color: "var(--ink-400)", padding: "var(--s-9)" }}>
            Loading catalogue
          </div>
        ) : filtered.length === 0 ? (
          <div className="jl-card" style={{ textAlign: "center", color: "var(--ink-400)", padding: "var(--s-9)" }}>
            No models match your filters.
          </div>
        ) : (
          <div className="jl-table-wrap" style={{ overflowX: "auto" }}>
            <table className="jl-table" style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={{ width: 36 }} aria-hidden />
                  <th>
                    <button style={headBtnStyle} onClick={() => toggleSort("name")}>
                      Model {sortIcon("name")}
                    </button>
                  </th>
                  <th>
                    <button style={headBtnStyle} onClick={() => toggleSort("manufacturer")}>
                      Manufacturer {sortIcon("manufacturer")}
                    </button>
                  </th>
                  <th>
                    <button style={headBtnStyle} onClick={() => toggleSort("equipment_type")}>
                      Type {sortIcon("equipment_type")}
                    </button>
                  </th>
                  <th className="num">
                    <button
                      style={{ ...headBtnStyle, justifyContent: "flex-end", width: "100%" }}
                      onClick={() => toggleSort("item_count")}
                    >
                      Items {sortIcon("item_count")}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
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
      <tr style={{ cursor: "pointer" }} onClick={onToggle}>
        <td style={{ width: 36, color: "var(--ink-400)" }}>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </td>
        <td className="cell-strong">{model.name}</td>
        <td>
          {model.manufacturer || <span style={{ color: "var(--ink-400)" }}>Not set</span>}
        </td>
        <td>
          <span className="jl-badge jl-badge--blue">{model.equipment_type}</span>
        </td>
        <td className="num">
          <span className={`jl-badge ${model.item_count > 0 ? "jl-badge--green" : ""}`}>
            {model.item_count}
          </span>
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={5} style={{ padding: 0, background: "var(--surface-sunken)" }}>
            {itemsLoading ? (
              <div style={{ padding: "var(--s-5)", textAlign: "center", color: "var(--ink-400)", fontSize: "var(--fs-sm)" }}>
                Loading items
              </div>
            ) : items.length === 0 ? (
              <div style={{ padding: "var(--s-5)", textAlign: "center", color: "var(--ink-400)", fontSize: "var(--fs-sm)" }}>
                No items are using this model yet.
              </div>
            ) : (
              <div style={{ padding: "var(--s-3) var(--s-4) var(--s-4)", overflowX: "auto" }}>
                <table className="jl-table" style={{ minWidth: 640, background: "var(--surface)", borderRadius: "var(--r-md)", boxShadow: "var(--sh-sm)", overflow: "hidden" }}>
                  <thead>
                    <tr>
                      <th>Store</th>
                      <th>Serial</th>
                      <th>Located At</th>
                      <th>Condition</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr
                        key={it.id}
                        style={{ cursor: "pointer" }}
                        onClick={() => { window.location.href = `/equipment/items/${it.id}`; }}
                      >
                        <td className="cell-strong">{it.store}</td>
                        <td>{it.serial || <span style={{ color: "var(--ink-400)" }}>Not set</span>}</td>
                        <td>{it.located_at || <span style={{ color: "var(--ink-400)" }}>Not set</span>}</td>
                        <td>{it.condition || <span style={{ color: "var(--ink-400)" }}>Not set</span>}</td>
                        <td>{it.status || <span style={{ color: "var(--ink-400)" }}>Not set</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
