import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { bmsPool } from "@/lib/bms-pool";
import { xeroxPool } from "@/lib/xerox-pool";
import { prisma } from "@/lib/prisma";
import { withClients, serverError } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import type { PoolClient } from "pg";

/**
 * POST /api/notifications/scan
 *
 * Background alert scanner (Phase 14). Called by a PM2 cron every 6 hours via
 * scripts/scan-notifications.sh. Not tied to a user session.
 *
 * Auth: shared-secret header, fail closed. CRON_SECRET MUST be configured and the
 * caller MUST send a matching `x-cron-secret: <CRON_SECRET>` (constant-time
 * compared). If CRON_SECRET is unset the endpoint returns 500 rather than
 * accepting anonymous callers.
 *
 * It reads equipment.items (bmsPool) and xerox.machine_feedback (xeroxPool),
 * guards every optional column with an information_schema existence check, and
 * inserts Notification rows (jetline_machines Prisma DB) for each trigger. A row
 * is skipped (dedup) if an UNREAD notification of the same type + store +
 * itemId/serial was created within the last 7 days.
 */

// ── Condition classification (mirrors fleet-health / all-stores) ───────────────
const CONDITION_CASE = `
  CASE
    WHEN condition ILIKE ANY(ARRAY['%not working%','%broken%','%poor%','%not in use%','%repair%','%disposed%']) THEN 'poor'
    WHEN condition ILIKE ANY(ARRAY['%good%','%excellent%','%perfect%','%new%','%reliable%','%neat%','%working order%','%operational%']) THEN 'good'
    WHEN condition ILIKE ANY(ARRAY['%fair%','%old%','%average%','%okay%','%used%','%below%']) THEN 'fair'
    ELSE 'unknown'
  END`;

/** Detect which columns exist so optional/new columns don't break queries. */
async function columnExists(
  client: PoolClient,
  schema: string,
  table: string,
  column: string,
): Promise<boolean> {
  const r = await client.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2 AND column_name = $3 LIMIT 1`,
    [schema, table, column],
  );
  return r.rows.length > 0;
}

/** Detect whether a table exists at all (defends missing feedback table). */
async function tableExists(client: PoolClient, schema: string, table: string): Promise<boolean> {
  const r = await client.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = $1 AND table_name = $2 LIMIT 1`,
    [schema, table],
  );
  return r.rows.length > 0;
}

type NotifType =
  | "service_overdue"
  | "service_due_soon"
  | "contract_expiring"
  | "contract_expired"
  | "equipment_poor";

interface Candidate {
  type: NotifType;
  message: string;
  store: string | null;
  itemId: number | null;
  serial: string | null;
}

/**
 * Returns true if an UNREAD notification of the same type + store + itemId/serial
 * was created within the last 7 days (dedup window).
 */
async function alreadyNotified(c: Candidate, since: Date): Promise<boolean> {
  const existing = await prisma.notification.findFirst({
    where: {
      type: c.type,
      store: c.store,
      itemId: c.itemId,
      serial: c.serial,
      read: false,
      createdAt: { gte: since },
    },
    select: { id: true },
  });
  return existing !== null;
}

export async function POST(req: NextRequest) {
  // ── Cron-secret guard (fail closed) ──────────────────────────────────────────
  // The scanner runs unauthenticated by design (no user session), so the shared
  // secret is the ONLY gate. Fail closed: if CRON_SECRET is not configured the
  // endpoint refuses to run rather than accepting anonymous callers.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Server misconfigured: CRON_SECRET required" },
      { status: 500 }
    );
  }
  const provided = req.headers.get("x-cron-secret") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const timer = routeTimer("POST /api/notifications/scan");

  return withClients([bmsPool, xeroxPool], async (bms, xerox) => {
    const candidates: Candidate[] = [];
    const scanned = {
      serviceOverdue: 0,
      serviceDueSoon: 0,
      contractExpiring: 0,
      contractExpired: 0,
      equipmentPoor: 0,
    };

    // ── Equipment items (bmsPool) ──────────────────────────────────────────────
    const hasItems = await tableExists(bms, "equipment", "items");
    if (hasItems) {
      const hasNextService = await columnExists(bms, "equipment", "items", "next_service_due");

      // Service overdue + due soon (<=14 days)
      if (hasNextService) {
        const svc = await bms.query<{
          id: number;
          store: string | null;
          make_model: string | null;
          days_remaining: number | null;
        }>(`
          SELECT id, store, make_model,
                 (next_service_due - CURRENT_DATE) AS days_remaining
          FROM equipment.items
          WHERE next_service_due IS NOT NULL
            AND next_service_due <= CURRENT_DATE + INTERVAL '14 days'
        `);
        for (const row of svc.rows) {
          const d = row.days_remaining;
          if (d === null) continue;
          const label = row.make_model ?? "Equipment";
          const store = row.store ?? null;
          if (d < 0) {
            scanned.serviceOverdue++;
            candidates.push({
              type: "service_overdue",
              message: `Service overdue: ${label}${store ? ` at ${store}` : ""}`,
              store,
              itemId: row.id,
              serial: null,
            });
          } else {
            scanned.serviceDueSoon++;
            candidates.push({
              type: "service_due_soon",
              message: `Service due in ${d} days: ${label}${store ? ` at ${store}` : ""}`,
              store,
              itemId: row.id,
              serial: null,
            });
          }
        }
      }

      // Equipment poor condition
      const poor = await bms.query<{
        id: number;
        store: string | null;
        make_model: string | null;
      }>(`
        SELECT id, store, make_model
        FROM equipment.items
        WHERE ${CONDITION_CASE} = 'poor'
      `);
      for (const row of poor.rows) {
        scanned.equipmentPoor++;
        const label = row.make_model ?? "Equipment";
        candidates.push({
          type: "equipment_poor",
          message: `Equipment in poor condition: ${label}${row.store ? ` at ${row.store}` : ""}`,
          store: row.store ?? null,
          itemId: row.id,
          serial: null,
        });
      }
    }

    // ── Printer feedback (xeroxPool) ───────────────────────────────────────────
    const hasFeedback = await tableExists(xerox, "xerox", "machine_feedback");
    if (hasFeedback) {
      const [hasContractEnd, hasStoreMap] = await Promise.all([
        columnExists(xerox, "xerox", "machine_feedback", "contract_end"),
        tableExists(xerox, "xerox", "printer_store_map"),
      ]);

      const storeSelect = hasStoreMap ? "psm.store AS store" : "NULL::text AS store";
      const storeJoin = hasStoreMap
        ? `LEFT JOIN xerox.printer_store_map psm
             ON UPPER(TRIM(psm.serial_number)) = UPPER(TRIM(mf.serial_number))`
        : "";

      // Contract expiring (<=30d) + expired (<today)
      if (hasContractEnd) {
        const contracts = await xerox.query<{
          serial: string;
          store: string | null;
          days_remaining: number | null;
        }>(`
          SELECT mf.serial_number AS serial,
                 ${storeSelect},
                 (mf.contract_end - CURRENT_DATE) AS days_remaining
          FROM xerox.machine_feedback mf
          ${storeJoin}
          WHERE mf.contract_end IS NOT NULL
            AND mf.contract_end <= CURRENT_DATE + INTERVAL '30 days'
        `);
        for (const row of contracts.rows) {
          const d = row.days_remaining;
          if (d === null) continue;
          const store = row.store ?? null;
          if (d < 0) {
            scanned.contractExpired++;
            candidates.push({
              type: "contract_expired",
              message: `Contract expired: ${row.serial}${store ? ` at ${store}` : ""}`,
              store,
              itemId: null,
              serial: row.serial,
            });
          } else {
            scanned.contractExpiring++;
            candidates.push({
              type: "contract_expiring",
              message: `Contract expiring in ${d} days: ${row.serial}${store ? ` at ${store}` : ""}`,
              store,
              itemId: null,
              serial: row.serial,
            });
          }
        }
      }
    }

    // ── Dedup + insert ─────────────────────────────────────────────────────────
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let created = 0;
    for (const c of candidates) {
      if (await alreadyNotified(c, since)) continue;
      await prisma.notification.create({
        data: {
          type: c.type,
          message: c.message,
          store: c.store,
          itemId: c.itemId,
          serial: c.serial,
        },
      });
      created++;
    }

    timer.done({ created, candidates: candidates.length });
    return NextResponse.json({ created, scanned });
  }).catch((err) => {
    timer.error(err);
    return serverError(err, "POST /api/notifications/scan");
  });
}
