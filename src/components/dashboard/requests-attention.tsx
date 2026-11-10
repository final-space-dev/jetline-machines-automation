"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Muted } from "@/components/machines/panel";
import { SURFACE, TYPE } from "@/lib/ui/ui-tokens";
import { cn } from "@/lib/ui/utils";

/**
 * "Needs your attention" strip for the head-office dashboard: the response side
 * of the store feedback loop, summarised. Shows open, overdue and unassigned
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

  if (reqs === null) return null; // loading: stay quiet
  const active = reqs.filter((r) => r.status === "open" || r.status === "reviewing");
  if (active.length === 0) return null; // nothing needs attention: no noise

  const openCount = reqs.filter((r) => r.status === "open").length;
  const overdueCount = active.filter(overdue).length;
  const unassignedCount = active.filter((r) => !r.assigned_to_name).length;

  const figures: { label: string; value: number; alarm?: boolean }[] = [
    { label: "Open requests", value: openCount },
    { label: "Overdue", value: overdueCount, alarm: true },
    { label: "Unassigned", value: unassignedCount },
  ];

  return (
    <Link
      href="/reports/replacements"
      className={cn(SURFACE.cardRaised, "flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 outline-none hover:bg-muted focus-visible:bg-muted")}
    >
      <span className={TYPE.section}>Needs your attention</span>
      <span className="flex flex-1 flex-wrap gap-x-6 gap-y-1">
        {figures.map((f) => (
          <span key={f.label} className="inline-flex items-baseline gap-1.5">
            <span className={cn(TYPE.section, "tabular-nums", f.value === 0 ? "text-muted-foreground" : f.alarm && "text-deficit")}>{f.value}</span>
            <Muted>{f.label}</Muted>
          </span>
        ))}
      </span>
      <span className={cn(TYPE.data, "inline-flex items-center gap-1 font-medium text-primary")}>
        Review <ArrowRight className="size-3.5" />
      </span>
    </Link>
  );
}
