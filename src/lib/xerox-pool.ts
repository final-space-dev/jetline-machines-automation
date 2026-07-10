import { Pool } from "pg";

const globalForXerox = globalThis as unknown as { xeroxPool: Pool | undefined };

// Neon (single database "neondb"). The xerox.* schema lives here (ETL-mirrored
// meter tables + app-owned printer_store_map / machine_feedback). Queries use
// fully-qualified xerox.<table> names. Same DATABASE_URL as bmsPool — one DB,
// separated by schema.
const connectionString = process.env.DATABASE_URL;

export const xeroxPool =
  globalForXerox.xeroxPool ??
  new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
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
