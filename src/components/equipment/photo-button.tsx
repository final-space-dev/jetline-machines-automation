"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Upload, X, Trash2 } from "lucide-react";

/**
 * Compact per-row photo control for the store equipment table. Shows a camera
 * icon + photo count; clicking opens a small popover to view / add / remove
 * photos for that item without leaving the page. Uploads go to Vercel Blob via
 * POST /api/equipment/items/[id]/photos (multipart "files"); removal via DELETE.
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
  const [photos, setPhotos] = useState<string[]>(initialPhotos ?? []);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const upload = useCallback(async (files: FileList) => {
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      for (const f of Array.from(files)) fd.append("files", f);
      const res = await fetch(`/api/equipment/items/${itemId}/photos`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Upload failed"); return; }
      if (Array.isArray(data.photos)) setPhotos(data.photos);
    } catch {
      setError("Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [itemId]);

  const remove = useCallback(async (url: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/equipment/items/${itemId}/photos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Remove failed"); return; }
      if (Array.isArray(data.photos)) setPhotos(data.photos);
      else setPhotos((prev) => prev.filter((p) => p !== url));
    } catch {
      setError("Remove failed");
    } finally {
      setBusy(false);
    }
  }, [itemId]);

  const count = photos.length;

  return (
    <div ref={rootRef} style={{ position: "relative", display: "inline-block" }} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="jl-btn jl-btn--ghost jl-btn--icon jl-btn--sm"
        aria-label={count > 0 ? `${count} photo${count !== 1 ? "s" : ""}` : "Add photos"}
        onClick={() => setOpen((o) => !o)}
        style={{ position: "relative" }}
        title={count > 0 ? `${count} photo${count !== 1 ? "s" : ""}` : "Add photos"}
      >
        <Camera size={15} style={{ color: count > 0 ? "var(--red-500)" : "var(--ink-400)" }} />
        {count > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -4, minWidth: 15, height: 15, padding: "0 3px",
            borderRadius: 8, background: "var(--red-500)", color: "#fff", fontSize: 9, fontWeight: 800,
            display: "grid", placeItems: "center", lineHeight: 1,
          }}>{count}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 60, width: 260,
          background: "var(--surface)", boxShadow: "var(--sh-lg)", borderRadius: "var(--r-md)",
          border: "1px solid var(--ink-100)", padding: 12, cursor: "default",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: "var(--ink-700)" }}>
              Photos {count > 0 && `(${count})`}
            </span>
            <button type="button" className="jl-btn jl-btn--ghost jl-btn--icon jl-btn--sm" aria-label="Close" onClick={() => setOpen(false)}>
              <X size={14} />
            </button>
          </div>

          {count > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 10 }}>
              {photos.map((url) => (
                <div key={url} style={{ position: "relative", aspectRatio: "1", borderRadius: "var(--r-sm)", overflow: "hidden", background: "var(--ink-50)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <a href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt="Equipment" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </a>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => remove(url)}
                      disabled={busy}
                      aria-label="Remove photo"
                      style={{
                        position: "absolute", top: 2, right: 2, width: 18, height: 18, borderRadius: 5, border: "none",
                        background: "rgba(0,0,0,0.55)", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer",
                      }}
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: "var(--ink-400)", marginBottom: 10 }}>No photos yet.</p>
          )}

          {canEdit && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                style={{ display: "none" }}
                onChange={(e) => { if (e.target.files) upload(e.target.files); }}
              />
              <button
                type="button"
                className="jl-btn jl-btn--soft jl-btn--sm"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={() => fileRef.current?.click()}
                disabled={busy}
              >
                {busy ? <span className="jl-spinner jl-spinner--sm" /> : <Upload size={14} />}
                {busy ? "Uploading…" : "Add photos"}
              </button>
            </>
          )}
          {error && <p style={{ fontSize: 11, color: "var(--red-600)", marginTop: 8 }}>{error}</p>}
        </div>
      )}
    </div>
  );
}
