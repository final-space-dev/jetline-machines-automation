/**
 * Structured logger for server-side API routes.
 * Outputs JSON lines in production for log aggregation; pretty-prints in dev.
 *
 * Phase 20 — extended with request-tracing fields (traceId / tenantId / userId)
 * and a slow-query WARN helper. All additions are backward compatible:
 *   - `routeTimer(route)` keeps working exactly as before.
 *   - `routeTimer(route, { traceId?, tenantId?, userId? })` merges those fields
 *     into every log line the timer emits (`.done()` / `.error()`).
 *   - `.done()` / `.error()` signatures are unchanged.
 */

type Level = "info" | "warn" | "error" | "debug";

interface LogEntry {
  ts: string;
  level: Level;
  msg: string;
  route?: string;
  durationMs?: number;
  traceId?: string;
  tenantId?: string;
  userId?: string;
  [key: string]: unknown;
}

const isDev = process.env.NODE_ENV !== "production";

function emit(level: Level, msg: string, meta: Record<string, unknown> = {}) {
  const entry: LogEntry = { ts: new Date().toISOString(), level, msg, ...meta };
  if (isDev) {
    const prefix = { info: "ℹ", warn: "⚠", error: "✖", debug: "·" }[level];
    const extras = Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
    console[level === "debug" ? "log" : level](`${prefix} [${entry.ts.slice(11, 23)}] ${msg}${extras}`);
  } else {
    process.stdout.write(JSON.stringify(entry) + "\n");
  }
}

export const log = {
  info:  (msg: string, meta?: Record<string, unknown>) => emit("info", msg, meta),
  warn:  (msg: string, meta?: Record<string, unknown>) => emit("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit("error", msg, meta),
  debug: (msg: string, meta?: Record<string, unknown>) => emit("debug", msg, meta),
};

// ── Request-scoped context ──────────────────────────────────────────────────
// Optional fields threaded through a routeTimer so every log line the timer
// emits carries the same trace correlation id, tenant, and user.

export interface RequestContext {
  traceId?: string;
  tenantId?: string;
  userId?: string;
}

// ── Route timer ───────────────────────────────────────────────────────────────

/**
 * Time a route handler and emit a structured completion/error log line.
 *
 * Backward compatible: called as `routeTimer(route)` today. The optional 2nd
 * argument attaches request-tracing context (traceId/tenantId/userId) to every
 * line this timer emits. Undefined context fields are dropped so log lines stay
 * clean when tracing is not wired in for a given route.
 */
export function routeTimer(route: string, ctx: RequestContext = {}) {
  const start = Date.now();
  const base: Record<string, unknown> = { route };
  if (ctx.traceId) base.traceId = ctx.traceId;
  if (ctx.tenantId) base.tenantId = ctx.tenantId;
  if (ctx.userId) base.userId = ctx.userId;

  return {
    done: (meta?: Record<string, unknown>) =>
      log.info(`${route} completed`, { ...base, durationMs: Date.now() - start, ...meta }),
    error: (err: unknown, meta?: Record<string, unknown>) => {
      const message = err instanceof Error ? err.message : String(err);
      log.error(`${route} failed`, { ...base, durationMs: Date.now() - start, error: message, ...meta });
    },
  };
}

// ── Slow-query logging ──────────────────────────────────────────────────────
// Threshold above which a DB query is considered slow and logged at WARN level.
export const SLOW_QUERY_MS = 500;

/**
 * Log a query at WARN level when it exceeds SLOW_QUERY_MS. No-op below the
 * threshold, so it is safe to call unconditionally after timing a query:
 *
 *   const t = Date.now();
 *   const rows = await client.query(sql);
 *   logSlowQuery("equipment.items list", Date.now() - t, { traceId });
 */
export function logSlowQuery(label: string, ms: number, ctx: RequestContext = {}): void {
  if (ms <= SLOW_QUERY_MS) return;
  const meta: Record<string, unknown> = { query: label, durationMs: Math.round(ms), thresholdMs: SLOW_QUERY_MS };
  if (ctx.traceId) meta.traceId = ctx.traceId;
  if (ctx.tenantId) meta.tenantId = ctx.tenantId;
  if (ctx.userId) meta.userId = ctx.userId;
  log.warn("slow query", meta);
}
