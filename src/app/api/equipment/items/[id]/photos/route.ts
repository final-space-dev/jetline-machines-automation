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
// and appends the public Blob URLs to equipment.items.photos (TEXT[]).
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
      const blob = await put(key, file, { access: "public", contentType: file.type });
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

    timer.done({ id, added: newUrls.length });
    return NextResponse.json({ photos: updated.rows[0].photos, added: newUrls });
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
  const url = body && typeof body.url === "string" ? body.url : null;
  if (!url) return badRequest("Missing url");

  return withClient(bmsPool, async (client) => {
    const owner = await client.query(`SELECT store FROM equipment.items WHERE id = $1`, [id]);
    if (owner.rows.length === 0) return notFound();
    if (user.role !== "admin" && owner.rows[0].store !== user.store) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await client.query(
      `UPDATE equipment.items
         SET photos = array_remove(COALESCE(photos, ARRAY[]::text[]), $1),
             updated_at = NOW()
       WHERE id = $2
       RETURNING photos`,
      [url, id]
    );
    if (updated.rows.length === 0) return notFound();

    // Delete the underlying Blob (only our own Blob URLs; ignore legacy/local paths).
    if (url.includes(".blob.vercel-storage.com/")) {
      await del(url).catch(() => {});
    }

    timer.done({ id });
    return NextResponse.json({ photos: updated.rows[0].photos });
  }).catch((err) => { timer.error(err); return serverError(err, `DELETE /api/equipment/items/${id}/photos`); });
}
