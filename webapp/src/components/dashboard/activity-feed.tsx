"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export interface ActivityEntry {
  id: number;
  item_type: "equipment" | "printer";
  ref: string;
  store: string | null;
  field: string;
  old_value: string | null;
  new_value: string | null;
  user_name: string;
  changed_at: string;
}

interface ActivityFeedProps {
  store?: string;
  limit?: number;
  showViewAll?: boolean;
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const sec = Math.round(diff / 1000);
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.round(day / 7);
  if (wk < 5) return `${wk}w ago`;
  return new Date(iso).toLocaleDateString();
}

function dotColor(type: ActivityEntry["item_type"]): string {
  return type === "printer" ? "var(--jl-blue-500)" : "var(--jl-red-500)";
}

function fieldLabel(field: string): string {
  return field.replace(/_/g, " ");
}

/**
 * Reusable, compact activity feed. Used on the store detail page (Phase 04)
 * with `store` scope, or anywhere a short recent-changes list is wanted.
 */
export function ActivityFeed({ store, limit = 10, showViewAll = false }: ActivityFeedProps) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    if (store) qs.set("store", store);
    qs.set("limit", String(limit));
    fetch(`/api/activity?${qs.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: { entries: ActivityEntry[] }) => {
        if (!cancelled) setEntries(json.entries ?? []);
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
  }, [store, limit]);

  const viewAllHref = store ? `/activity?store=${encodeURIComponent(store)}` : "/activity";

  return (
    <div
      style={{
        background: "var(--jl-surface)",
        boxShadow: "var(--jl-sh-sm)",
        borderRadius: "var(--jl-r-lg)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 18px",
          borderBottom: "1px solid var(--jl-ink-50)",
        }}
      >
        <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--jl-ink-900)", fontFamily: "var(--jl-font)" }}>
          Recent Activity
        </h3>
        {showViewAll && (
          <Link
            href={viewAllHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              fontWeight: 700,
              color: "var(--jl-red-500)",
              fontFamily: "var(--jl-font)",
            }}
          >
            View all
            <ArrowRight size={13} />
          </Link>
        )}
      </div>

      <div style={{ padding: "6px 0" }}>
        {loading && (
          <div style={{ padding: "18px", fontSize: 13, color: "var(--jl-ink-400)", fontFamily: "var(--jl-font)" }}>
            Loading activity…
          </div>
        )}
        {error && (
          <div style={{ padding: "18px", fontSize: 13, color: "var(--jl-red-700)", fontFamily: "var(--jl-font)" }}>
            Failed to load activity
          </div>
        )}
        {!loading && !error && entries.length === 0 && (
          <div style={{ padding: "18px", fontSize: 13, color: "var(--jl-ink-400)", fontFamily: "var(--jl-font)" }}>
            No recent changes
          </div>
        )}
        {!loading &&
          !error &&
          entries.map((e) => (
            <div
              key={`${e.item_type}-${e.id}`}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "9px 18px",
                fontFamily: "var(--jl-font)",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: dotColor(e.item_type),
                  marginTop: 5,
                  flexShrink: 0,
                }}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, color: "var(--jl-ink-800)", lineHeight: 1.4 }}>
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
                <div style={{ fontSize: 11, color: "var(--jl-ink-400)", marginTop: 2 }}>
                  {relativeTime(e.changed_at)}
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
