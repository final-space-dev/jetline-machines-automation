import { NextResponse } from "next/server";
import { bmsPool } from "@/lib/bms-pool";
import { xeroxPool } from "@/lib/xerox-pool";
import { withClients, serverError } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { getStoreGroup } from "@/lib/store-groups";
import { requireAdmin, AuthError } from "@/lib/auth";

const REAL_METERS = `('black_impressions','color_impressions','black_large_impressions','color_large_impressions')`;

export async function GET() {
  // The 48-store grid is an admin surface (store staff are redirected to their
  // own store by middleware). Gate the data so it can't be read unauthenticated
  // or cross-store via a direct API call.
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const timer = routeTimer("GET /api/equipment/all-stores");
  return withClients([bmsPool, xeroxPool], async (eq, xero) => {
    const [xeroxStores, eqCounts, machineCounts, volumeByStore, printerHealthByStore] = await Promise.all([
      xero.query<{ store: string }>(
        `SELECT DISTINCT store FROM xerox.printer_store_map WHERE store IS NOT NULL ORDER BY store`
      ),
      eq.query<{ store: string; count: string; good: string; fair: string; poor: string }>(
        `SELECT
           store,
           COUNT(*) AS count,
           COUNT(*) FILTER (WHERE condition ILIKE ANY(ARRAY['%good%','%excellent%','%perfect%','%new%','%reliable%','%neat%','%working order%','%operational%'])) AS good,
           COUNT(*) FILTER (WHERE condition ILIKE ANY(ARRAY['%fair%','%old%','%average%','%okay%','%used%','%below%'])) AS fair,
           COUNT(*) FILTER (WHERE condition ILIKE ANY(ARRAY['%not working%','%broken%','%poor%','%not in use%','%repair%','%disposed%'])) AS poor
         FROM equipment.items
         GROUP BY store`
      ),
      xero.query<{ store: string; count: string }>(
        `SELECT psm.store, COUNT(*) AS count
         FROM xerox.printer_store_map psm
         JOIN xerox.printer_dimensions pd ON pd.serial_number = psm.serial_number
         WHERE psm.store IS NOT NULL AND psm.reporting_enabled = true AND pd.manufacturer = 'Xerox'
         GROUP BY psm.store`
      ),
      // Last-30-day total volume per store: diff consecutive readings per printer
      // (summed across the 4 real meters), keep positive deltas, aggregate by store.
      // Single round-trip keyed by store — no per-store loop.
      xero.query<{ store: string; volume: string }>(
        `WITH store_printers AS (
           SELECT DISTINCT ON (pd.serial_number) pd.printer_id, psm.store
           FROM xerox.printer_dimensions pd
           JOIN xerox.printer_store_map psm ON psm.serial_number = pd.serial_number
           WHERE pd.manufacturer = 'Xerox'
             AND pd.serial_number IS NOT NULL
             AND psm.store IS NOT NULL
             AND psm.reporting_enabled = true
           ORDER BY pd.serial_number
         ),
         readings AS (
           SELECT sp.store, r.printer_id, r.report_date, SUM(r.reading) AS reading
           FROM xerox.meter_readings_normalised r
           JOIN store_printers sp ON sp.printer_id = r.printer_id
           WHERE r.meter_type IN ${REAL_METERS}
             AND r.reading IS NOT NULL
             AND r.report_date >= CURRENT_DATE - INTERVAL '31 days'
           GROUP BY sp.store, r.printer_id, r.report_date
         ),
         diffs AS (
           SELECT
             store,
             GREATEST(0, reading - LAG(reading) OVER (
               PARTITION BY printer_id ORDER BY report_date
             )) AS volume
           FROM readings
         )
         SELECT store, COALESCE(SUM(volume), 0)::bigint AS volume
         FROM diffs
         GROUP BY store`
      ),
      // Printer fleet health per store: active count + replace-flagged count.
      xero.query<{ store: string; active: string; replace_flagged: string }>(
        `SELECT
           psm.store,
           COUNT(*)::bigint AS active,
           COUNT(*) FILTER (WHERE mf.replace_flag ILIKE '%yes%')::bigint AS replace_flagged
         FROM xerox.printer_store_map psm
         JOIN xerox.printer_dimensions pd ON pd.serial_number = psm.serial_number
         LEFT JOIN xerox.machine_feedback mf
           ON UPPER(TRIM(mf.serial_number)) = UPPER(TRIM(psm.serial_number))
         WHERE psm.store IS NOT NULL AND psm.reporting_enabled = true AND pd.manufacturer = 'Xerox'
         GROUP BY psm.store`
      ),
    ]);

    const eqMap = new Map(eqCounts.rows.map((r) => [r.store, r]));
    const machineMap = new Map(machineCounts.rows.map((r) => [r.store, parseInt(r.count)]));
    const volumeMap = new Map(volumeByStore.rows.map((r) => [r.store, parseInt(r.volume)]));
    const healthMap = new Map(
      printerHealthByStore.rows.map((r) => [
        r.store,
        { active: parseInt(r.active), replaceFlagged: parseInt(r.replace_flagged) },
      ])
    );
    const allStoreNames = new Set<string>(xeroxStores.rows.map((r) => r.store));
    for (const r of eqCounts.rows) allStoreNames.add(r.store);

    const stores = Array.from(allStoreNames).sort().map((name) => {
      const eq = eqMap.get(name);
      const equipment_count = eq ? parseInt(eq.count) : 0;
      const entry = getStoreGroup(name);
      const health = healthMap.get(name);
      return {
        name,
        mainGroup: entry?.mainGroup ?? null,
        storeGroup: entry?.storeGroup ?? null,
        holdingGroup: entry?.holdingGroup ?? null,
        equipment_count,
        machine_count: machineMap.get(name) ?? 0,
        has_data: equipment_count > 0,
        condition: eq
          ? { good: parseInt(eq.good), fair: parseInt(eq.fair), poor: parseInt(eq.poor) }
          : { good: 0, fair: 0, poor: 0 },
        monthlyVolume: volumeMap.get(name) ?? 0,
        printerHealth: health ?? { active: 0, replaceFlagged: 0 },
      };
    });

    timer.done({ storeCount: stores.length });
    return NextResponse.json({ stores });
  }).catch((err) => { timer.error(err); return serverError(err, "GET /api/equipment/all-stores"); });
}
