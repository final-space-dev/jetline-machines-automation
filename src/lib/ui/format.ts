/** Reporting number format: WHOLE rands (this is a multi-million rand group),
 * space thousands, negatives in red brackets at the call site. Amounts that
 * ROUND to zero render as plain zero - never a bracketed "(0)" (R24: no
 * sub-rand noise in management views). */
/** "2025-12-31" (or any ISO date) -> "31 Dec 2025" for UI copy (R20). */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

/** Thousands separator for DISPLAY strings: thin space U+2009 (design-spec-v1
 * §1.2). en-ZA groups with NBSP (U+00A0); swap it for the thin space here so
 * only on-screen figures change - xlsx/export number formats are untouched. */
const THIN_SPACE = " ";
function thinSpaces(s: string): string {
  return s.replace(/ /g, THIN_SPACE);
}

export function fmtR0(n: number): string {
  const r = Math.round(Math.abs(n));
  const s = thinSpaces(r.toLocaleString("en-ZA"));
  return n < 0 && r !== 0 ? `(${s})` : s;
}

/** Working-paper format with cents (trial balances, journals). Amounts that
 * round to 0,00 render unbracketed. */
export function fmtR2(n: number): string {
  const cents = Math.round(Math.abs(n) * 100);
  const s = thinSpaces(
    (cents / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
  return n < 0 && cents !== 0 ? `(${s})` : s;
}

export function fmtPct1(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}
