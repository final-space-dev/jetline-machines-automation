import type { PoolClient } from "pg";
import { bmsPool } from "@/lib/bms-pool";

/**
 * Postgres-backed rate limiting + login lockout. NO Redis and NOT in-memory —
 * the previous in-memory limiter was per-process, which is useless on Vercel's
 * serverless/Fluid Compute where requests spread across instances and counters
 * never accumulate. This uses a single append-only table counted within a
 * sliding window, so the limit is shared across every instance.
 *
 * Two uses:
 *  - rateLimit(bucket, limit, windowSec): generic per-key throttle (e.g. per-IP
 *    on mutations). Returns { allowed, remaining, retryAfterSec }.
 *  - login lockout: recordLoginFailure / clearLoginFailures / isLoginLocked,
 *    keyed by email, so brute-forcing one account locks that account.
 *
 * All functions FAIL OPEN on any DB error — the limiter must never lock out a
 * legitimate user because the limiter itself broke.
 */

let ensured = false;
async function ensureTable(client: PoolClient): Promise<void> {
  if (ensured) return;
  await client.query(`CREATE SCHEMA IF NOT EXISTS security`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS security.rate_events (
      id         BIGSERIAL PRIMARY KEY,
      bucket     TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS rate_events_bucket_time_idx ON security.rate_events (bucket, created_at DESC)`);
  ensured = true;
}

async function prune(client: PoolClient): Promise<void> {
  await client.query(`DELETE FROM security.rate_events WHERE created_at < NOW() - INTERVAL '1 day'`);
}

export interface RateResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

/** Generic sliding-window limiter. Records one event, returns whether within limit. */
export async function rateLimit(bucket: string, limit: number, windowSec: number): Promise<RateResult> {
  const client = await bmsPool.connect();
  try {
    await ensureTable(client);
    const { rows } = await client.query(
      `SELECT COUNT(*)::int AS n FROM security.rate_events
       WHERE bucket = $1 AND created_at > NOW() - ($2 || ' seconds')::interval`,
      [bucket, String(windowSec)],
    );
    const count = rows[0]?.n ?? 0;
    if (count >= limit) return { allowed: false, remaining: 0, retryAfterSec: windowSec };
    await client.query(`INSERT INTO security.rate_events (bucket) VALUES ($1)`, [bucket]);
    if (count % 97 === 0) await prune(client).catch(() => {});
    return { allowed: true, remaining: Math.max(0, limit - count - 1), retryAfterSec: 0 };
  } catch {
    return { allowed: true, remaining: limit, retryAfterSec: 0 };
  } finally {
    client.release();
  }
}

// ── Login lockout ─────────────────────────────────────────────────────────────
const LOGIN_LIMIT = 8;          // failures allowed…
const LOGIN_WINDOW_SEC = 900;   // …within 15 minutes before lockout.

function loginBucket(email: string): string {
  return `login:${email.trim().toLowerCase()}`;
}

/** True if this email currently has too many recent failures (locked out). */
export async function isLoginLocked(email: string): Promise<boolean> {
  const client = await bmsPool.connect();
  try {
    await ensureTable(client);
    const { rows } = await client.query(
      `SELECT COUNT(*)::int AS n FROM security.rate_events
       WHERE bucket = $1 AND created_at > NOW() - ($2 || ' seconds')::interval`,
      [loginBucket(email), String(LOGIN_WINDOW_SEC)],
    );
    return (rows[0]?.n ?? 0) >= LOGIN_LIMIT;
  } catch {
    return false;
  } finally {
    client.release();
  }
}

/** Record one failed login for this email. */
export async function recordLoginFailure(email: string): Promise<void> {
  const client = await bmsPool.connect();
  try {
    await ensureTable(client);
    await client.query(`INSERT INTO security.rate_events (bucket) VALUES ($1)`, [loginBucket(email)]);
  } catch {
    /* fail open */
  } finally {
    client.release();
  }
}

/** Clear a user's failure history after a successful login. */
export async function clearLoginFailures(email: string): Promise<void> {
  const client = await bmsPool.connect();
  try {
    await ensureTable(client);
    await client.query(`DELETE FROM security.rate_events WHERE bucket = $1`, [loginBucket(email)]);
  } catch {
    /* best effort */
  } finally {
    client.release();
  }
}
