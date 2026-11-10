"use client";

import { useCallback, useState } from "react";
import { Camera, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { FilePicker } from "@/components/machines/file-picker";
import { TYPE } from "@/lib/ui/ui-tokens";
import { cn } from "@/lib/ui/utils";

/**
 * Compact per-row photo control for the store equipment table. Shows a camera
 * and the photo count; clicking opens a small panel to view, add or remove
 * photos for that item without leaving the page. Photos live in a PRIVATE Vercel
 * Blob store and are served only through the authenticated proxy
 * (/api/equipment/items/[id]/photos/view?i=<index>): the component works with
 * those proxy view-URLs and never sees the private blob URL. Upload via POST,
 * removal by index via DELETE.
 */
export function PhotoButton({
  itemId,
  initialPhotos,
  canEdit,
}: {
  itemId: number;
  initialPhotos: string[] | null;
  canEdit: boolean;
}) {
  // The store list gives us the raw stored photos (private URLs we must not use
  // directly): we only need the COUNT to build proxy view-URLs by index.
  const initialViewUrls = (initialPhotos ?? []).map((_, i) => `/api/equipment/items/${itemId}/photos/view?i=${i}`);
  const [photos, setPhotos] = useState<string[]>(initialViewUrls);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      const res = await fetch(`/api/equipment/items/${itemId}/photos`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Upload failed"); return; }
      if (Array.isArray(data.photos)) setPhotos(data.photos);
    } catch {
      setError("Upload failed");
    } finally {
      setBusy(false);
    }
  }, [itemId]);

  const remove = useCallback(async (index: number) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/equipment/items/${itemId}/photos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Remove failed"); return; }
      if (Array.isArray(data.photos)) setPhotos(data.photos);
    } catch {
      setError("Remove failed");
    } finally {
      setBusy(false);
    }
  }, [itemId]);

  const count = photos.length;
  const name = count > 0 ? `${count} photo${count !== 1 ? "s" : ""}` : "Add photos";

  return (
    // The row under this control is clickable: a click here must not open the item.
    <span className="inline-flex" onClick={(e) => e.stopPropagation()}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button variant="ghost" size="sm" aria-label={name} title={name} />}>
          <Camera />
          {count > 0 && <Badge variant="secondary">{count}</Badge>}
        </PopoverTrigger>
        <PopoverContent align="end" className="flex w-64 flex-col gap-2.5 p-3">
          <span className={cn(TYPE.data, "font-semibold")}>Photos{count > 0 ? ` (${count})` : ""}</span>
          {count > 0 ? (
            <div className="grid grid-cols-3 gap-1.5">
              {photos.map((url, i) => (
                <div key={url} className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                  <a href={url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="Equipment" className="block size-full object-cover" />
                  </a>
                  {canEdit && (
                    <Button variant="secondary" size="icon-xs" className="absolute top-1 right-1" onClick={() => remove(i)} disabled={busy} aria-label="Remove photo">
                      <Trash2 />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className={cn(TYPE.data, "text-muted-foreground")}>No photos yet</p>
          )}
          {canEdit && (
            <FilePicker accept="image/png,image/jpeg,image/webp,image/gif" multiple disabled={busy} onFiles={upload} className="w-full">
              {busy ? <Spinner /> : <Upload />}
              {busy ? "Uploading" : "Add photos"}
            </FilePicker>
          )}
          {error && <p className={cn(TYPE.micro, "text-destructive")}>{error}</p>}
        </PopoverContent>
      </Popover>
    </span>
  );
}
