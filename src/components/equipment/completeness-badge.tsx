"use client";

/**
 * Phase 19 — reusable completeness score badge.
 * Colour thresholds: green > 80, amber 50–80, red < 50.
 * Used on store cards (bottom-right), store detail header, and leaderboards.
 */

export interface CompletenessColors {
  color: string;
  bg: string;
}

/** Resolve the token colours for a given 0–100 score. */
export function completenessColors(score: number): CompletenessColors {
  if (score > 80) return { color: "var(--jl-green-700)", bg: "var(--jl-green-tint)" };
  if (score >= 50) return { color: "var(--jl-amber-700)", bg: "var(--jl-amber-tint)" };
  return { color: "var(--jl-red-600)", bg: "var(--jl-red-tint)" };
}

export function CompletenessBadge({
  score,
  size = "sm",
  title,
}: {
  /** 0–100 completeness score. Null/undefined renders a neutral placeholder. */
  score: number | null | undefined;
  size?: "sm" | "md";
  title?: string;
}) {
  const known = typeof score === "number" && Number.isFinite(score);
  const rounded = known ? Math.round(score as number) : null;
  const c = known ? completenessColors(rounded as number) : { color: "var(--jl-ink-400)", bg: "var(--jl-ink-50)" };

  const dims =
    size === "md"
      ? { padding: "4px 12px", fontSize: 13 }
      : { padding: "2px 9px", fontSize: 11 };

  return (
    <span
      title={title ?? (known ? `${rounded}% complete` : "Completeness not scored yet")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        borderRadius: "var(--jl-r-pill)",
        fontWeight: 800,
        fontFamily: "var(--jl-font)",
        color: c.color,
        background: c.bg,
        whiteSpace: "nowrap",
        ...dims,
      }}
    >
      {known ? `${rounded}%` : "Not scored"}
    </span>
  );
}
