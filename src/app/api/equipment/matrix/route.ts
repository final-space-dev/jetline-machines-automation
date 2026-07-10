import { NextResponse } from "next/server";
import { bmsPool } from "@/lib/bms-pool";
import { xeroxPool } from "@/lib/xerox-pool";
import { EQUIPMENT_TYPES } from "@/lib/equipment-utils";
import { withClients, serverError } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { requireAdmin, AuthError } from "@/lib/auth";

export async function GET() {
  // The store x equipment-type heatmap spans all stores; admin-only.
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const timer = routeTimer("GET /api/equipment/matrix");

  return withClients([bmsPool, xeroxPool], async (eqClient, xClient) => {
    const [countsResult, xeroxStoresResult, eqOnlyStoresResult] = await Promise.all([
      eqClient.query<{ store: string; machine_type: string; count: string }>(
        `SELECT store, machine_type, COUNT(*) AS count
         FROM equipment.items
         GROUP BY store, machine_type`
      ),
      xClient.query<{ store: string }>(
        `SELECT DISTINCT store FROM xerox.printer_store_map WHERE store IS NOT NULL ORDER BY store`
      ),
      eqClient.query<{ store: string }>(
        `SELECT DISTINCT store FROM equipment.items ORDER BY store`
      ),
    ]);

    const allStores = new Set<string>(xeroxStoresResult.rows.map((r) => r.store));
    for (const r of eqOnlyStoresResult.rows) allStores.add(r.store);
    const stores = Array.from(allStores).sort();
    const types = [...EQUIPMENT_TYPES] as string[];

    const matrix: Record<string, Record<string, number>> = {};
    for (const store of stores) {
      matrix[store] = {};
      for (const type of types) matrix[store][type] = 0;
    }
    for (const row of countsResult.rows) {
      if (matrix[row.store] && types.includes(row.machine_type)) {
        matrix[row.store][row.machine_type] = parseInt(row.count);
      }
    }

    const storesWithData = new Set(eqOnlyStoresResult.rows.map((r) => r.store));
    timer.done({ stores: stores.length });
    return NextResponse.json({ stores, types, matrix, storesWithData: Array.from(storesWithData) });
  }).catch((err) => { timer.error(err); return serverError(err, "GET /api/equipment/matrix"); });
}
