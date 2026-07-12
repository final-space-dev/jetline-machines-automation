"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertOctagon, Clock, UserX, ArrowRight } from "lucide-react";

/**
 * "Needs your attention" strip for the head-office dashboard — the response side
 * of the store feedback loop, summarised. Shows open / overdue / unassigned
 * replacement requests at a glance and links into the triage report. Admin-only
 * data (the requests API scopes it); renders nothing if there's nothing open.
 */

interface Req {
  status: "open" | "reviewing" | "approved" | "declined";
  assigned_to_name: string | null;
  created_at: string;
}

const SLA_DAYS = 7;
function overdue(r: Req): boolean {
  if (r.status !== "open" && r.status !== "reviewing") return false;
  const d = new Date(r.created_at).getTime();
  return !Number.isNaN(d) && (Date.now() - d) / 86_400_000 > SLA_DAYS;
}

export function RequestsAttention() {
  const [reqs, setReqs] = useState<Req[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/feedback/replacement-requests")
      .then((r) => (r.ok ? r.json() : { requests: [] }))
      .then((d) => { if (alive) setReqs(Array.isArray(d.requests) ? d.requests : []); })
      .catch(() => { if (alive) setReqs([]); });
    return () => { alive = false; };
  }, []);

  if (reqs === null) return null; // loading — stay quiet
  const active = reqs.filter((r) => r.status === "open" || r.status === "reviewing");
  if (active.length === 0) return null; // nothing needs attention → no noise

  const openCount = reqs.filter((r) => r.status === "open").length;
  const overdueCount = active.filter(overdue).length;
  const unassignedCount = active.filter((r) => !r.assigned_to_name).length;

  const tiles: { icon: typeof Clock; label: string; value: number; tone: string }[] = [
    { icon: AlertOctagon, label: "Open requests", value: openCount, tone: "var(--amber-600)" },
    { icon: Clock, label: "Overdue", value: overdueCount, tone: "var(--red-600)" },
    { icon: UserX, label: "Unassigned", value: unassignedCount, tone: "var(--ink-600)" },
  ];

  return (
    <Link
      href="/reports/replacements"
      className="jl-card"
      style={{
        display: "flex", alignItems: "center", gap: 20, padding: "14px 18px",
        textDecoration: "none", border: overdueCount > 0 ? "1px solid var(--red-tint)" : undefined,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 800, color: "var(--ink-900)", whiteSpace: "nowrap" }}>
        Needs your attention
      </span>
      <div style={{ display: "flex", gap: 22, flexWrap: "wrap", flex: 1 }}>
        {tiles.map((t) => (
          <span key={t.label} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <t.icon size={16} style={{ color: t.tone }} />
            <span style={{ fontSize: 18, fontWeight: 800, color: t.value > 0 ? t.tone : "var(--ink-400)", fontVariantNumeric: "tabular-nums" }}>{t.value}</span>
            <span style={{ fontSize: 12, color: "var(--ink-500)" }}>{t.label}</span>
          </span>
        ))}
      </div>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: "var(--red-500)", whiteSpace: "nowrap" }}>
        Review <ArrowRight size={14} />
      </span>
    </Link>
  );
}
