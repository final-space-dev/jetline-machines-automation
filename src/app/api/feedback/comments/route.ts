import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { bmsPool } from "@/lib/bms-pool";
import { xeroxPool } from "@/lib/xerox-pool";
import { withClient, badRequest, serverError, ensureFeedbackTables } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { requireUser, AuthError, type SessionUser } from "@/lib/auth";

/**
 * Machine comment feed — an immutable, attributed, timestamped log shared by
 * equipment items and printers ("constant commentary" from stores).
 *
 * GET  /api/feedback/comments?type=equipment|printer&ref=<id|serial>
 * POST /api/feedback/comments   body: { type, ref, body }
 *
 * Comments cannot be edited or deleted — the point is a faithful history. Store
 * staff may only read/post on machines in their OWN store; the store is resolved
 * server-side (equipment.items.store or printer_store_map) and never trusted from
 * the client.
 */

type EntityType = "equipment" | "printer";

function parseType(v: string | null): EntityType | null {
  return v === "equipment" || v === "printer" ? v : null;
}

// Resolve which store a machine belongs to (for staff own-store scoping).
async function resolveStore(type: EntityType, ref: string): Promise<string | null> {
  if (type === "equipment") {
    return withClient(bmsPool, async (c: PoolClient) => {
      const r = await c.query(`SELECT store FROM equipment.items WHERE id = $1`, [ref]);
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

export async function GET(req: NextRequest) {
  let user: SessionUser;
  try { user = await requireUser(); }
  catch (e) { if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const url = new URL(req.url);
  const type = parseType(url.searchParams.get("type"));
  const ref = (url.searchParams.get("ref") ?? "").trim();
  if (!type || !ref) return badRequest("type (equipment|printer) and ref are required");

  const timer = routeTimer("GET /api/feedback/comments");
  return withClient(bmsPool, async (client) => {
    await ensureFeedbackTables(client);

    // Store staff may only view their own store's machine comments.
    if (user.role !== "admin") {
      const store = await resolveStore(type, ref);
      if (!store || store !== user.store) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const { rows } = await client.query(
      `SELECT id, body, author_name, store, created_at::text AS created_at
       FROM equipment.machine_comments
       WHERE entity_type = $1 AND entity_ref = $2
       ORDER BY created_at DESC`,
      [type, ref],
    );
    timer.done({ type, ref, count: rows.length });
    return NextResponse.json({ comments: rows });
  }).catch((err) => { timer.error(err); return serverError(err, "GET /api/feedback/comments"); });
}

export async function POST(req: NextRequest) {
  let user: SessionUser;
  try { user = await requireUser(); }
  catch (e) { if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const body = await req.json().catch(() => null);
  const type = parseType(body?.type);
  const ref = typeof body?.ref === "string" ? body.ref.trim() : "";
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (!type || !ref) return badRequest("type (equipment|printer) and ref are required");
  if (!text) return badRequest("comment body is required");
  if (text.length > 4000) return badRequest("comment is too long (max 4000 chars)");

  const timer = routeTimer("POST /api/feedback/comments");
  return withClient(bmsPool, async (client) => {
    await ensureFeedbackTables(client);

    const store = await resolveStore(type, ref);
    // Store staff may only comment on their own store's machines.
    if (user.role !== "admin" && (!store || store !== user.store)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Attribution comes ONLY from the session — never the request body.
    const authorName = user.name || user.email || "user";
    const { rows } = await client.query(
      `INSERT INTO equipment.machine_comments (entity_type, entity_ref, store, body, author_id, author_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, body, author_name, store, created_at::text AS created_at`,
      [type, ref, store, text, String(user.id), authorName],
    );
    timer.done({ type, ref, id: rows[0].id });
    return NextResponse.json({ comment: rows[0] }, { status: 201 });
  }).catch((err) => { timer.error(err); return serverError(err, "POST /api/feedback/comments"); });
}
