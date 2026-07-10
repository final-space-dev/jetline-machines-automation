import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bmsPool } from "@/lib/bms-pool";
import { xeroxPool } from "@/lib/xerox-pool";
import type { Pool } from "pg";

/**
 * Phase 20 — extended health check.
 *
 * Beyond DB connectivity we verify data integrity and ingest recency:
 *   - equipment.items has rows              (bmsPool, guarded if table missing)
 *   - BMS sync ran in the last 24h          (proxy: MAX(report_date) in Xerox
 *                                             meters — the same proxy the
 *                                             print-report route documents, as
 *                                             there is no explicit sync-log)
 *   - Xerox import ran in the last 30 days   (MAX(report_date) in Xerox meters)
 *
 * Status mapping:
 *   - any DB connectivity failure          → critical (HTTP 503)
 *   - integrity / recency warning          → degraded (HTTP 200)
 *   - all good                             → healthy  (HTTP 200)
 */

type Check = { ok: boolean; latencyMs?: number; error?: string; [k: string]: unknown };

async function pingPool(pool: Pool): Promise<Check> {
  const start = performance.now();
  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
    } finally {
      client.release();
    }
    return { ok: true, latencyMs: Math.round(performance.now() - start) };
  } catch (err) {
    return { ok: false, latencyMs: Math.round(performance.now() - start), error: err instanceof Error ? err.message : String(err) };
  }
}

/** equipment.items row count > 0. Guarded so a missing table degrades, not crashes. */
async function checkEquipmentItems(): Promise<Check> {
  const client = await bmsPool.connect();
  try {
    const reg = await client.query(`SELECT to_regclass('equipment.items') AS t`);
    if (!reg.rows[0]?.t) {
      return { ok: false, error: "equipment.items table missing" };
    }
    const res = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM equipment.items`);
    const count = Number(res.rows[0]?.count ?? 0);
    return { ok: count > 0, count, error: count > 0 ? undefined : "equipment.items is empty" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    client.release();
  }
}

/**
 * Recency of the Xerox meter data (xeroxPool). Doubles as:
 *   - the last-import check (must be < 30 days old)
 *   - the best-effort last-sync proxy (must be < 24 hours old)
 * There is no dedicated sync-log table, so MAX(report_date) is the accepted
 * proxy used elsewhere in the app.
 */
async function checkXeroxRecency(): Promise<{ items: Check; sync: Check }> {
  const client = await xeroxPool.connect();
  try {
    const reg = await client.query(`SELECT to_regclass('xerox.meter_readings_normalised') AS t`);
    if (!reg.rows[0]?.t) {
      const missing: Check = { ok: false, error: "xerox.meter_readings_normalised table missing" };
      return { items: missing, sync: missing };
    }
    const res = await client.query<{ latest: string | null; age_hours: string | null }>(`
      SELECT
        MAX(report_date)::text AS latest,
        (EXTRACT(EPOCH FROM (NOW() - MAX(report_date)::timestamp)) / 3600)::text AS age_hours
      FROM xerox.meter_readings_normalised
    `);
    const latest = res.rows[0]?.latest ?? null;
    const ageHours = res.rows[0]?.age_hours != null ? Number(res.rows[0].age_hours) : null;

    if (latest == null || ageHours == null) {
      const empty: Check = { ok: false, error: "no meter readings found" };
      return { items: empty, sync: empty };
    }

    // Import recency: within 30 days.
    const importOk = ageHours <= 24 * 30;
    const importCheck: Check = {
      ok: importOk,
      lastImport: latest,
      ageHours: Math.round(ageHours),
      error: importOk ? undefined : "last Xerox import older than 30 days",
    };

    // Sync recency proxy: within 24 hours.
    const syncOk = ageHours <= 24;
    const syncCheck: Check = {
      ok: syncOk,
      lastSyncProxy: latest,
      ageHours: Math.round(ageHours),
      error: syncOk ? undefined : "last BMS sync (report_date proxy) older than 24h",
    };

    return { items: importCheck, sync: syncCheck };
  } catch (err) {
    const fail: Check = { ok: false, error: err instanceof Error ? err.message : String(err) };
    return { items: fail, sync: fail };
  } finally {
    client.release();
  }
}

export async function GET() {
  const timestamp = new Date().toISOString();

  const [prismaCheck, bmsCheck, xeroxCheck, equipmentItems, xeroxRecency] = await Promise.all([
    prisma.$queryRaw`SELECT 1`
      .then(() => ({ ok: true, latencyMs: 0 }) as Check)
      .catch((e: unknown) => ({ ok: false, latencyMs: 0, error: String(e) }) as Check),
    pingPool(bmsPool),
    pingPool(xeroxPool),
    checkEquipmentItems(),
    checkXeroxRecency(),
  ]);

  const checks = {
    db_prisma: prismaCheck,
    db_bms: bmsCheck,
    db_xerox: xeroxCheck,
    equipment_items: equipmentItems,
    xerox_import_recency: xeroxRecency.items,
    bms_sync_recency: xeroxRecency.sync,
  };

  // Connectivity failures are critical; everything else only degrades.
  const connectivityOk = prismaCheck.ok && bmsCheck.ok && xeroxCheck.ok;
  const integrityOk =
    equipmentItems.ok && xeroxRecency.items.ok && xeroxRecency.sync.ok;

  const status: "healthy" | "degraded" | "critical" = !connectivityOk
    ? "critical"
    : integrityOk
      ? "healthy"
      : "degraded";

  const httpStatus = status === "critical" ? 503 : 200;

  return NextResponse.json({ status, timestamp, checks }, { status: httpStatus });
}
