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
                mf.condition_notes, mf.replace_flag, mf.age,
                mf.install_date::text AS install_date,
                bal.latest_balance,
                bal.latest_balance_date::text AS latest_balance_date
         FROM xerox.printer_dimensions pd
         JOIN xerox.printer_store_map psm ON psm.serial_number = pd.serial_number
         LEFT JOIN xerox.machine_feedback mf ON UPPER(TRIM(mf.serial_number)) = UPPER(TRIM(pd.serial_number))
         -- Latest meter balance: sum of the real meters at the most recent
         -- report_date for this printer (its current running total).
         LEFT JOIN LATERAL (
           SELECT r.report_date AS latest_balance_date,
                  SUM(r.reading)::bigint AS latest_balance
           FROM xerox.meter_readings_normalised r
           WHERE r.printer_id = pd.printer_id
             AND r.meter_type IN
               ('black_impressions','color_impressions','black_large_impressions','color_large_impressions')
             AND r.reading IS NOT NULL
             AND r.report_date = (
               SELECT MAX(r2.report_date)
               FROM xerox.meter_readings_normalised r2
               WHERE r2.printer_id = pd.printer_id
                 AND r2.meter_type IN
                   ('black_impressions','color_impressions','black_large_impressions','color_large_impressions')
                 AND r2.reading IS NOT NULL
             )
           GROUP BY r.report_date
         ) bal ON TRUE
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
