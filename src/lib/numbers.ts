/**
 * Numbers as they arrive and as they are shown.
 *
 * Postgres bigint columns arrive in JSON as STRINGS. Arithmetic on them
 * concatenates, `typeof v === "number"` rejects them, and `toLocaleString`
 * leaves them ungrouped, so every figure passes through here first.
 */

/** The value as a number; 0 for null, undefined, "" and anything that is not a finite number. */
export function num(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** True when a value is genuinely there: "read, 0" is present, "no reading" is not. */
export function present(v: unknown): boolean {
  return v !== null && v !== undefined && v !== "";
}

/** A whole count as South Africa writes it (1 234 567); a dash when there is no value. */
export function count(v: unknown): string {
  if (!present(v)) return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 }).format(n);
}
