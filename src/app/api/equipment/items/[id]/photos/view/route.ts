import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { bmsPool } from "@/lib/bms-pool";
import { withClient, notFound, badRequest, serverError } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { requireUser, AuthError, type SessionUser } from "@/lib/auth";

/**
 * Authenticated image proxy for PRIVATE equipment photos. The Blob store is
 * private, so photos are never publicly reachable — this route streams a photo
 * to a signed-in, own-store user only. The client references photos by index
 * (`?i=`); it never sees the private blob URL.
 *
 * GET /api/equipment/items/[id]/photos/view?i=<index>
 */
function validId(id: string): boolean {
  return /^\d+$/.test(id) && parseInt(id) > 0;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!validId(id)) return notFound();

  let user: SessionUser;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const raw = req.nextUrl.searchParams.get("i");
  const index = raw !== null && /^\d+$/.test(raw) ? parseInt(raw, 10) : -1;
  if (index < 0) return badRequest("Missing or invalid index");

  const timer = routeTimer(`GET /api/equipment/items/${id}/photos/view`);
  try {
    const targetUrl = await withClient(bmsPool, async (client) => {
      const r = await client.query(`SELECT store, photos FROM equipment.items WHERE id = $1`, [id]);
      if (r.rows.length === 0) return null;
      // Own-store scoping for staff.
      if (user.role !== "admin" && r.rows[0].store !== user.store) return "FORBIDDEN";
      const photos: string[] = r.rows[0].photos ?? [];
      return photos[index] ?? null;
    });

    if (targetUrl === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!targetUrl) return notFound();

    // Read the private blob back (returns a stream + metadata).
    const result = await get(targetUrl, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) return notFound();

    timer.done({ id, index });
    return new NextResponse(result.stream, {
      status: 200,
      headers: {
        "Content-Type": result.blob.contentType || "application/octet-stream",
        // Private image; allow the browser to cache it briefly for this session.
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    timer.error(err);
    return serverError(err, `GET /api/equipment/items/${id}/photos/view`);
  }
}
