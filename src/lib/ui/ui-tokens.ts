/**
 * UI TOKENS - the single styling source of the blessed component kit
 * (uniformity by construction, approved 2026-08-26).
 *
 * Retokened to docs/design-spec-v1.md (warm paper, quiet hairlines, one
 * confident blue). Every visual decision the product makes lives here or in
 * src/components/ui. Pages never restyle: they compose. To reskin the product,
 * edit THIS FILE and the kit components - every screen follows automatically.
 * scripts/ui-audit.sh enforces that pages cannot drift (R36).
 *
 * EXCEPTION (user hard rule): the Excel export button stays GREEN everywhere.
 */

// ── Core palette (spec §1.3) - named hex constants for kit components ────────
export const COLORS = {
  ink: "#1B1D21",
  slate: "#3A3F47",
  /** Darkened from #6E747E on 10 Nov 2026: 4.5 to 1 or better on Canvas, Paper, the inset card, the neutral chip and the subtle button. */
  muted: "#696F79",
  faint: "#9AA0A9",
  hairline: "#E8E9EB",
  canvas: "#F7F7F8",
  paper: "#FFFFFF",
  // Signal blue family
  signal: "#2A5BD7",
  signalHover: "#1E44A8",
  signalWash: "#EEF2FE",
  signalChipFg: "#2148AE",
  focusRing: "#E4EAFB",
  // Semantic families (solid / hover / wash / chip fg)
  proven: "#17795B",
  provenHover: "#12634A",
  provenWash: "#E9F4EF",
  provenChipFg: "#136349",
  pending: "#696F79",
  pendingHover: "#5B616B",
  pendingWash: "#F1F2F3",
  pendingChipFg: "#5B616B",
  deficit: "#C0453C",
  deficitHover: "#A3352D",
  deficitWash: "#FBEDEB",
  deficitChipFg: "#A83C34",
  removed: "#6B4BC9",
  removedWash: "#F1EDFB",
  removedChipFg: "#553BAE",
  person: "#4A3AA8",
  personWash: "#F1EDFB",
  // Warm-neutral working set
  insetBg: "#FCFCFD",
  subtleBg: "#FAFAFB",
  rowHairline: "#F4F4F5",
  panelHairline: "#F1F1F2",
  subtleButton: "#F1F2F3",
  subtleButtonHover: "#E4E6E8",
  track: "#ECEDEE",
  controlBorder: "#DEE0E3",
  hoverBorder: "#C8CACD",
  nil: "#C3C7CD",
  disabledText: "#B4B8BF",
  placeholder: "#A8ADB5",
  headerFg: "#8B9098",
  // Sidebar (dark) family: the Consol face's values, documented in the spec.
  // The live chrome reads CHROME (the face's CSS variables); sky stays a
  // literal because it is also a chart series colour (R37).
  sidebarBg: "#131B2C",
  sidebarCard: "#0E1626",
  sky: "#0EA5E9",
  skyFg: "#38BDF8",
} as const;

// ── Face chrome (R39) - the shell reads the current face's CSS variables ─────
// (globals.css: --face-*; Consol by default, Reporting under data-face).
export const CHROME = {
  sidebar: "bg-(--face-sidebar-bg)",
  card: "bg-(--face-sidebar-card)",
  accent: "bg-(--face-accent)",
  accentHover: "hover:bg-(--face-accent-hover)",
  label: "text-(--face-nav-label)",
  idle: "text-(--face-nav-idle)",
  dim: "text-(--face-nav-dim)",
  mid: "text-(--face-nav-mid)",
  text: "text-(--face-nav-text)",
  dimBorder: "border-(--face-nav-dim)",
  /** inline style value: the active bubble's glow */
  accentGlow: "var(--face-accent-glow)",
} as const;

// ── Surfaces (spec §3.7) ─────────────────────────────────────────────────────
export const SURFACE = {
  /** Page panel/section: r18, hairline border, paper. */
  panel: "rounded-[18px] border border-[#E8E9EB] bg-white",
  /** Flat card: r14. */
  card: "rounded-[14px] border border-[#E8E9EB] bg-white",
  /** Raised (clickable) card. */
  cardRaised: "rounded-[14px] border border-[#EEEFF0] bg-white shadow-[0_1px_2px_rgba(28,25,23,.06)]",
  /** Inset (read-only detail) card. */
  cardInset: "rounded-[14px] border border-[#EEEFF0] bg-[#FAFAFB]",
  /** Placeholder / empty-state card. */
  cardPlaceholder: "rounded-[14px] border border-dashed border-[#D8DADE] bg-[#FCFCFD]",
  /** DataTable shell: r16. */
  shell: "rounded-2xl border border-[#E8E9EB] bg-white",
} as const;

// ── Radii scale (spec §1.4): 8 inputs/chips · 10 buttons · 14 tiles · 18 panels
export const RADII = {
  chip: "rounded-lg",
  control: "rounded-[9px]",
  button: "rounded-[10px]",
  card: "rounded-[14px]",
  shell: "rounded-2xl",
  panel: "rounded-[18px]",
  overlay: "rounded-[20px]",
  pill: "rounded-full",
} as const;

// ── Shadows (spec §1.5, exact strings) - use via style or shadow-[...] ───────
export const SHADOWS = {
  raised: "0 1px 2px rgba(28,25,23,.06)",
  tileHover: "0 10px 24px rgba(28,25,23,.08)",
  stickyBar: "0 -2px 0 #FAFAFB inset, 0 10px 26px rgba(28,25,23,.08)",
  floating: "0 12px 30px rgba(28,25,23,.1)",
  menu: "0 16px 40px rgba(28,25,23,.14)",
  notificationPanel: "0 20px 50px rgba(28,25,23,.16)",
  sheet: "-20px 0 60px rgba(28,25,23,.2)",
  tooltip: "0 10px 26px rgba(28,25,23,.24)",
  dialog: "0 30px 70px rgba(28,25,23,.28)",
  palette: "0 30px 80px rgba(28,25,23,.3)",
  toast: "0 18px 44px rgba(28,25,23,.32)",
  primaryRest: "0 1px 2px rgba(42,91,215,.3)",
  primaryHover: "0 8px 20px rgba(42,91,215,.24)",
  successHover: "0 8px 20px rgba(23,121,91,.22)",
  navBubble: "0 6px 18px rgba(14,165,233,.32)",
  segmentedBubble: "0 1px 2px rgba(28,25,23,.10), 0 0 0 1px rgba(28,25,23,.04)",
  rowHoverRing: "inset 0 0 0 1px rgba(42,91,215,.12)",
  focusRing: "0 0 0 3px #E4EAFB",
  focusRingError: "0 0 0 3px #FBEDEB",
} as const;

// ── Type scale (R28, spec §1.1) ──────────────────────────────────────────────
export const TYPE = {
  /** Page titles: 22/600/-.02em ink */
  display: "text-[22px] font-semibold tracking-[-0.02em] text-[#1B1D21]",
  /** Section headings inside panels: 15/600 */
  section: "text-[15px] font-semibold text-[#1B1D21]",
  /** Forms, dialogs, prose: 13.5/400 slate */
  body: "text-[13.5px] leading-relaxed",
  /** Grid cells, controls, nav - the platform's native size: 13px */
  data: "text-[13px]",
  /** Field labels: 11.5/500 muted, sentence case (never uppercase) */
  label: "text-[11.5px] font-medium text-[#696F79]",
  /** Hints, timeline dates, metadata */
  micro: "text-[11px]",
  /** Uppercase micro label (labelled dividers, filter captions) */
  microLabel: "text-[11px] font-semibold tracking-[0.1em] text-[#9AA0A9] uppercase",
} as const;

// ── Grid metrics (R31, spec §3.6) ────────────────────────────────────────────
export const GRID = {
  /** The one table header style: 11.5/600 #8B9098 on #FAFAFB, 13px/14px pads */
  th: "font-grid px-3.5 py-[13px] text-left align-middle text-[11.5px] font-semibold whitespace-nowrap text-[#8B9098]",
  thRight: "text-right",
  /** Data row cell (compact density: 8px vertical, 14px horizontal) */
  td: "font-grid px-3.5 py-2 text-[13px]",
  /** Form-density row cell (comfortable: 12px vertical) */
  tdForm: "font-grid px-3.5 py-3 text-[13px]",
  /** Right-aligned tabular numerals */
  num: "text-right tabular-nums whitespace-nowrap",
  /** Negative amounts (Deficit) */
  neg: "text-[#C0453C]",
  /** Emphasis / banded column background */
  band: "bg-[#FAFAFB]",
  bandHeader: "bg-[#F4F4F5] text-[#1B1D21]",
  /** Row hairline */
  rowBorder: "border-b border-[#F4F4F5]",
  /** Subtotal / bold row */
  subtotalRow: "font-semibold border-t border-[#E8E9EB] bg-[#FAFAFB]",
  /** Sticky header wrapper */
  thead: "sticky top-0 z-20 bg-[#FAFAFB]",
  /** Card wrapper for record tables (panels/dialogs contexts) */
  card: "overflow-x-auto rounded-2xl border border-[#E8E9EB] bg-white",
} as const;

// ── Status palette (R30, spec §3.4 wash/chip-fg pairs) - mirrored by Badge ───
export const STATUS = {
  /** Proven */
  success: "bg-[#E9F4EF] text-[#136349]",
  /** Pending */
  warning: "bg-[#F1F2F3] text-[#5B616B]",
  /** Deficit */
  danger: "bg-[#FBEDEB] text-[#A83C34]",
  /** Signal */
  info: "bg-[#EEF2FE] text-[#2148AE]",
  /** Removed (eliminations) */
  elim: "bg-[#F1EDFB] text-[#553BAE]",
  neutral: "bg-[#F4F4F5] text-[#5A6068]",
} as const;

// ── Division palette (stable hue per division, user rule 2026-08-26) ─────────
// Re-derived in the spec's wash/chip-fg hue system: the five spec tonal
// families plus three siblings mixed at the same saturation and depth.
export const DIVISION_PALETTE = [
  "bg-[#EEF2FE] text-[#2148AE]", // Signal blue
  "bg-[#E9F4EF] text-[#136349]", // Proven green
  "bg-[#F1F2F3] text-[#5B616B]", // Pending grey
  "bg-[#F1EDFB] text-[#553BAE]", // Removed violet
  "bg-[#F1EDFB] text-[#4A3AA8]", // Person indigo
  "bg-[#E7F3FA] text-[#0B6E9E]", // sky sibling
  "bg-[#E6F3F1] text-[#0F6A61]", // teal sibling
  "bg-[#E9EDF2] text-[#3F4C61]", // steel slate
] as const;

export function divisionChipClass(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return DIVISION_PALETTE[h % DIVISION_PALETTE.length];
}

// ── Motion (R35, spec §1.8 contract) ─────────────────────────────────────────
export const MOTION = {
  /** Hover tint: 180ms plain ease */
  settle: "transition-all duration-[180ms] ease-standard",
  /** Travelling bubble / active-state glide: 380ms spring */
  spring: "duration-[380ms] ease-bubble",
} as const;

// ── App shell (spec §2.1) - consumed by ConsolShell ──────────────────────────
export const SHELL = {
  sectionLabel: "px-2.5 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-(--face-nav-label)",
  navItem: "relative z-10 flex items-center gap-[11px] rounded-[9px] px-2.5 py-[9px] text-[13px] transition-colors duration-[180ms] ease-standard",
  navItemActive: "font-semibold text-white",
  navItemIdle: "font-medium text-(--face-nav-idle) hover:text-white",
} as const;
