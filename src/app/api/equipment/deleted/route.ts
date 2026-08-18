import { NextRequest, NextResponse } from "next/server";
import { bmsPool } from "@/lib/bms-pool";
import { withClient, badRequest, notFound, serverError, ensureItemColumns } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { requireCapability, AuthError } from "@/lib/auth";

/**
 * Recently-deleted equipment recovery (admin-only). Soft-deleted items keep a
 * `deleted_at` stamp; this lists them (most-recently-deleted first, last 90 days)
 * and restores one (clears deleted_at). Completes the soft-delete feature so a
 * mistaken delete has a self-service undo instead of a manual SQL fix.
 *
 * GET  /api/equipment/deleted           -> { items: [...] }
 * POST /api/equipment/deleted           body { id } -> restore that item
 */

export async function GET() {
  try { await requireCapability("config:recently-deleted"); }
  catch (e) { if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const timer = routeTimer("GET /api/equipment/deleted");
  return withClient(bmsPool, async (client) => {
    await ensureItemColumns(client);
    const { rows } = await client.query(
      `SELECT id, store, machine_type, make_model, serial, condition,
              deleted_at::text AS deleted_at
       FROM equipment.items
       WHERE deleted_at IS NOT NULL
         AND deleted_at > NOW() - INTERVAL '90 days'
       ORDER BY deleted_at DESC
       LIMIT 200`,
    );
    timer.done({ count: rows.length });
    return NextResponse.json({ items: rows });
  }).catch((err) => { timer.error(err); return serverError(err, "GET /api/equipment/deleted"); });
}

export async function POST(req: NextRequest) {
  try { await requireCapability("config:recently-deleted"); }
  catch (e) { if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const body = await req.json().catch(() => null);
  const id = body?.id;
  if (!Number.isInteger(id) || id <= 0) return badRequest("valid id is required");

  const timer = routeTimer("POST /api/equipment/deleted (restore)");
  return withClient(bmsPool, async (client) => {
    await ensureItemColumns(client);
    const { rowCount } = await client.query(
      `UPDATE equipment.items SET deleted_at = NULL, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NOT NULL`,
      [id],
    );
    if (rowCount === 0) return notFound();
    timer.done({ id });
    return NextResponse.json({ ok: true });
  }).catch((err) => { timer.error(err); return serverError(err, "POST /api/equipment/deleted"); });
}
