import { Pool } from "pg";

const globalForXerox = globalThis as unknown as { xeroxPool: Pool | undefined };

export const xeroxPool =
  globalForXerox.xeroxPool ??
  new Pool({
    // Host overridable only via JL_LOCAL_DB_HOST (local E2E). Creds hardcoded
    // to avoid the stale BMS_DB_* prod env vars leaking in (see bms-pool).
    host: process.env.JL_LOCAL_DB_HOST || "localhost",
    port: 5432,
    database: "xerox_meters",
    user: "postgres",
    password: "j3tl1n3@26",
    // Phase 20 — explicit pool ceiling. Xerox reads are lighter than bms.
    max: 5,
  });

if (process.env.NODE_ENV !== "production") {
  globalForXerox.xeroxPool = xeroxPool;
}

export function parseSiteName(siteName: string | null): string {
  if (!siteName) return "";
  // Format: "Jetline\Cape town\03" → "Cape town 03"
  const parts = siteName.split("\\").map((p) => p.trim()).filter(Boolean);
  // Drop the first "Jetline" segment, join the rest
  const meaningful = parts.length > 1 ? parts.slice(1) : parts;
  return meaningful.join(" ");
}
