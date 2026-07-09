import { Pool } from "pg";

const globalForBms = globalThis as unknown as { bmsPool: Pool | undefined };

export const bmsPool =
  globalForBms.bmsPool ??
  new Pool({
    // Host is overridable ONLY via JL_LOCAL_DB_HOST (for local E2E over VPN).
    // Password/user stay hardcoded: the prod .env has unrelated BMS_DB_* vars
    // (a stale MySQL "fortyone" config) that must NOT leak into this pg pool.
    host: process.env.JL_LOCAL_DB_HOST || "localhost",
    port: 5432,
    database: "bms",
    user: "postgres",
    password: "j3tl1n3@26",
    // Phase 20 — explicit pool ceiling so a runaway client cannot exhaust
    // Postgres connections. bms carries the heaviest equipment traffic.
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForBms.bmsPool = bmsPool;
}
