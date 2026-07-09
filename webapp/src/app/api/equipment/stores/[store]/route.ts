import { NextRequest, NextResponse } from "next/server";
import { bmsPool } from "@/lib/bms-pool";
import { xeroxPool } from "@/lib/xerox-pool";
import { withClients, serverError } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { requireUser, AuthError } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ store: string }> }
) {
  const { store } = await params;
  const storeName = decodeURIComponent(store);

  // Require a signed-in user; store staff may only read their own store.
  try {
    const user = await requireUser();
    if (user.role !== "admin" && user.store !== storeName) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const timer = routeTimer(`GET /api/equipment/stores/${storeName}`);

  return withClients([bmsPool, xeroxPool], async (eqClient, xClient) => {
    const [eqResult, machinesResult] = await Promise.all([
      eqClient.query(
        `SELECT * FROM equipment.items WHERE store = $1 ORDER BY machine_type, id`,
        [storeName]
      ),
      xClient.query(
        `SELECT pd.serial_number, COALESCE(psm.model_name, pd.model) AS model_name,
                psm.printer_type, pd.last_seen::text,
                mf.condition_notes, mf.replace_flag, mf.age
         FROM xerox.printer_dimensions pd
         JOIN xerox.printer_store_map psm ON psm.serial_number = pd.serial_number
         LEFT JOIN xerox.machine_feedback mf ON UPPER(TRIM(mf.serial_number)) = UPPER(TRIM(pd.serial_number))
         WHERE psm.store = $1
           AND pd.manufacturer = 'Xerox'
           AND psm.reporting_enabled = true
         ORDER BY pd.serial_number`,
        [storeName]
      ),
    ]);

    timer.done({ store: storeName, equipment: eqResult.rows.length, machines: machinesResult.rows.length });
    return NextResponse.json({
      store: storeName,
      machines: machinesResult.rows,
      equipment: eqResult.rows,
    });
  }).catch((err) => { timer.error(err); return serverError(err, `GET /api/equipment/stores/${storeName}`); });
}
