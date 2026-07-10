/**
 * JetlineUI 2.0 — centralized inline-style token helpers.
 * Use these instead of re-declaring the same CSSProperties object in every page.
 * All values reference CSS custom properties so they respond to dark mode automatically.
 */

import type { CSSProperties } from "react";

export const jlPage: CSSProperties = {
  fontFamily: "var(--jl-font)",
  background: "var(--jl-canvas)",
  color: "var(--jl-ink-900)",
  minHeight: "100%",
};

export const jlSurface: CSSProperties = {
  background: "var(--jl-surface)",
  boxShadow: "var(--jl-sh-sm)",
  borderRadius: "var(--jl-r-lg)",
};

export const jlSurfaceMd: CSSProperties = {
  background: "var(--jl-surface)",
  boxShadow: "var(--jl-sh-md)",
  borderRadius: "var(--jl-r-lg)",
};

export const jlInput: CSSProperties = {
  width: "100%",
  height: 38,
  padding: "0 12px",
  borderRadius: "var(--jl-r-sm)",
  border: "1.5px solid var(--jl-ink-200)",
  fontSize: 13,
  fontFamily: "var(--jl-font)",
  color: "var(--jl-ink-900)",
  background: "var(--jl-surface)",
  outline: "none",
};

export const jlTextarea: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "var(--jl-r-sm)",
  border: "1.5px solid var(--jl-ink-200)",
  fontSize: 13,
  fontFamily: "var(--jl-font)",
  color: "var(--jl-ink-900)",
  background: "var(--jl-surface)",
  outline: "none",
  resize: "vertical",
  lineHeight: 1.6,
};

export const jlSelect: CSSProperties = {
  height: 38,
  padding: "0 10px",
  borderRadius: "var(--jl-r-sm)",
  border: "1.5px solid var(--jl-ink-200)",
  fontSize: 13,
  fontFamily: "var(--jl-font)",
  color: "var(--jl-ink-700)",
  background: "var(--jl-surface)",
  outline: "none",
};

export const jlBtnPrimary: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  height: 38,
  padding: "0 18px",
  borderRadius: "var(--jl-r-sm)",
  background: "var(--jl-red-500)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 700,
  fontFamily: "var(--jl-font)",
  cursor: "pointer",
  border: "none",
  boxShadow: "var(--jl-sh-red)",
  transition: "all var(--jl-t-fast) var(--jl-ease)",
  whiteSpace: "nowrap",
};

export const jlBtnGhost: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  height: 38,
  padding: "0 14px",
  borderRadius: "var(--jl-r-sm)",
  background: "transparent",
  color: "var(--jl-ink-600)",
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "var(--jl-font)",
  cursor: "pointer",
  border: "1.5px solid var(--jl-ink-200)",
  transition: "all var(--jl-t-fast) var(--jl-ease)",
};

export const jlBtnDanger: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  height: 38,
  padding: "0 14px",
  borderRadius: "var(--jl-r-sm)",
  background: "rgba(230,18,31,0.08)",
  color: "var(--jl-red-500)",
  fontSize: 13,
  fontWeight: 700,
  fontFamily: "var(--jl-font)",
  cursor: "pointer",
  border: "1.5px solid rgba(230,18,31,0.2)",
  transition: "all var(--jl-t-fast) var(--jl-ease)",
};

export const jlLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--jl-ink-400)",
  marginBottom: 5,
  display: "block",
};

export const jlTh: CSSProperties = {
  padding: "9px 14px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color: "var(--jl-ink-400)",
  borderBottom: "1.5px solid var(--jl-ink-100)",
  whiteSpace: "nowrap",
  background: "var(--jl-surface-sunken)",
};

export const jlTd: CSSProperties = {
  padding: "11px 14px",
  fontSize: 13,
  color: "var(--jl-ink-800)",
  borderBottom: "1px solid var(--jl-ink-50)",
};

export const jlPill = (color: string, bg: string): CSSProperties => ({
  display: "inline-block",
  padding: "2px 9px",
  borderRadius: "var(--jl-r-pill)",
  fontSize: 11,
  fontWeight: 700,
  color,
  background: bg,
  whiteSpace: "nowrap",
});

export const jlCard: CSSProperties = {
  background: "var(--jl-surface)",
  boxShadow: "var(--jl-sh-sm)",
  borderRadius: "var(--jl-r-lg)",
  overflow: "hidden",
};
