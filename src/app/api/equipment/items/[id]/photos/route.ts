import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { put, del } from "@vercel/blob";
import { bmsPool } from "@/lib/bms-pool";
import { withClient, notFound, badRequest, serverError } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { requireUser, AuthError, type SessionUser } from "@/lib/auth";

function validId(id: string): boolean {
  return /^\d+$/.test(id) && parseInt(id) > 0;
}

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"]);
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/heic": ".heic",
};
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB per file

// POST — multipart form-data with one or more "files". Uploads to Vercel Blob
// with PRIVATE access (the store is private), storing each blob's URL in
// equipment.items.photos (TEXT[]). Private blobs aren't publicly reachable — they
// are served only to authenticated, own-store users via the proxy GET below.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!validId(id)) return notFound();

  let user: SessionUser;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const timer = routeTimer(`POST /api/equipment/items/${id}/photos`);

  const form = await req.formData().catch(() => null);
  if (!form) return badRequest("Expected multipart form-data");

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return badRequest("No files provided");

  return withClient(bmsPool, async (client) => {
    const exists = await client.query(`SELECT id, store FROM equipment.items WHERE id = $1`, [id]);
    if (exists.rows.length === 0) return notFound();
    if (user.role !== "admin" && exists.rows[0].store !== user.store) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const newUrls: string[] = [];
    for (const file of files) {
      if (!ALLOWED_MIME.has(file.type)) continue;
      if (file.size === 0 || file.size > MAX_BYTES) continue;
      const ext = EXT_BY_MIME[file.type] ?? ".bin";
      const key = `equipment/${id}/${randomUUID()}${ext}`;
      // Private store — the URL is only usable with the store token, which the
      // proxy route holds. It is never served directly to the browser.
      const blob = await put(key, file, { access: "private", contentType: file.type });
      newUrls.push(blob.url);
    }

    if (newUrls.length === 0) return badRequest("No valid image files");

    const updated = await client.query(
      `UPDATE equipment.items
         SET photos = array_cat(COALESCE(photos, ARRAY[]::text[]), $1::text[]),
             updated_at = NOW()
       WHERE id = $2
       RETURNING photos`,
      [newUrls, id]
    );

    // Return proxy view-URLs (by index), never the private blob URLs. The client
    // renders <img src> from these; the proxy GET streams the private blob.
    const stored: string[] = updated.rows[0].photos ?? [];
    const viewUrls = stored.map((_, i) => `/api/equipment/items/${id}/photos/view?i=${i}`);

    timer.done({ id, added: newUrls.length });
    return NextResponse.json({ photos: viewUrls, added: newUrls.length });
  }).catch((err) => { timer.error(err); return serverError(err, `POST /api/equipment/items/${id}/photos`); });
}

// DELETE — body { url }; removes the url from photos[] and deletes the Blob.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!validId(id)) return notFound();

  let user: SessionUser;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const timer = routeTimer(`DELETE /api/equipment/items/${id}/photos`);

  const body = await req.json().catch(() => null);
  // Client holds only proxy view-URLs (by index), never the private blob URL, so
  // deletion is by index into photos[].
  const index = body && Number.isInteger(body.index) ? (body.index as number) : -1;
  if (index < 0) return badRequest("Missing or invalid index");

  return withClient(bmsPool, async (client) => {
    const owner = await client.query(`SELECT store, photos FROM equipment.items WHERE id = $1`, [id]);
    if (owner.rows.length === 0) return notFound();
    if (user.role !== "admin" && owner.rows[0].store !== user.store) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const photos: string[] = owner.rows[0].photos ?? [];
    if (index >= photos.length) return badRequest("Index out of range");
    const target = photos[index];
    const remaining = photos.filter((_, i) => i !== index);

    const updated = await client.query(
      `UPDATE equipment.items SET photos = $1::text[], updated_at = NOW()
       WHERE id = $2 RETURNING photos`,
      [remaining, id]
    );
    if (updated.rows.length === 0) return notFound();

    // Delete the underlying Blob (only our own Blob URLs; ignore legacy/local paths).
    if (typeof target === "string" && target.includes(".blob.vercel-storage.com/")) {
      await del(target).catch(() => {});
    }

    const stored: string[] = updated.rows[0].photos ?? [];
    const viewUrls = stored.map((_, i) => `/api/equipment/items/${id}/photos/view?i=${i}`);
    timer.done({ id });
    return NextResponse.json({ photos: viewUrls });
  }).catch((err) => { timer.error(err); return serverError(err, `DELETE /api/equipment/items/${id}/photos`); });
}
