import { Pool } from "pg";

const globalForBms = globalThis as unknown as { bmsPool: Pool | undefined };

// Neon (single database "neondb"). The equipment.* schema lives here; queries
// use fully-qualified equipment.<table> names so schema separation still holds.
// DATABASE_URL is injected by the Vercel/Neon integration.
const connectionString = process.env.DATABASE_URL;

export const bmsPool =
  globalForBms.bmsPool ??
  new Pool({
    connectionString,
    // Verify TLS against the system CA store. Neon's cert chains to a public CA
    // (Let's Encrypt), so full verification works — no rejectUnauthorized:false.
    ssl: { rejectUnauthorized: true },
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForBms.bmsPool = bmsPool;
}
