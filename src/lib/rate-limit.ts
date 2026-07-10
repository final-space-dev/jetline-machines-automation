/**
 * Phase 20 — In-memory sliding-window rate limiter (no Redis).
 *
 * PER-PROCESS ONLY. The counters live in module-scoped Maps, so the limit is
 * enforced independently in each running instance. With a single PM2 instance
 * (current production topology) that is exactly one shared window. If the app
 * is ever scaled to multiple instances behind a load balancer, swap this for a
 * shared store (Redis) — the public API here (`checkRateLimit`) can stay.
 *
 * Sliding window: we keep the timestamps of recent hits per key and count how
 * many fall inside the trailing `windowMs`. Old timestamps are pruned on read.
 */

const WINDOW_MS = 60_000; // 1 minute

// Per-IP and per-user share the same store keyed by a prefixed identifier.
const hits = new Map<string, number[]>();

// Opportunistic global sweep so the Maps do not grow unbounded for keys that
// stop appearing. Runs at most once per window on access.
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < WINDOW_MS) return;
  lastSweep = now;
  for (const [key, times] of hits) {
    const kept = times.filter((t) => now - t < WINDOW_MS);
    if (kept.length === 0) hits.delete(key);
    else hits.set(key, kept);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the oldest hit in the window expires (for Retry-After). */
  retryAfter: number;
  limit: number;
  remaining: number;
}

/**
 * Record a hit for `key` and report whether it is within `limit` per minute.
 * Always records the hit (even when blocked) so sustained abuse keeps the
 * window saturated rather than letting it drain between rejected requests.
 */
export function checkRateLimit(key: string, limit: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const times = hits.get(key) ?? [];
  // Prune timestamps outside the trailing window.
  const recent = times.filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);

  const count = recent.length;
  const allowed = count <= limit;

  let retryAfter = 0;
  if (!allowed) {
    const oldest = recent[0];
    retryAfter = Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000));
  }

  return {
    allowed,
    retryAfter,
    limit,
    remaining: Math.max(0, limit - count),
  };
}

export const IP_LIMIT_PER_MIN = 200;
export const USER_LIMIT_PER_MIN = 500;
