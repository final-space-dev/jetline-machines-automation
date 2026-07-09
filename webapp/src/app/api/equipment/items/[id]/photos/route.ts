import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { bmsPool } from "@/lib/bms-pool";
import { withClient, notFound, badRequest, serverError } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";

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

function uploadDir(id: string): string {
  return path.join(process.cwd(), "public", "uploads", "equipment", id);
}

// POST — multipart form-data with one or more "files"; saves to disk and appends
// public URLs to equipment.items.photos (TEXT[]).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!validId(id)) return notFound();
  const timer = routeTimer(`POST /api/equipment/items/${id}/photos`);

  const form = await req.formData().catch(() => null);
  if (!form) return badRequest("Expected multipart form-data");

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return badRequest("No files provided");

  return withClient(bmsPool, async (client) => {
    const exists = await client.query(`SELECT id FROM equipment.items WHERE id = $1`, [id]);
    if (exists.rows.length === 0) return notFound();

    const dir = uploadDir(id);
    await fs.mkdir(dir, { recursive: true });

    const newUrls: string[] = [];
    for (const file of files) {
      if (!ALLOWED_MIME.has(file.type)) continue;
      if (file.size === 0 || file.size > MAX_BYTES) continue;
      const ext = EXT_BY_MIME[file.type] ?? ".bin";
      const filename = `${randomUUID()}${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(path.join(dir, filename), buffer);
      newUrls.push(`/uploads/equipment/${id}/${filename}`);
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

// DELETE — body { url }; removes url from photos array and unlinks the file if it
// lives under this item's upload directory.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!validId(id)) return notFound();
  const timer = routeTimer(`DELETE /api/equipment/items/${id}/photos`);

  const body = await req.json().catch(() => null);
  const url = body && typeof body.url === "string" ? body.url : null;
  if (!url) return badRequest("Missing url");

  return withClient(bmsPool, async (client) => {
    const updated = await client.query(
      `UPDATE equipment.items
         SET photos = array_remove(COALESCE(photos, ARRAY[]::text[]), $1),
             updated_at = NOW()
       WHERE id = $2
       RETURNING photos`,
      [url, id]
    );
    if (updated.rows.length === 0) return notFound();

    // Unlink the physical file only if it belongs to this item's upload dir.
    const prefix = `/uploads/equipment/${id}/`;
    if (url.startsWith(prefix)) {
      const filename = path.basename(url);
      const filePath = path.join(uploadDir(id), filename);
      await fs.unlink(filePath).catch(() => {});
    }

    timer.done({ id });
    return NextResponse.json({ photos: updated.rows[0].photos });
  }).catch((err) => { timer.error(err); return serverError(err, `DELETE /api/equipment/items/${id}/photos`); });
}
