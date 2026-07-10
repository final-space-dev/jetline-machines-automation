/**
 * Phase 20 — White-label brand configuration.
 *
 * Plain constants sourced from environment variables so this module is safe in
 * BOTH server components and client components. For the client sidebar to read
 * the values at runtime they MUST be inlined at build time via the
 * `NEXT_PUBLIC_` prefix. Server-only fallbacks (`BRAND_NAME`, etc.) are also
 * honoured so a plain `.env` without the prefix still works server-side.
 *
 * Defaults keep the app branded as JetlineFleet with the JL red token.
 *
 *   NEXT_PUBLIC_BRAND_NAME      default: "JetlineFleet"
 *   NEXT_PUBLIC_BRAND_COLOR     default: "#e6121f"   (var(--jl-red-500))
 *   NEXT_PUBLIC_BRAND_LOGO_URL  default: null        (falls back to wordmark)
 */

export interface Brand {
  name: string;
  color: string;
  logoUrl: string | null;
}

const DEFAULT_NAME = "JetlineFleet";
const DEFAULT_COLOR = "#e6121f";

export function getBrand(): Brand {
  const name =
    process.env.NEXT_PUBLIC_BRAND_NAME ?? process.env.BRAND_NAME ?? DEFAULT_NAME;
  const color =
    process.env.NEXT_PUBLIC_BRAND_COLOR ?? process.env.BRAND_COLOR ?? DEFAULT_COLOR;
  const logoUrl =
    process.env.NEXT_PUBLIC_BRAND_LOGO_URL ?? process.env.BRAND_LOGO_URL ?? null;
  return { name, color, logoUrl: logoUrl && logoUrl.trim() ? logoUrl : null };
}

/**
 * Split a brand name into a leading "plain" part and a trailing "accent" part
 * so the sidebar can render the two-tone wordmark (e.g. "Jetline" + "Fleet").
 * Falls back to the whole name as the plain part with no accent.
 */
export function splitBrandName(name: string): { lead: string; accent: string } {
  // Match a trailing CamelCase or space-separated word as the accent.
  const camel = name.match(/^(.*?)([A-Z][a-z0-9]*)$/);
  if (camel && camel[1]) {
    return { lead: camel[1].trim(), accent: camel[2] };
  }
  const parts = name.trim().split(/\s+/);
  if (parts.length > 1) {
    return { lead: parts.slice(0, -1).join(" "), accent: parts[parts.length - 1] };
  }
  return { lead: name, accent: "" };
}
