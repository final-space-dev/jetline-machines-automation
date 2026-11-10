"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { REQUEST_STATUS, URGENCY_STATUS } from "@/components/equipment/feedback-panel";
import { Empty } from "@/components/machines/empty";
import { Loading } from "@/components/machines/loading";
import { Page } from "@/components/machines/page";
import { TextLink } from "@/components/machines/text-link";
import { SURFACE, TYPE } from "@/lib/ui/ui-tokens";
import { cn } from "@/lib/ui/utils";
import { useAdminGuard } from "@/lib/use-admin-guard";

/**
 * Replacement Requests report (admin, under Reports). Head office monitors every
 * store's replacement requests here and responds — the response side of the
 * store feedback loop. Reads/triages /api/feedback/replacement-requests.
 */

interface Req {
  id: number;
  entity_type: "equipment" | "printer";
  entity_ref: string;
  store: string | null;
  item_label: string | null;
  motivation: string;
  urgency: "low" | "medium" | "high";
  status: "open" | "reviewing" | "approved" | "declined";
  requested_by_name: string | null;
  assigned_to_name: string | null;
  response_note: string | null;
  responded_by: string | null;
  responded_at: string | null;
  created_at: string;
}

// SLA: an open/reviewing request older than this many days is overdue.
const SLA_DAYS = 7;
function ageDays(iso: string): number {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return 0;
  return Math.floor((Date.now() - d) / 86_400_000);
}
function isOverdue(r: Req): boolean {
  return (r.status === "open" || r.status === "reviewing") && ageDays(r.created_at) > SLA_DAYS;
}

const FILTERS = ["all", "overdue", "open", "reviewing", "approved", "declined"] as const;

function machineHref(r: Req): string {
  return r.entity_type === "printer"
    ? `/equipment/printers/${encodeURIComponent(r.entity_ref)}`
    : `/equipment/items/${encodeURIComponent(r.entity_ref)}`;
}

function fmt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

export default function ReplacementRequestsPage() {
  const { allowed, loading: guardLoading } = useAdminGuard("nav:replacements");
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("open");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    try {
      const res = await fetch("/api/feedback/replacement-requests");
      if (res.ok) { const d = await res.json(); setRows(Array.isArray(d.requests) ? d.requests : []); }
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, [allowed]);

  useEffect(() => { load(); }, [load]);

  const patch = useCallback(async (id: number, body: Record<string, unknown>) => {
    setBusyId(id);
    try {
      const res = await fetch("/api/feedback/replacement-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      if (res.ok) { const d = await res.json(); setRows((prev) => prev.map((r) => (r.id === id ? d.request : r))); }
    } finally {
      setBusyId(null);
    }
  }, []);

  const visible = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "overdue") return rows.filter(isOverdue);
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length, overdue: 0, open: 0, reviewing: 0, approved: 0, declined: 0 };
    for (const r of rows) {
      c[r.status] = (c[r.status] ?? 0) + 1;
      if (isOverdue(r)) c.overdue += 1;
    }
    return c;
  }, [rows]);

  if (guardLoading || !allowed) {
    return (
      <Page title="Replacement Requests">
        <Loading />
      </Page>
    );
  }

  return (
    <Page title="Replacement Requests">
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          {FILTERS.map((f) => (
            <TabsTrigger key={f} value={f} className="capitalize">
              {f}{counts[f] ? ` (${counts[f]})` : ""}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading ? (
        <Loading label="Loading requests" />
      ) : visible.length === 0 ? (
        <Empty title={filter === "open" ? "No open requests. All caught up." : "No requests in this view"} />
      ) : (
        <div className="flex w-full max-w-5xl flex-col gap-3">
          {visible.map((r) => {
            const meta = REQUEST_STATUS[r.status] ?? REQUEST_STATUS.open;
            const isOpen = r.status === "open" || r.status === "reviewing";
            return (
              <article key={r.id} className={cn(SURFACE.card, "flex flex-col gap-3 p-4")}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge status={meta.status}>{meta.label}</Badge>
                  <Badge status={URGENCY_STATUS[r.urgency] ?? "neutral"} className="capitalize">{r.urgency}</Badge>
                  <Badge variant="secondary">{r.entity_type === "printer" ? "Printer" : "Equipment"}</Badge>
                  {isOverdue(r) && <Badge status="danger">Overdue · {ageDays(r.created_at)}d</Badge>}
                  <TextLink href={machineHref(r)} className={cn(TYPE.data, "inline-flex items-center gap-1")}>
                    {r.item_label ?? r.entity_ref} <ExternalLink className="size-3.5" />
                  </TextLink>
                  <span className={cn(TYPE.micro, "text-muted-foreground sm:ml-auto")}>
                    {r.assigned_to_name && <span className="font-semibold text-foreground">{r.assigned_to_name} · </span>}
                    {r.store ?? "—"} · {r.requested_by_name ?? "user"} · {fmt(r.created_at)}
                  </span>
                </div>

                <p className={cn(TYPE.data, "whitespace-pre-wrap")}>{r.motivation}</p>

                {r.response_note && (
                  <p className={cn(TYPE.data, "border-t border-border pt-2 text-muted-foreground")}>
                    <strong className="text-foreground">Response:</strong> {r.response_note}
                    {r.responded_by && <span> ({r.responded_by}{r.responded_at ? ` · ${fmt(r.responded_at)}` : ""})</span>}
                  </p>
                )}

                {/* Triage controls: open and reviewing only. */}
                {isOpen && (
                  <div className="flex flex-col gap-2.5 border-t border-border pt-3">
                    <Textarea
                      aria-label="Response to the store"
                      placeholder="Response to the store (optional but recommended)"
                      value={noteDraft[r.id] ?? r.response_note ?? ""}
                      onChange={(e) => setNoteDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                      rows={2}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      {r.assigned_to_name ? (
                        <Button variant="ghost" size="sm" disabled={busyId === r.id} onClick={() => patch(r.id, { assign: "" })} title="Release this request">
                          Unassign
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" disabled={busyId === r.id} onClick={() => patch(r.id, { assign: "me" })}>
                          Assign to me
                        </Button>
                      )}
                      {r.status === "open" && (
                        <Button variant="outline" size="sm" disabled={busyId === r.id} onClick={() => patch(r.id, { status: "reviewing", response_note: noteDraft[r.id] })}>
                          Mark reviewing
                        </Button>
                      )}
                      <Button size="sm" disabled={busyId === r.id} onClick={() => patch(r.id, { status: "approved", response_note: noteDraft[r.id] })}>
                        Approve
                      </Button>
                      <Button variant="ghost" size="sm" disabled={busyId === r.id} onClick={() => patch(r.id, { status: "declined", response_note: noteDraft[r.id] })}>
                        Decline
                      </Button>
                      {busyId === r.id && <Spinner />}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </Page>
  );
}
