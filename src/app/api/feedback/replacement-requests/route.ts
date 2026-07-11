import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { bmsPool } from "@/lib/bms-pool";
import { xeroxPool } from "@/lib/xerox-pool";
import { withClient, badRequest, notFound, serverError, ensureFeedbackTables } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { requireUser, requireAdmin, AuthError, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Replacement requests — replaces the old replace_flag entirely. A store REQUESTS
 * a replacement (with a motivation + urgency) for a printer or equipment item;
 * admins triage via status and can add a response note. Head office monitors the
 * queue via the Replacement Requests report.
 *
 * GET    /api/feedback/replacement-requests
 *          admin: all requests (optional ?status= filter)
 *          staff: their own store's requests only
 *        ?type=&ref=  -> requests for one machine (both roles, own-store for staff)
 * POST   body { type, ref, motivation, urgency } -> create (any signed-in user, own store)
 * PATCH  body { id, status?, response_note? } -> triage (admin only)
 */

type EntityType = "equipment" | "printer";
const URGENCIES = new Set(["low", "medium", "high"]);
const STATUSES = new Set(["open", "reviewing", "approved", "declined"]);

function parseType(v: unknown): EntityType | null {
  return v === "equipment" || v === "printer" ? v : null;
}

async function resolveStoreAndLabel(type: EntityType, ref: string): Promise<{ store: string | null; label: string | null }> {
  if (type === "equipment") {
    return withClient(bmsPool, async (c: PoolClient) => {
      const r = await c.query(
        `SELECT store, machine_type, make_model FROM equipment.items WHERE id = $1`, [ref],
      );
      const row = r.rows[0];
      if (!row) return { store: null, label: null };
      const label = [row.machine_type, row.make_model].filter(Boolean).join(" · ") || `Item ${ref}`;
      return { store: row.store ?? null, label };
    });
  }
  return withClient(xeroxPool, async (c: PoolClient) => {
    const r = await c.query(
      `SELECT store, model_name FROM xerox.printer_store_map WHERE UPPER(TRIM(serial_number)) = $1 LIMIT 1`,
      [ref.toUpperCase().trim()],
    );
    const row = r.rows[0];
    const label = row?.model_name ? `${row.model_name} (${ref})` : `Printer ${ref}`;
    return { store: row?.store ?? null, label };
  });
}

const SELECT_COLS = `id, entity_type, entity_ref, store, item_label, motivation, urgency, status,
                     requested_by_name, response_note, responded_by,
                     responded_at::text AS responded_at, created_at::text AS created_at`;

export async function GET(req: NextRequest) {
  let user: SessionUser;
  try { user = await requireUser(); }
  catch (e) { if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const url = new URL(req.url);
  const type = parseType(url.searchParams.get("type"));
  const ref = (url.searchParams.get("ref") ?? "").trim();
  const statusFilter = url.searchParams.get("status");

  const timer = routeTimer("GET /api/feedback/replacement-requests");
  return withClient(bmsPool, async (client) => {
    await ensureFeedbackTables(client);

    const where: string[] = [];
    const params: unknown[] = [];
    // Per-machine view (both roles). Staff are additionally scoped to own store below.
    if (type && ref) { params.push(type); where.push(`entity_type = $${params.length}`); params.push(ref); where.push(`entity_ref = $${params.length}`); }
    // Staff only ever see their own store's requests.
    if (user.role !== "admin") { params.push(user.store ?? "__none__"); where.push(`store = $${params.length}`); }
    if (statusFilter && STATUSES.has(statusFilter)) { params.push(statusFilter); where.push(`status = $${params.length}`); }

    const sql = `SELECT ${SELECT_COLS} FROM equipment.replacement_requests
                 ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
                 ORDER BY
                   CASE status WHEN 'open' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END,
                   CASE urgency WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                   created_at DESC`;
    const { rows } = await client.query(sql, params);
    timer.done({ count: rows.length });
    return NextResponse.json({ requests: rows });
  }).catch((err) => { timer.error(err); return serverError(err, "GET /api/feedback/replacement-requests"); });
}

export async function POST(req: NextRequest) {
  let user: SessionUser;
  try { user = await requireUser(); }
  catch (e) { if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const body = await req.json().catch(() => null);
  const type = parseType(body?.type);
  const ref = typeof body?.ref === "string" ? body.ref.trim() : "";
  const motivation = typeof body?.motivation === "string" ? body.motivation.trim() : "";
  const urgency = URGENCIES.has(body?.urgency) ? body.urgency : "medium";
  if (!type || !ref) return badRequest("type (equipment|printer) and ref are required");
  if (!motivation) return badRequest("motivation is required");
  if (motivation.length > 4000) return badRequest("motivation is too long (max 4000 chars)");

  const timer = routeTimer("POST /api/feedback/replacement-requests");
  return withClient(bmsPool, async (client) => {
    await ensureFeedbackTables(client);

    const { store, label } = await resolveStoreAndLabel(type, ref);
    if (user.role !== "admin" && (!store || store !== user.store)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Guard against duplicate open requests for the same machine.
    const dupe = await client.query(
      `SELECT id FROM equipment.replacement_requests
       WHERE entity_type = $1 AND entity_ref = $2 AND status IN ('open','reviewing') LIMIT 1`,
      [type, ref],
    );
    if (dupe.rows.length > 0) {
      return NextResponse.json({ error: "There is already an open replacement request for this item." }, { status: 409 });
    }

    const requestedByName = user.name || user.email || "user";
    const { rows } = await client.query(
      `INSERT INTO equipment.replacement_requests
         (entity_type, entity_ref, store, item_label, motivation, urgency, requested_by_id, requested_by_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING ${SELECT_COLS}`,
      [type, ref, store, label, motivation, urgency, String(user.id), requestedByName],
    );

    // Notify admins (store = null → admin audience in the bell). Best-effort:
    // a notification failure must never fail the request itself.
    try {
      await prisma.notification.create({
        data: {
          type: "replacement_requested",
          message: `Replacement requested: ${label ?? ref}${store ? ` @ ${store}` : ""} (${urgency})`,
          store: null,
          itemId: type === "equipment" ? Number(ref) || null : null,
          serial: type === "printer" ? ref : null,
        },
      });
    } catch (e) {
      console.error("[replacement_requests] notification insert failed", e);
    }

    timer.done({ type, ref, id: rows[0].id });
    return NextResponse.json({ request: rows[0] }, { status: 201 });
  }).catch((err) => { timer.error(err); return serverError(err, "POST /api/feedback/replacement-requests"); });
}

export async function PATCH(req: NextRequest) {
  // Only admins triage requests.
  let admin: SessionUser;
  try { admin = await requireAdmin(); }
  catch (e) { if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const body = await req.json().catch(() => null);
  const id = body?.id;
  if (!Number.isInteger(id) || id <= 0) return badRequest("valid id is required");

  const sets: string[] = [];
  const params: unknown[] = [];
  let statusChanged = false;
  if (typeof body?.status === "string") {
    if (!STATUSES.has(body.status)) return badRequest("invalid status");
    params.push(body.status); sets.push(`status = $${params.length}`);
    statusChanged = true;
  }
  if (typeof body?.response_note === "string") {
    params.push(body.response_note.trim() || null); sets.push(`response_note = $${params.length}`);
  }
  if (sets.length === 0) return badRequest("nothing to update (status or response_note)");

  // Stamp responder when a status decision or note is recorded.
  params.push(admin.name || admin.email || "admin"); sets.push(`responded_by = $${params.length}`);
  if (statusChanged) sets.push(`responded_at = NOW()`);
  sets.push(`updated_at = NOW()`);
  params.push(id);

  const timer = routeTimer("PATCH /api/feedback/replacement-requests");
  return withClient(bmsPool, async (client) => {
    await ensureFeedbackTables(client);
    const { rows } = await client.query(
      `UPDATE equipment.replacement_requests SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING ${SELECT_COLS}`,
      params,
    );
    if (rows.length === 0) return notFound();
    timer.done({ id });
    return NextResponse.json({ request: rows[0] });
  }).catch((err) => { timer.error(err); return serverError(err, "PATCH /api/feedback/replacement-requests"); });
}
