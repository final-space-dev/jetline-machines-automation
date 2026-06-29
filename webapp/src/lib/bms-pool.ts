import { Pool } from "pg";

const globalForBms = globalThis as unknown as { bmsPool: Pool | undefined };

export const bmsPool =
  globalForBms.bmsPool ??
  new Pool({
    host: "localhost",
    port: 5432,
    database: "bms",
    user: "postgres",
    password: "j3tl1n3@26",
  });

if (process.env.NODE_ENV !== "production") {
  globalForBms.bmsPool = bmsPool;
}
