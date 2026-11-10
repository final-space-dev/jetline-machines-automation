"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { LabelledDivider } from "@/components/ui/labelled-divider";
import { Segmented } from "@/components/ui/segmented";
import { Spinner } from "@/components/ui/spinner";
import { Timeline, TimelineItem } from "@/components/ui/timeline";
import { DayField } from "@/components/machines/day-field";
import { Empty } from "@/components/machines/empty";
import { Loading } from "@/components/machines/loading";
import { Page } from "@/components/machines/page";
import { Panel } from "@/components/machines/panel";
import { Pick } from "@/components/machines/pick";
import { relativeTime, type ActivityEntry } from "@/lib/activity";
import { ALL_XEROX_STORES } from "@/lib/equipment-utils";
import { formatDate } from "@/lib/utils";

type TypeFilter = "all" | "equipment" | "printer";

interface ActivityResponse {
  entries: ActivityEntry[];
  page: number;
  hasMore: boolean;
  todayCount: number;
}

const PAGE_SIZE = 50;

const ALL = "__all__";

const STORE_OPTIONS = [
  { value: ALL, label: "All stores" },
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

// A stored value that is a date (an ISO day, or the long form a JavaScript Date
// prints) is shown as a day; anything else as it is.
const LONG_DATE = /^[A-Z][a-z]{2} [A-Z][a-z]{2} \d{2} \d{4} \d{2}:\d{2}:\d{2} GMT/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;
function showValue(value: string | null): string {
  if (value === null || value === "") return "empty";
  if (LONG_DATE.test(value) || ISO_DATE.test(value)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return formatDate(d);
  }
  return value;
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
    <Page
      title="Activity"
      toolbar={
        <>
          <Pick aria-label="Store" className="w-full sm:w-48" value={store || ALL} onChange={(v) => setStore(v === ALL ? "" : v)} options={STORE_OPTIONS} />
          <DayField value={from} onChange={setFrom} placeholder="From date" className="flex w-full items-center gap-1.5 sm:w-52" />
          <DayField value={to} onChange={setTo} placeholder="To date" className="flex w-full items-center gap-1.5 sm:w-52" />
          <Segmented value={type} onValueChange={(v) => setType(v as TypeFilter)} options={TYPE_BUTTONS} />
        </>
      }
    >
      {loading ? (
        <Loading label="Loading activity" />
      ) : error ? (
        <Empty title="Failed to load activity" />
      ) : entries.length === 0 ? (
        <Empty title="No changes match these filters" />
      ) : (
        <Panel className="w-full max-w-4xl" bodyClassName="flex flex-col gap-2">
          {grouped.map(({ group, items }) => (
            <div key={group} className="flex flex-col gap-2">
              <LabelledDivider>{group}</LabelledDivider>
              <Timeline>
                {items.map((e) => (
                  // Printers and equipment read apart by the dot: a printer change is the system tone, equipment the action tone.
                  <TimelineItem key={`${e.item_type}-${e.id}`} tone={e.item_type === "printer" ? "system" : "action"} date={relativeTime(e.changed_at)}>
                    <span className="font-semibold text-foreground">{e.user_name}</span>
                    {" changed "}
                    <span className="font-medium">{fieldLabel(e.field)}</span>
                    {e.item_type === "printer" ? " on printer " : " on item "}
                    <span className="font-medium">{e.ref}</span>
                    {e.store ? (
                      <>
                        {" at "}
                        <span className="font-medium">{e.store}</span>
                      </>
                    ) : null}
                    {(e.old_value || e.new_value) && (
                      <span className="block text-muted-foreground">
                        {showValue(e.old_value)}
                        {"  →  "}
                        {showValue(e.new_value)}
                      </span>
                    )}
                  </TimelineItem>
                ))}
              </Timeline>
            </div>
          ))}
          {hasMore && (
            <div className="flex justify-center">
              <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                {loadingMore && <Spinner />}
                {loadingMore ? "Loading" : "Load more"}
              </Button>
            </div>
          )}
        </Panel>
      )}
    </Page>
  );
}
