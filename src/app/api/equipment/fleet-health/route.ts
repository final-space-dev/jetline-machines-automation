import { NextResponse } from "next/server";
import { bmsPool } from "@/lib/bms-pool";
import { xeroxPool } from "@/lib/xerox-pool";
import { withClients, serverError } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { getStoreGroup } from "@/lib/store-groups";
import { requireCapability, AuthError } from "@/lib/auth";
import type { PoolClient } from "pg";

// ── Condition classification (mirrors api/equipment/all-stores) ────────────────
// Reused so bucket counts stay consistent across the app. The new Phase-07 enum
// values "Good"/"Fair"/"Poor" are matched by the same ILIKE keyword predicates.

const CONDITION_CASE = `
  CASE
    WHEN condition ILIKE ANY(ARRAY['%not working%','%broken%','%poor%','%not in use%','%repair%','%disposed%']) THEN 'poor'
    WHEN condition ILIKE ANY(ARRAY['%good%','%excellent%','%perfect%','%new%','%reliable%','%neat%','%working order%','%operational%']) THEN 'good'
    WHEN condition ILIKE ANY(ARRAY['%fair%','%old%','%average%','%okay%','%used%','%below%']) THEN 'fair'
    ELSE 'unknown'
  END`;

/** Detect which columns exist so optional/new columns don't break queries. */
async function columnExists(client: PoolClient, schema: string, table: string, column: string): Promise<boolean> {
  const r = await client.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2 AND column_name = $3 LIMIT 1`,
    [schema, table, column]
  );
  return r.rows.length > 0;
}

interface EquipRow {
  id: number;
  store: string;
  machine_type: string | null;
  make_model: string | null;
  condition: string | null;
  bucket: string;
  updated_at: string | null;
}

interface PrinterRow {
  serial: string;
  store: string | null;
  model: string | null;
  contract_end: string | null;
  days_remaining: number | null;
}

interface ReplacementRequestRow {
  entity_type: string;
  entity_ref: string;
  store: string | null;
  item_label: string | null;
}

export async function GET() {
  // Fleet Health is the fleet-wide admin command centre (store staff are
  // redirected away from /equipment/fleet by middleware). Gate the data to
  // authenticated admins so it can't be read unauthenticated or cross-store.
  try {
    await requireCapability("nav:fleet");
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const timer = routeTimer("GET /api/equipment/fleet-health");

  return withClients([bmsPool, xeroxPool], async (bms, xerox) => {
    // Probe optional columns on both DBs.
    const [hasNextService, hasUpdatedAt, hasContractEnd] = await Promise.all([
      columnExists(bms, "equipment", "items", "next_service_due"),
      columnExists(bms, "equipment", "items", "updated_at"),
      columnExists(xerox, "xerox", "machine_feedback", "contract_end"),
    ]);

    const updatedCol = hasUpdatedAt ? "updated_at::text" : "NULL::text";

    // ── Equipment rows with computed bucket ──────────────────────────────────
    const equipItems = await bms.query<EquipRow>(`
      SELECT id, store, machine_type, make_model, condition,
             ${CONDITION_CASE} AS bucket,
             ${updatedCol} AS updated_at
      FROM equipment.items
    `);

    // ── Service overdue equipment ────────────────────────────────────────────
    let serviceOverdue: EquipRow[] = [];
    if (hasNextService) {
      const r = await bms.query<EquipRow>(`
        SELECT id, store, machine_type, make_model, condition,
               ${CONDITION_CASE} AS bucket,
               ${updatedCol} AS updated_at,
               next_service_due::text AS next_service_due
        FROM equipment.items
        WHERE next_service_due IS NOT NULL AND next_service_due < CURRENT_DATE
        ORDER BY next_service_due ASC
      `);
      serviceOverdue = r.rows;
    }

    // ── Printer feedback (replace + contract expiry) ─────────────────────────
    const contractSelect = hasContractEnd
      ? `mf.contract_end::text AS contract_end,
         (mf.contract_end - CURRENT_DATE) AS days_remaining`
      : `NULL::text AS contract_end, NULL::int AS days_remaining`;

    const printers = await xerox.query<PrinterRow>(`
      SELECT
        mf.serial_number AS serial,
        psm.store AS store,
        psm.model_name AS model,
        ${contractSelect}
      FROM xerox.machine_feedback mf
      LEFT JOIN xerox.printer_store_map psm
        ON UPPER(TRIM(psm.serial_number)) = UPPER(TRIM(mf.serial_number))
    `);

    // ── Open replacement requests (new replacement flow) ─────────────────────
    // Sourced from equipment.replacement_requests, which supersedes the old
    // replace_flag column. Wrapped so a missing table can't 500 the dashboard.
    let replacementRequests: ReplacementRequestRow[] = [];
    try {
      const rr = await xerox.query<ReplacementRequestRow>(`
        SELECT entity_type, entity_ref, store, item_label
        FROM equipment.replacement_requests
        WHERE status IN ('open','reviewing')
      `);
      replacementRequests = rr.rows;
    } catch {
      replacementRequests = [];
    }

    // ── Assemble condition breakdown ─────────────────────────────────────────
    const conditionBreakdown = { good: 0, fair: 0, poor: 0, unknown: 0 };
    for (const it of equipItems.rows) {
      const b = it.bucket as keyof typeof conditionBreakdown;
      if (b in conditionBreakdown) conditionBreakdown[b]++;
      else conditionBreakdown.unknown++;
    }

    // ── Attention: poor condition equipment ──────────────────────────────────
    const poorCondition = equipItems.rows
      .filter((r) => r.bucket === "poor")
      .map((r) => ({
        id: r.id,
        store: r.store,
        machine_type: r.machine_type,
        make_model: r.make_model,
        condition: r.condition,
        updated_at: r.updated_at,
      }));

    // ── Attention: replace flagged (open replacement requests) ───────────────
    // Sourced from equipment.replacement_requests (new flow) rather than the old
    // replace_flag column. entity_type 'printer' → serial/store/model;
    // anything else → equipment id/store/machine_type.
    const replaceFlagged = replacementRequests.map((rr) =>
      rr.entity_type === "printer"
        ? {
            kind: "printer" as const,
            serial: rr.entity_ref,
            store: rr.store,
            model: rr.item_label,
          }
        : {
            kind: "equipment" as const,
            id: Number(rr.entity_ref),
            store: rr.store,
            machine_type: rr.item_label,
          }
    );

    // ── Attention: contracts expiring within 30 days ─────────────────────────
    const contractsExpiring = printers.rows
      .filter((p) => p.days_remaining !== null && p.days_remaining >= 0 && p.days_remaining <= 30)
      .sort((a, b) => (a.days_remaining ?? 0) - (b.days_remaining ?? 0))
      .map((p) => ({
        serial: p.serial,
        store: p.store,
        model: p.model,
        contract_end: p.contract_end,
        days_remaining: p.days_remaining,
      }));

    const serviceOverdueRows = serviceOverdue.map((r) => ({
      id: r.id,
      store: r.store,
      machine_type: r.machine_type,
      make_model: r.make_model,
      condition: r.condition,
      updated_at: r.updated_at,
      next_service_due: (r as EquipRow & { next_service_due?: string | null }).next_service_due ?? null,
    }));

    // ── Store health ─────────────────────────────────────────────────────────
    interface StoreAgg {
      store: string;
      equipment: number;
      good: number;
      fair: number;
      poor: number;
      replace: number;
      printers: number;
      lastActivity: string | null;
    }
    const storeMap = new Map<string, StoreAgg>();
    const getStore = (name: string): StoreAgg => {
      let s = storeMap.get(name);
      if (!s) {
        s = { store: name, equipment: 0, good: 0, fair: 0, poor: 0, replace: 0, printers: 0, lastActivity: null };
        storeMap.set(name, s);
      }
      return s;
    };

    for (const it of equipItems.rows) {
      if (!it.store) continue;
      const s = getStore(it.store);
      s.equipment++;
      if (it.bucket === "good") s.good++;
      else if (it.bucket === "fair") s.fair++;
      else if (it.bucket === "poor") s.poor++;
      if (it.updated_at && (!s.lastActivity || it.updated_at > s.lastActivity)) s.lastActivity = it.updated_at;
    }
    for (const p of printers.rows) {
      if (!p.store) continue;
      const s = getStore(p.store);
      s.printers++;
    }
    // Replace count per store now comes from open replacement requests.
    for (const rr of replacementRequests) {
      if (!rr.store) continue;
      getStore(rr.store).replace++;
    }

    const storeHealth = Array.from(storeMap.values())
      .map((s) => {
        const denom = s.good + s.fair + s.poor;
        const score = denom > 0 ? s.good / denom : 0;
        const entry = getStoreGroup(s.store);
        return {
          store: s.store,
          group: entry?.storeGroup ?? null,
          equipment: s.equipment,
          poor: s.poor,
          printers: s.printers,
          replace: s.replace,
          score: Math.round(score * 1000) / 1000,
          lastActivity: s.lastActivity,
        };
      })
      .sort((a, b) => a.score - b.score);

    const kpi = {
      total: equipItems.rows.length,
      poor: conditionBreakdown.poor,
      serviceOverdue: serviceOverdueRows.length,
      replaceFlagged: replaceFlagged.length,
      contractsExpiring30d: contractsExpiring.length,
    };

    timer.done({ stores: storeHealth.length, total: kpi.total });
    return NextResponse.json({
      kpi,
      conditionBreakdown,
      attentionItems: {
        poorCondition,
        serviceOverdue: serviceOverdueRows,
        replaceFlagged,
        contractsExpiring,
      },
      storeHealth,
    });
  }).catch((err) => { timer.error(err); return serverError(err, "GET /api/equipment/fleet-health"); });
}
