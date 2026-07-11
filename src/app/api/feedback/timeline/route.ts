import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { bmsPool } from "@/lib/bms-pool";
import { xeroxPool } from "@/lib/xerox-pool";
import { withClient, badRequest, serverError, ensureFeedbackTables } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { requireUser, AuthError, type SessionUser } from "@/lib/auth";

/**
 * Unified activity timeline for a single machine — one chronological story per
 * record instead of a comment feed + a separate change-history table. Merges:
 *   - comments          (equipment.machine_comments)
 *   - field changes     (equipment.change_log for equipment, printer_change_log for printers)
 *   - request events    (equipment.replacement_requests: raised / responded)
 *
 * GET /api/feedback/timeline?type=equipment|printer&ref=<id|serial>
 * Own-store scoped for staff (store resolved server-side).
 */

type EntityType = "equipment" | "printer";

interface TimelineItem {
  kind: "comment" | "change" | "request";
  at: string;
  actor: string | null;
  text: string;               // human-readable line
  detail?: string | null;     // secondary line (old→new, motivation, response)
  meta?: Record<string, unknown>;
}

function parseType(v: string | null): EntityType | null {
  return v === "equipment" || v === "printer" ? v : null;
}

async function resolveStore(type: EntityType, ref: string): Promise<string | null> {
  if (type === "equipment") {
    return withClient(bmsPool, async (c: PoolClient) => {
      const r = await c.query(`SELECT store FROM equipment.items WHERE id = $1 AND deleted_at IS NULL`, [ref]);
      return (r.rows[0]?.store as string | undefined) ?? null;
    });
  }
  return withClient(xeroxPool, async (c: PoolClient) => {
    const r = await c.query(
      `SELECT store FROM xerox.printer_store_map WHERE UPPER(TRIM(serial_number)) = $1 LIMIT 1`,
      [ref.toUpperCase().trim()],
    );
    return (r.rows[0]?.store as string | undefined) ?? null;
  });
}

/** Prettify a snake_case field name for display. */
function labelField(f: string): string {
  return f.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function GET(req: NextRequest) {
  let user: SessionUser;
  try { user = await requireUser(); }
  catch (e) { if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const url = new URL(req.url);
  const type = parseType(url.searchParams.get("type"));
  const ref = (url.searchParams.get("ref") ?? "").trim();
  if (!type || !ref) return badRequest("type (equipment|printer) and ref are required");

  const timer = routeTimer("GET /api/feedback/timeline");
  return withClient(bmsPool, async (client) => {
    await ensureFeedbackTables(client);

    // Own-store scoping for staff.
    if (user.role !== "admin") {
      const store = await resolveStore(type, ref);
      if (!store || store !== user.store) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const items: TimelineItem[] = [];

    // 1) Comments
    const comments = await client.query(
      `SELECT body, author_name, created_at::text AS at
       FROM equipment.machine_comments
       WHERE entity_type = $1 AND entity_ref = $2`,
      [type, ref],
    );
    for (const c of comments.rows) {
      items.push({ kind: "comment", at: c.at, actor: c.author_name, text: c.body });
    }

    // 2) Field changes — equipment.change_log (item_id) or equipment.printer_change_log (serial).
    try {
      if (type === "equipment") {
        const ch = await client.query(
          `SELECT field, old_value, new_value,
                  COALESCE(user_name, changed_by, 'user') AS actor, changed_at::text AS at
           FROM equipment.change_log WHERE item_id = $1`,
          [ref],
        );
        for (const r of ch.rows) {
          items.push({
            kind: "change",
            at: r.at,
            actor: r.actor,
            text: r.field === "created" ? "Item created" : `${labelField(r.field)} updated`,
            detail: r.field === "created" ? r.new_value : `${r.old_value ?? "—"} → ${r.new_value ?? "—"}`,
          });
        }
      } else {
        const ch = await client.query(
          `SELECT field, old_value, new_value, COALESCE(user_name, 'user') AS actor, changed_at::text AS at
           FROM equipment.printer_change_log WHERE UPPER(TRIM(serial)) = $1`,
          [ref.toUpperCase().trim()],
        );
        for (const r of ch.rows) {
          items.push({
            kind: "change",
            at: r.at,
            actor: r.actor,
            text: `${labelField(r.field)} updated`,
            detail: `${r.old_value ?? "—"} → ${r.new_value ?? "—"}`,
          });
        }
      }
    } catch {
      /* change log optional — never fail the timeline over it */
    }

    // 3) Replacement request events (raised + responded).
    const reqs = await client.query(
      `SELECT motivation, urgency, status, requested_by_name, response_note, responded_by,
              created_at::text AS created_at, responded_at::text AS responded_at
       FROM equipment.replacement_requests
       WHERE entity_type = $1 AND entity_ref = $2`,
      [type, ref],
    );
    for (const r of reqs.rows) {
      items.push({
        kind: "request",
        at: r.created_at,
        actor: r.requested_by_name,
        text: `Replacement requested (${r.urgency})`,
        detail: r.motivation,
        meta: { status: r.status },
      });
      if (r.responded_at && (r.response_note || r.status === "approved" || r.status === "declined")) {
        items.push({
          kind: "request",
          at: r.responded_at,
          actor: r.responded_by,
          text: `Replacement ${r.status}`,
          detail: r.response_note ?? null,
          meta: { status: r.status, response: true },
        });
      }
    }

    // Newest first.
    items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

    timer.done({ type, ref, count: items.length });
    return NextResponse.json({ timeline: items });
  }).catch((err) => { timer.error(err); return serverError(err, "GET /api/feedback/timeline"); });
}
