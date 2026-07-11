import { NextRequest, NextResponse } from "next/server";
import { bmsPool } from "@/lib/bms-pool";
import { xeroxPool } from "@/lib/xerox-pool";
import { withClients, serverError } from "@/lib/api-utils";
import { requireUser, AuthError } from "@/lib/auth";
import { STORE_GROUPS } from "@/lib/store-groups";
import { routeTimer } from "@/lib/logger";

/**
 * Phase 15 — Global cross-entity search.
 *
 * GET /api/search?q=term
 *   Runs three lookups in parallel:
 *     - stores:   STORE_GROUPS filtered by name (instant, in-memory)
 *     - items:    equipment.items ILIKE make_model/serial/store/machine_type (bmsPool)
 *     - printers: xerox.printer_dimensions + printer_store_map ILIKE serial/model/store (xeroxPool)
 *
 * Returns { stores, items, printers }. Empty/blank q returns empty arrays.
 * q is capped at 100 chars.
 */

interface StoreHit {
  name: string;
  mainGroup: string;
  storeGroup: string;
}
interface ItemHit {
  id: number;
  make_model: string | null;
  machine_type: string;
  store: string;
  condition: string | null;
}
interface PrinterHit {
  serial: string;
  model: string | null;
  store: string;
}

export async function GET(req: NextRequest) {
  const timer = routeTimer("GET /api/search");
  try {
    await requireUser();

    const raw = req.nextUrl.searchParams.get("q") ?? "";
    const q = raw.trim().slice(0, 100);

    if (!q) {
      timer.done({ q: "", hits: 0 });
      return NextResponse.json({ stores: [], items: [], printers: [] });
    }

    const like = `%${q}%`;
    const needle = q.toLowerCase();

    const stores: StoreHit[] = STORE_GROUPS.filter((e) =>
      e.store.toLowerCase().includes(needle)
    )
      .slice(0, 6)
      .map((e) => ({
        name: e.store,
        mainGroup: e.mainGroup,
        storeGroup: e.storeGroup,
      }));

    const { items, printers } = await withClients(
      [bmsPool, xeroxPool],
      async (bmsClient, xeroxClient) => {
        const [itemsResult, printersResult] = await Promise.all([
          bmsClient.query<ItemHit>(
            `SELECT id, make_model, machine_type, store, condition
             FROM equipment.items
             WHERE deleted_at IS NULL
               AND (make_model ILIKE $1
                OR serial ILIKE $1
                OR store ILIKE $1
                OR machine_type ILIKE $1)
             ORDER BY store, machine_type
             LIMIT 5`,
            [like]
          ),
          xeroxClient.query<PrinterHit>(
            `SELECT pd.serial_number AS serial,
                    COALESCE(psm.model_name, pd.model) AS model,
                    psm.store AS store
             FROM xerox.printer_dimensions pd
             JOIN xerox.printer_store_map psm ON psm.serial_number = pd.serial_number
             WHERE pd.serial_number ILIKE $1
                OR COALESCE(psm.model_name, pd.model) ILIKE $1
                OR psm.store ILIKE $1
             ORDER BY pd.serial_number
             LIMIT 5`,
            [like]
          ),
        ]);
        return { items: itemsResult.rows, printers: printersResult.rows };
      }
    );

    timer.done({ q, stores: stores.length, items: items.length, printers: printers.length });
    return NextResponse.json({ stores, items, printers });
  } catch (err) {
    if (err instanceof AuthError) {
      timer.done({ auth: err.status });
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    timer.error(err);
    return serverError(err, "GET /api/search");
  }
}
