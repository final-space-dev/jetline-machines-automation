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

// ── Date grouping ────────────────────────────────────────────────────────────

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
  return type === "printer" ? "var(--jl-blue-500)" : "var(--jl-red-500)";
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
      <div style={{ display: "flex", flexDirection: "column", gap: 18, fontFamily: "var(--jl-font)" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--jl-ink-900)", letterSpacing: "-0.02em" }}>
          Activity
        </h1>

        {/* Filter bar */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 12,
            padding: 14,
            background: "var(--jl-surface)",
            boxShadow: "var(--jl-sh-sm)",
            borderRadius: "var(--jl-r-lg)",
          }}
        >
          <div style={{ width: 200 }}>
            <JlSelect value={store} onChange={setStore} options={STORE_OPTIONS} placeholder="All stores" />
          </div>
          <div style={{ width: 190 }}>
            <JlDate value={from} onChange={setFrom} placeholder="From date" />
          </div>
          <div style={{ width: 190 }}>
            <JlDate value={to} onChange={setTo} placeholder="To date" />
          </div>

          <div style={{ display: "inline-flex", gap: 6 }}>
            {TYPE_BUTTONS.map((b) => {
              const active = type === b.value;
              return (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => setType(b.value)}
                  style={{
                    height: 40,
                    padding: "0 16px",
                    borderRadius: "var(--jl-r-sm)",
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: "var(--jl-font)",
                    cursor: "pointer",
                    border: active ? "1.5px solid var(--jl-red-500)" : "1.5px solid var(--jl-ink-200)",
                    background: active ? "var(--jl-red-tint)" : "var(--jl-surface)",
                    color: active ? "var(--jl-red-500)" : "var(--jl-ink-600)",
                    transition: "all var(--jl-t-fast) var(--jl-ease)",
                  }}
                >
                  {b.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Timeline */}
        <div
          style={{
            background: "var(--jl-surface)",
            boxShadow: "var(--jl-sh-sm)",
            borderRadius: "var(--jl-r-lg)",
            overflow: "hidden",
          }}
        >
          {loading && (
            <div style={{ padding: 40, textAlign: "center", fontSize: 13, color: "var(--jl-ink-400)" }}>
              Loading activity…
            </div>
          )}
          {error && !loading && (
            <div style={{ padding: 40, textAlign: "center", fontSize: 13, color: "var(--jl-red-700)" }}>
              Failed to load activity
            </div>
          )}
          {!loading && !error && entries.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", fontSize: 13, color: "var(--jl-ink-400)" }}>
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
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.07em",
                    textTransform: "uppercase",
                    color: "var(--jl-ink-400)",
                    background: "var(--jl-surface-sunken)",
                    borderBottom: "1px solid var(--jl-ink-50)",
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
                      gap: 12,
                      padding: "12px 18px",
                      borderBottom: "1px solid var(--jl-ink-50)",
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
                      <div style={{ fontSize: 13.5, color: "var(--jl-ink-800)", lineHeight: 1.5 }}>
                        <span style={{ fontWeight: 700, color: "var(--jl-ink-900)" }}>{e.user_name}</span>
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
                        <div style={{ fontSize: 12, color: "var(--jl-ink-500)", marginTop: 2 }}>
                          {e.old_value ?? "empty"}
                          {"  →  "}
                          {e.new_value ?? "empty"}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--jl-ink-400)", flexShrink: 0, whiteSpace: "nowrap" }}>
                      {relativeTime(e.changed_at)}
                    </div>
                  </div>
                ))}
              </div>
            ))}

          {!loading && !error && hasMore && (
            <div style={{ padding: 16, textAlign: "center" }}>
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                style={{
                  height: 38,
                  padding: "0 20px",
                  borderRadius: "var(--jl-r-sm)",
                  border: "1.5px solid var(--jl-ink-200)",
                  background: "var(--jl-surface)",
                  color: "var(--jl-ink-700)",
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: "var(--jl-font)",
                  cursor: loadingMore ? "default" : "pointer",
                  opacity: loadingMore ? 0.6 : 1,
                }}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
