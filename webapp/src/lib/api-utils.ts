/**
 * Standardized API response helpers and error handling for all route handlers.
 * Replaces ad-hoc NextResponse.json() calls with consistent structure.
 */

import { NextResponse } from "next/server";

// ── Standard response envelope ────────────────────────────────────────────────

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json(data, { status: 201 });
}

export function notFound(message = "Not found"): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function serverError(err: unknown, context?: string): NextResponse {
  const message = err instanceof Error ? err.message : String(err);
  const label = context ? `[${context}]` : "[API]";
  console.error(`${label} ${message}`, err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

// ── Validated body parser ─────────────────────────────────────────────────────

export async function parseBody<T>(req: Request): Promise<T | null> {
  try {
    return await req.json() as T;
  } catch {
    return null;
  }
}

// ── Query param helpers ───────────────────────────────────────────────────────

export function getParam(url: URL, key: string): string | null {
  return url.searchParams.get(key);
}

export function getIntParam(url: URL, key: string, defaultVal: number, min = 1, max = Infinity): number {
  const raw = url.searchParams.get(key);
  if (!raw) return defaultVal;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) return defaultVal;
  return Math.min(max, Math.max(min, parsed));
}

// ── Pagination helpers ────────────────────────────────────────────────────────

export function paginate(url: URL, defaultLimit = 100) {
  const page = getIntParam(url, "page", 1);
  const limit = getIntParam(url, "limit", defaultLimit, 1, 500);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export function paginatedResponse<T>(rows: T[], total: number, page: number, limit: number) {
  return {
    rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  };
}

// ── Pool connection wrapper ───────────────────────────────────────────────────
// Ensures client is always released even on error.

import type { Pool, PoolClient } from "pg";

export async function withClient<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function withClients<T>(
  pools: Pool[],
  fn: (...clients: PoolClient[]) => Promise<T>
): Promise<T> {
  const clients = await Promise.all(pools.map((p) => p.connect()));
  try {
    return await fn(...clients);
  } finally {
    for (const c of clients) c.release();
  }
}
