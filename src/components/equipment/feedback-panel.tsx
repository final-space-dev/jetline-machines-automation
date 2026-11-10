"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertOctagon, Send } from "lucide-react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Timeline, TimelineItem } from "@/components/ui/timeline";
import { Field } from "@/components/machines/field";
import { Muted, Panel, SectionHeading } from "@/components/machines/panel";
import { SURFACE, TYPE } from "@/lib/ui/ui-tokens";
import { cn } from "@/lib/ui/utils";

/**
 * Shared feedback surface for a single machine (equipment item or printer).
 * Renders:
 *   1. Replacement-request state and a "Request replacement" action (motivation and urgency).
 *   2. A comment input.
 *   3. ONE activity timeline: comments, field changes and request events
 *      interleaved chronologically (one story per record, /api/feedback/timeline).
 *
 * Used on the equipment item and printer pages. Xerox/BMS data stays
 * read-only elsewhere; this is where stores actually feed back.
 */

type EntityType = "equipment" | "printer";

interface TimelineEntry {
  kind: "comment" | "change" | "request";
  at: string;
  actor: string | null;
  text: string;
  detail?: string | null;
  meta?: { status?: string; response?: boolean };
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

type Status = "success" | "warning" | "danger" | "info" | "neutral";

export const URGENCY_STATUS: Record<string, Status> = { high: "danger", medium: "warning", low: "success" };
export const REQUEST_STATUS: Record<string, { label: string; status: Status }> = {
  open: { label: "Open", status: "warning" },
  reviewing: { label: "Reviewing", status: "info" },
  approved: { label: "Approved", status: "success" },
  declined: { label: "Declined", status: "neutral" },
};

const URGENCIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

function relDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

export function FeedbackPanel({ type, refId }: { type: EntityType; refId: string }) {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
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
      const [tRes, rRes] = await Promise.all([
        fetch(`/api/feedback/timeline${qs}`),
        fetch(`/api/feedback/replacement-requests${qs}`),
      ]);
      if (tRes.ok) { const d = await tRes.json(); setTimeline(Array.isArray(d.timeline) ? d.timeline : []); }
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
      // Reflect the new comment in the timeline immediately.
      setTimeline((prev) => [{ kind: "comment", at: data.comment.created_at, actor: data.comment.author_name, text: data.comment.body }, ...prev]);
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
      // Show the request event in the timeline too.
      setTimeline((prev) => [{ kind: "request", at: data.request.created_at, actor: data.request.requested_by_name, text: `Replacement requested (${data.request.urgency})`, detail: data.request.motivation, meta: { status: data.request.status } }, ...prev]);
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
    <Panel caption="Feedback and requests" bodyClassName="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      )}

      {/* Replacement request state */}
      <div className="flex flex-col gap-2.5">
        {openRequest ? (
          <RequestCard req={openRequest} />
        ) : showReqForm ? (
          <div className={cn(SURFACE.cardInset, "flex flex-col gap-3 p-3.5")}>
            <SectionHeading>Request a replacement</SectionHeading>
            <Field label="Reason" htmlFor={`req-reason-${refId}`}>
              <Textarea
                id={`req-reason-${refId}`}
                value={motivation}
                onChange={(e) => setMotivation(e.target.value)}
                placeholder="Why does this need replacing? (e.g. constant jams, out of contract, beyond economical repair)"
                rows={3}
              />
            </Field>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <Field label="Urgency">
                <Segmented value={urgency} onValueChange={(v) => setUrgency(v as "low" | "medium" | "high")} options={URGENCIES} />
              </Field>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setShowReqForm(false); setError(null); }} disabled={submittingReq}>Cancel</Button>
                <Button size="sm" onClick={submitRequest} disabled={submittingReq}>
                  {submittingReq && <Spinner />}
                  {submittingReq ? "Submitting" : "Submit request"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <Button variant="outline" onClick={() => setShowReqForm(true)}>
              <AlertOctagon /> Request replacement
            </Button>
          </div>
        )}

        {/* Prior resolved requests, if any */}
        {requests.filter((r) => r.status === "approved" || r.status === "declined").map((r) => (
          <RequestCard key={r.id} req={r} compact />
        ))}
      </div>

      {/* Comment feed */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a comment: what's happening with this machine?"
            aria-label="Comment"
            rows={2}
            className="flex-1"
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") postComment(); }}
          />
          <Button size="icon-lg" onClick={postComment} disabled={posting || !draft.trim()} aria-label="Post comment">
            {posting ? <Spinner /> : <Send />}
          </Button>
        </div>

        {loading ? (
          <Muted>Loading activity</Muted>
        ) : timeline.length === 0 ? (
          <Muted>No activity yet. Add a comment to log what&apos;s happening.</Muted>
        ) : (
          <Timeline>
            {timeline.map((t, i) => (
              <TimelineItem key={i} tone={t.kind === "request" ? "flag" : t.kind === "change" ? "system" : "action"} date={`${t.actor ?? "user"} · ${relDate(t.at)}`}>
                <span className={cn("whitespace-pre-wrap", t.kind !== "comment" && "font-semibold")}>{t.text}</span>
                {t.detail && <span className="block whitespace-pre-wrap text-muted-foreground">{t.detail}</span>}
              </TimelineItem>
            ))}
          </Timeline>
        )}
      </div>
    </Panel>
  );
}

function RequestCard({ req, compact }: { req: ReplacementRequest; compact?: boolean }) {
  const meta = REQUEST_STATUS[req.status] ?? REQUEST_STATUS.open;
  return (
    <div className={cn(compact ? SURFACE.card : SURFACE.cardInset, "flex flex-col gap-2 p-3")}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge status={meta.status}>{meta.label}</Badge>
        <Badge status={URGENCY_STATUS[req.urgency] ?? "neutral"} className="capitalize">{req.urgency}</Badge>
        <span className={cn(TYPE.micro, "ml-auto text-muted-foreground")}>
          {req.requested_by_name ?? "user"} · {relDate(req.created_at)}
        </span>
      </div>
      <p className={cn(TYPE.data, "whitespace-pre-wrap")}>{req.motivation}</p>
      {req.response_note && (
        <p className={cn(TYPE.data, "border-t border-border pt-2 text-muted-foreground")}>
          <strong className="text-foreground">Head office:</strong> {req.response_note}
          {req.responded_by && <span> ({req.responded_by})</span>}
        </p>
      )}
    </div>
  );
}
