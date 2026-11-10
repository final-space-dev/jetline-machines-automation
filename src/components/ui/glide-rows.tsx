"use client";

import { useRef, useState } from "react";

/**
 * The travelling row-hover bubble (design-spec-v1 §1.9 / §3.6): one shared
 * highlight that glides between rows on the 380ms spring instead of each row
 * flashing its own background. Skin: rgba(42,91,215,.05) wash, r6, inset
 * 1px rgba(42,91,215,.12) ring; opacity fades on 200ms ease.
 *
 * Wrap the table (or any vertical list) and mark each hoverable row with
 * data-glide. The highlight paints ABOVE the content with multiply blending,
 * so striped columns and sticky cells tint correctly, and it ignores the
 * pointer entirely.
 */
export function GlideRows({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<{ top: number; h: number } | null>(null);
  const [visible, setVisible] = useState(false);

  function onOver(e: React.MouseEvent) {
    const row = (e.target as HTMLElement).closest("[data-glide]");
    if (!(row instanceof HTMLElement) || !ref.current?.contains(row)) return;
    const top = row.getBoundingClientRect().top - ref.current.getBoundingClientRect().top;
    setRect({ top, h: row.getBoundingClientRect().height });
    setVisible(true);
  }

  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      onMouseOver={onOver}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {rect && (
        <div
          aria-hidden
          className={`pointer-events-none absolute left-0 right-0 top-0 z-10 rounded-md bg-[rgba(42,91,215,0.05)] mix-blend-multiply shadow-[inset_0_0_0_1px_rgba(42,91,215,0.12)] [transition:transform_.38s_cubic-bezier(.2,.9,.2,1),height_.38s_cubic-bezier(.2,.9,.2,1),opacity_.2s_ease] ${
            visible ? "opacity-100" : "opacity-0"
          }`}
          style={{ height: rect.h, transform: `translateY(${rect.top}px)` }}
        />
      )}
    </div>
  );
}
