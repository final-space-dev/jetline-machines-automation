"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquare, Send, AlertOctagon, Clock, CheckCircle2, XCircle } from "lucide-react";

/**
 * Shared feedback surface for a single machine (equipment item or printer).
 * Renders two things, both driven by /api/feedback/*:
 *   1. A running, immutable, attributed comment feed ("constant commentary").
 *   2. Replacement requests — status + motivation. If none is open, a store can
 *      raise one (motivation + urgency); admins triage from the report.
 *
 * Used on the equipment item page and the printer page. Xerox/BMS data stays
 * read-only elsewhere; this is where stores actually feed back.
 */

type EntityType = "equipment" | "printer";

interface Comment {
  id: number;
  body: string;
  author_name: string | null;
  store: string | null;
  created_at: string;
}

interface ReplacementRequest {
  id: number;
  motivation: string;
  urgency: "low" | "medium" | "high";
  status: "open" | "reviewing" | "approved" | "declined";
  requested_by_name: string | null;
  response_note: string | null;
  responded_by: string | null;
  responded_at: string | null;
  created_at: string;
}

const URGENCY_BADGE: Record<string, string> = { high: "jl-badge--red", medium: "jl-badge--amber", low: "jl-badge--green" };
const STATUS_META: Record<string, { label: string; badge: string; icon: typeof Clock }> = {
  open: { label: "Open", badge: "jl-badge--amber", icon: AlertOctagon },
  reviewing: { label: "Reviewing", badge: "jl-badge--blue", icon: Clock },
  approved: { label: "Approved", badge: "jl-badge--green", icon: CheckCircle2 },
  declined: { label: "Declined", badge: "", icon: XCircle },
};

function relDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

export function FeedbackPanel({ type, refId }: { type: EntityType; refId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [requests, setRequests] = useState<ReplacementRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Replacement request form
  const [showReqForm, setShowReqForm] = useState(false);
  const [motivation, setMotivation] = useState("");
  const [urgency, setUrgency] = useState<"low" | "medium" | "high">("medium");
  const [submittingReq, setSubmittingReq] = useState(false);

  const qs = `?type=${type}&ref=${encodeURIComponent(refId)}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, rRes] = await Promise.all([
        fetch(`/api/feedback/comments${qs}`),
        fetch(`/api/feedback/replacement-requests${qs}`),
      ]);
      if (cRes.ok) { const d = await cRes.json(); setComments(Array.isArray(d.comments) ? d.comments : []); }
      if (rRes.ok) { const d = await rRes.json(); setRequests(Array.isArray(d.requests) ? d.requests : []); }
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => { load(); }, [load]);

  const postComment = useCallback(async () => {
    const text = draft.trim();
    if (!text) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, ref: refId, body: text }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Couldn't post comment"); return; }
      setComments((prev) => [data.comment, ...prev]);
      setDraft("");
    } catch {
      setError("Couldn't post comment");
    } finally {
      setPosting(false);
    }
  }, [draft, type, refId]);

  const submitRequest = useCallback(async () => {
    const m = motivation.trim();
    if (!m) { setError("Please give a reason for the replacement."); return; }
    setSubmittingReq(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback/replacement-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, ref: refId, motivation: m, urgency }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Couldn't submit request"); return; }
      setRequests((prev) => [data.request, ...prev]);
      setShowReqForm(false);
      setMotivation("");
      setUrgency("medium");
    } catch {
      setError("Couldn't submit request");
    } finally {
      setSubmittingReq(false);
    }
  }, [motivation, urgency, type, refId]);

  const openRequest = requests.find((r) => r.status === "open" || r.status === "reviewing");

  return (
    <section className="jl-card" style={{ display: "flex", flexDirection: "column", gap: 16, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <MessageSquare size={18} style={{ color: "var(--red-500)" }} />
        <h3 className="jl-h3" style={{ color: "var(--ink-900)", margin: 0 }}>Feedback &amp; Requests</h3>
      </div>

      {error && <div className="jl-alert jl-alert--red" role="alert"><div className="jl-alert__body"><div className="jl-alert__text">{error}</div></div></div>}

      {/* ── Replacement request state ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {openRequest ? (
          <RequestCard req={openRequest} />
        ) : showReqForm ? (
          <div className="jl-card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12, background: "var(--surface-sunken)" }}>
            <span style={{ fontWeight: 800, fontSize: 13, color: "var(--ink-800)" }}>Request a replacement</span>
            <textarea
              className="jl-textarea"
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
              placeholder="Why does this need replacing? (e.g. constant jams, out of contract, beyond economical repair)"
              style={{ minHeight: 72 }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-500)" }}>Urgency</span>
                <div className="jl-segment" role="tablist">
                  {(["low", "medium", "high"] as const).map((u) => (
                    <button key={u} type="button" role="tab" aria-selected={urgency === u}
                      className="jl-touch-toggle" onClick={() => setUrgency(u)} style={{ textTransform: "capitalize" }}>
                      {u}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="jl-btn jl-btn--ghost jl-btn--sm" onClick={() => { setShowReqForm(false); setError(null); }} disabled={submittingReq}>Cancel</button>
                <button type="button" className="jl-btn jl-btn--primary jl-btn--sm" onClick={submitRequest} disabled={submittingReq}>
                  {submittingReq ? "Submitting…" : "Submit request"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button type="button" className="jl-btn jl-btn--soft" style={{ alignSelf: "flex-start" }} onClick={() => setShowReqForm(true)}>
            <AlertOctagon size={15} /> Request replacement
          </button>
        )}

        {/* Prior resolved requests, if any */}
        {requests.filter((r) => r.status === "approved" || r.status === "declined").map((r) => (
          <RequestCard key={r.id} req={r} compact />
        ))}
      </div>

      {/* ── Comment feed ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <textarea
            className="jl-textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a comment… (what's happening with this machine?)"
            style={{ minHeight: 56, flex: 1 }}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") postComment(); }}
          />
          <button type="button" className="jl-btn jl-btn--primary jl-btn--icon" onClick={postComment} disabled={posting || !draft.trim()} aria-label="Post comment" style={{ height: 44, width: 44 }}>
            <Send size={16} />
          </button>
        </div>

        {loading ? (
          <p className="jl-sm jl-muted">Loading feedback…</p>
        ) : comments.length === 0 ? (
          <p className="jl-sm jl-muted">No comments yet. Be the first to log what&apos;s happening.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {comments.map((c) => (
              <li key={c.id} style={{ borderLeft: "2px solid var(--ink-100)", paddingLeft: 12 }}>
                <div style={{ whiteSpace: "pre-wrap", fontSize: 13, color: "var(--ink-800)", lineHeight: 1.5 }}>{c.body}</div>
                <div style={{ fontSize: 11, color: "var(--ink-400)", marginTop: 3 }}>
                  {c.author_name ?? "user"} · {relDate(c.created_at)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function RequestCard({ req, compact }: { req: ReplacementRequest; compact?: boolean }) {
  const meta = STATUS_META[req.status] ?? STATUS_META.open;
  const Icon = meta.icon;
  return (
    <div className="jl-card" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8, background: compact ? "transparent" : "var(--surface-sunken)", opacity: compact ? 0.85 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Icon size={15} style={{ color: "var(--ink-500)" }} />
        <span className={`jl-badge ${meta.badge}`}>{meta.label}</span>
        <span className={`jl-badge ${URGENCY_BADGE[req.urgency] ?? ""}`} style={{ textTransform: "capitalize" }}>{req.urgency}</span>
        <span style={{ fontSize: 11, color: "var(--ink-400)", marginLeft: "auto" }}>
          {req.requested_by_name ?? "user"} · {relDate(req.created_at)}
        </span>
      </div>
      <div style={{ fontSize: 13, color: "var(--ink-800)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{req.motivation}</div>
      {req.response_note && (
        <div style={{ fontSize: 12, color: "var(--ink-600)", borderTop: "1px solid var(--ink-100)", paddingTop: 6 }}>
          <strong>Head office:</strong> {req.response_note}
          {req.responded_by && <span style={{ color: "var(--ink-400)" }}> — {req.responded_by}</span>}
        </div>
      )}
    </div>
  );
}
