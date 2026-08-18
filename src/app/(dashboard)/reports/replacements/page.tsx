"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { useAdminGuard } from "@/lib/use-admin-guard";
import { AlertOctagon, Clock, CheckCircle2, XCircle, ExternalLink } from "lucide-react";

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

const STATUS_META: Record<string, { label: string; badge: string; icon: typeof Clock }> = {
  open: { label: "Open", badge: "jl-badge--amber", icon: AlertOctagon },
  reviewing: { label: "Reviewing", badge: "jl-badge--blue", icon: Clock },
  approved: { label: "Approved", badge: "jl-badge--green", icon: CheckCircle2 },
  declined: { label: "Declined", badge: "", icon: XCircle },
};
const URGENCY_BADGE: Record<string, string> = { high: "jl-badge--red", medium: "jl-badge--amber", low: "jl-badge--green" };
const FILTERS = ["all", "overdue", "open", "reviewing", "approved", "declined"] as const;
type Filter = (typeof FILTERS)[number];

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
  const [filter, setFilter] = useState<Filter>("open");
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
    return <AppShell><div style={{ display: "grid", placeItems: "center", height: 160 }}><div className="jl-spinner jl-spinner--lg" /></div></AppShell>;
  }

  return (
    <AppShell>
      <div className="space-y-4" style={{ maxWidth: 1280, marginInline: "auto", width: "100%", padding: "16px 32px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <AlertOctagon size={22} style={{ color: "var(--red-500)" }} />
          <h1 className="jl-h1" style={{ margin: 0 }}>Replacement Requests</h1>
        </div>
        <p className="jl-sm jl-muted">Requests raised by stores for printers and equipment. Review, then approve or decline with a note back to the store.</p>

        {/* Status filter */}
        <div className="jl-tabs" role="tablist">
          {FILTERS.map((f) => (
            <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} style={{ textTransform: "capitalize" }}>
              {f}{counts[f] ? ` (${counts[f]})` : ""}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="jl-sm jl-muted">Loading requests…</p>
        ) : visible.length === 0 ? (
          <div className="jl-card jl-card--pad-lg" style={{ textAlign: "center" }}>
            <span className="jl-sm jl-muted">{filter === "open" ? "No open requests. All caught up." : "No requests in this view."}</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {visible.map((r) => {
              const meta = STATUS_META[r.status] ?? STATUS_META.open;
              const Icon = meta.icon;
              const isOpen = r.status === "open" || r.status === "reviewing";
              return (
                <div key={r.id} className="jl-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Icon size={16} style={{ color: "var(--ink-500)" }} />
                    <span className={`jl-badge ${meta.badge}`}>{meta.label}</span>
                    <span className={`jl-badge ${URGENCY_BADGE[r.urgency] ?? ""}`} style={{ textTransform: "capitalize" }}>{r.urgency}</span>
                    <span className="jl-badge">{r.entity_type === "printer" ? "Printer" : "Equipment"}</span>
                    {isOverdue(r) && <span className="jl-badge jl-badge--red">Overdue · {ageDays(r.created_at)}d</span>}
                    <Link href={machineHref(r)} className="cell-strong" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      {r.item_label ?? r.entity_ref} <ExternalLink size={13} />
                    </Link>
                    <span style={{ fontSize: 12, color: "var(--ink-500)", marginLeft: "auto" }}>
                      {r.assigned_to_name && <span style={{ color: "var(--ink-700)", fontWeight: 600 }}>{r.assigned_to_name} · </span>}
                      {r.store ?? "—"} · {r.requested_by_name ?? "user"} · {fmt(r.created_at)}
                    </span>
                  </div>

                  <div style={{ fontSize: 13, color: "var(--ink-800)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{r.motivation}</div>

                  {r.response_note && (
                    <div style={{ fontSize: 12, color: "var(--ink-600)", borderTop: "1px solid var(--ink-100)", paddingTop: 8 }}>
                      <strong>Response:</strong> {r.response_note}
                      {r.responded_by && <span style={{ color: "var(--ink-400)" }}> — {r.responded_by}{r.responded_at ? ` · ${fmt(r.responded_at)}` : ""}</span>}
                    </div>
                  )}

                  {/* Triage controls (open/reviewing only) */}
                  {isOpen && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--ink-100)", paddingTop: 12 }}>
                      <textarea
                        className="jl-textarea"
                        placeholder="Response to the store (optional but recommended)…"
                        value={noteDraft[r.id] ?? r.response_note ?? ""}
                        onChange={(e) => setNoteDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                        style={{ minHeight: 56 }}
                      />
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        {r.assigned_to_name ? (
                          <button type="button" className="jl-btn jl-btn--ghost jl-btn--sm" disabled={busyId === r.id}
                            onClick={() => patch(r.id, { assign: "" })} title="Release this request">
                            Unassign
                          </button>
                        ) : (
                          <button type="button" className="jl-btn jl-btn--soft jl-btn--sm" disabled={busyId === r.id}
                            onClick={() => patch(r.id, { assign: "me" })}>
                            Assign to me
                          </button>
                        )}
                        {r.status === "open" && (
                          <button type="button" className="jl-btn jl-btn--soft jl-btn--sm" disabled={busyId === r.id}
                            onClick={() => patch(r.id, { status: "reviewing", response_note: noteDraft[r.id] })}>
                            Mark reviewing
                          </button>
                        )}
                        <button type="button" className="jl-btn jl-btn--primary jl-btn--sm" disabled={busyId === r.id}
                          onClick={() => patch(r.id, { status: "approved", response_note: noteDraft[r.id] })}>
                          Approve
                        </button>
                        <button type="button" className="jl-btn jl-btn--ghost jl-btn--sm" disabled={busyId === r.id}
                          onClick={() => patch(r.id, { status: "declined", response_note: noteDraft[r.id] })}>
                          Decline
                        </button>
                        {busyId === r.id && <span className="jl-spinner jl-spinner--sm" />}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
