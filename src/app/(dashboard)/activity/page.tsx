"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { JlSelect } from "@/components/ui/jl-select";
import { JlDate } from "@/components/ui/jl-date";
import { ALL_XEROX_STORES } from "@/lib/equipment-utils";
import { relativeTime, type ActivityEntry } from "@/components/dashboard/activity-feed";

type TypeFilter = "all" | "equipment" | "printer";

interface ActivityResponse {
  entries: ActivityEntry[];
  page: number;
  hasMore: boolean;
  todayCount: number;
}

const PAGE_SIZE = 50;

const STORE_OPTIONS = [
  { value: "", label: "All stores" },
  ...ALL_XEROX_STORES.map((s) => ({ value: s, label: s })),
];

const TYPE_BUTTONS: Array<{ value: TypeFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "equipment", label: "Equipment" },
  { value: "printer", label: "Printer" },
];

// Date grouping

type GroupKey = "Today" | "Yesterday" | "This Week" | "Earlier";

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function groupFor(iso: string): GroupKey {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "Earlier";
  const today = startOfDay(new Date());
  const day = startOfDay(when);
  const diffDays = Math.round((today.getTime() - day.getTime()) / 86400000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This Week";
  return "Earlier";
}

const GROUP_ORDER: GroupKey[] = ["Today", "Yesterday", "This Week", "Earlier"];

function dotColor(type: ActivityEntry["item_type"]): string {
  return type === "printer" ? "var(--blue-500)" : "var(--red-500)";
}

function fieldLabel(field: string): string {
  return field.replace(/_/g, " ");
}

export default function ActivityPage() {
  const [store, setStore] = useState<string>("");
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [type, setType] = useState<TypeFilter>("all");

  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildUrl = useCallback(
    (pageNum: number) => {
      const qs = new URLSearchParams();
      if (store) qs.set("store", store);
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      if (type !== "all") qs.set("type", type);
      qs.set("page", String(pageNum));
      qs.set("limit", String(PAGE_SIZE));
      return `/api/activity?${qs.toString()}`;
    },
    [store, from, to, type],
  );

  // Load first page whenever a filter changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(buildUrl(1))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: ActivityResponse) => {
        if (cancelled) return;
        setEntries(json.entries ?? []);
        setPage(1);
        setHasMore(Boolean(json.hasMore));
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [buildUrl]);

  const loadMore = useCallback(() => {
    const next = page + 1;
    setLoadingMore(true);
    fetch(buildUrl(next))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: ActivityResponse) => {
        setEntries((prev) => [...prev, ...(json.entries ?? [])]);
        setPage(next);
        setHasMore(Boolean(json.hasMore));
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoadingMore(false));
  }, [buildUrl, page]);

  const grouped = useMemo(() => {
    const map = new Map<GroupKey, ActivityEntry[]>();
    for (const e of entries) {
      const g = groupFor(e.changed_at);
      const arr = map.get(g);
      if (arr) arr.push(e);
      else map.set(g, [e]);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ group: g, items: map.get(g)! }));
  }, [entries]);

  return (
    <AppShell>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-5)" }}>
        <h1 className="jl-h1">Activity</h1>

        {/* Filter bar */}
        <div
          className="jl-card jl-card--pad-sm"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "var(--s-3)",
          }}
        >
          <JlSelect value={store} onChange={setStore} options={STORE_OPTIONS} placeholder="All stores" style={{ width: 200 }} />
          <JlDate value={from} onChange={setFrom} placeholder="From date" style={{ width: 190 }} />
          <JlDate value={to} onChange={setTo} placeholder="To date" style={{ width: 190 }} />

          <div className="jl-segment" role="tablist" aria-label="Filter by type">
            {TYPE_BUTTONS.map((b) => (
              <button
                key={b.value}
                type="button"
                role="tab"
                aria-selected={type === b.value}
                onClick={() => setType(b.value)}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="jl-card jl-card--pad-sm" style={{ padding: 0, overflow: "hidden" }}>
          {loading && (
            <div style={{ padding: "var(--s-8)", textAlign: "center", fontSize: "var(--fs-sm)", color: "var(--ink-400)" }}>
              Loading activity...
            </div>
          )}
          {error && !loading && (
            <div style={{ padding: "var(--s-8)", textAlign: "center", fontSize: "var(--fs-sm)", color: "var(--red-700)" }}>
              Failed to load activity
            </div>
          )}
          {!loading && !error && entries.length === 0 && (
            <div style={{ padding: "var(--s-8)", textAlign: "center", fontSize: "var(--fs-sm)", color: "var(--ink-400)" }}>
              No changes match these filters
            </div>
          )}

          {!loading &&
            !error &&
            grouped.map(({ group, items }) => (
              <div key={group}>
                <div
                  style={{
                    padding: "10px 18px",
                    fontSize: "var(--fs-xs)",
                    fontWeight: 800,
                    letterSpacing: "var(--tracking-caps)",
                    textTransform: "uppercase",
                    color: "var(--ink-400)",
                    background: "var(--surface-sunken)",
                    borderBottom: "1px solid var(--ink-100)",
                  }}
                >
                  {group}
                </div>
                {items.map((e) => (
                  <div
                    key={`${e.item_type}-${e.id}`}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "var(--s-3)",
                      padding: "12px 18px",
                      borderBottom: "1px solid var(--ink-100)",
                    }}
                  >
                    <span
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: "50%",
                        background: dotColor(e.item_type),
                        marginTop: 5,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: "var(--fs-sm)", color: "var(--ink-800)", lineHeight: 1.5 }}>
                        <span style={{ fontWeight: 700, color: "var(--ink-900)" }}>{e.user_name}</span>
                        {" changed "}
                        <span style={{ fontWeight: 600 }}>{fieldLabel(e.field)}</span>
                        {" on "}
                        <span style={{ fontWeight: 600 }}>{e.ref}</span>
                        {e.store ? (
                          <>
                            {" at "}
                            <span style={{ fontWeight: 600 }}>{e.store}</span>
                          </>
                        ) : null}
                      </div>
                      {(e.old_value || e.new_value) && (
                        <div style={{ fontSize: "var(--fs-xs)", color: "var(--ink-500)", marginTop: 2 }}>
                          {e.old_value ?? "empty"}
                          {"  →  "}
                          {e.new_value ?? "empty"}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: "var(--fs-xs)", color: "var(--ink-400)", flexShrink: 0, whiteSpace: "nowrap" }}>
                      {relativeTime(e.changed_at)}
                    </div>
                  </div>
                ))}
              </div>
            ))}

          {!loading && !error && hasMore && (
            <div style={{ padding: "var(--s-4)", textAlign: "center" }}>
              <button
                type="button"
                className="jl-btn jl-btn--secondary jl-btn--sm"
                onClick={loadMore}
                disabled={loadingMore}
                data-loading={loadingMore ? "" : undefined}
              >
                {loadingMore ? "Loading" : "Load more"}
              </button>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
