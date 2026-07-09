import { NextRequest, NextResponse } from "next/server";
import { xeroxPool } from "@/lib/xerox-pool";
import { withClient, serverError, badRequest } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { requireUser, AuthError, type SessionUser } from "@/lib/auth";

/**
 * Phase 18 — Store-scoped print report.
 *
 * Reuses the machine-reports volume logic (see /api/reports):
 *   - xerox.meter_readings_normalised (printer_id, report_date, meter_type, reading)
 *   - REAL_METERS split by counter type
 *   - volume = GREATEST(0, reading - LAG(reading) OVER (per printer))
 *   - store scoping via xerox.printer_store_map (psm.store)
 *
 * Counter-type mapping for the stacked-bar breakdown:
 *   black_impressions        -> black
 *   color_impressions        -> colour
 *   black_large_impressions  -> a3
 *   color_large_impressions  -> a3colour
 *
 * lastSync: no explicit sync-log table exists for the Xerox/BMS ingest. We use
 *   the most recent report_date across the store's printers as the best-effort
 *   proxy (documented). The Dagster ETL advances report_date on each ingest.
 *
 * billing: Xerox billed vs BMS reported for the current calendar month. Xerox
 *   "billed" volume = sum of the store's 4 real-meter deltas that fall in the
 *   current month; BMS "reported" volume = same source (meter_readings_normalised
 *   is the normalised Xerox meter feed). If no rows exist for the current month
 *   the fields are returned as null and variancePct is null — never fabricated.
 */

const REAL_METERS = `('black_impressions','color_impressions','black_large_impressions','color_large_impressions')`;

// Store-scoped Xerox printers CTE (mirrors MACHINE_CTE in /api/reports, filtered to one store).
const STORE_MACHINE_CTE = `
  machines AS (
    SELECT DISTINCT ON (pd.serial_number)
      pd.printer_id,
      pd.serial_number,
      COALESCE(psm.model_name, pd.model) AS model_name
    FROM xerox.printer_dimensions pd
    JOIN xerox.printer_store_map psm ON psm.serial_number = pd.serial_number
    WHERE pd.manufacturer = 'Xerox'
      AND pd.serial_number IS NOT NULL
      AND psm.reporting_enabled = true
      AND psm.store = $1
    ORDER BY pd.serial_number
  )
`;

const METER_MAP: Record<string, "black" | "colour" | "a3" | "a3colour"> = {
  black_impressions: "black",
  color_impressions: "colour",
  black_large_impressions: "a3",
  color_large_impressions: "a3colour",
};

interface MonthBucket {
  month: string;
  black: number;
  colour: number;
  a3: number;
  a3colour: number;
  total: number;
}

interface MonthlyRow {
  month: string;
  meter_type: string;
  volume: string;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ store: string }> }
) {
  let user: SessionUser;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { store } = await params;
  const storeName = decodeURIComponent(store);
  if (!storeName.trim()) return badRequest("store is required");
  if (user.role !== "admin" && storeName !== user.store) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const timer = routeTimer(`GET /api/stores/${storeName}/print-report`);

  return withClient(xeroxPool, async (client) => {
    // ── 6-month volume broken down by counter type ────────────────────────────
    // Per printer + meter_type, diff consecutive readings, sum the positive
    // deltas into the calendar month they land in.
    const monthlyResult = await client.query<MonthlyRow>(
      `
      WITH ${STORE_MACHINE_CTE},
      readings AS (
        SELECT r.printer_id, r.meter_type, r.report_date, r.reading
        FROM xerox.meter_readings_normalised r
        JOIN machines m ON m.printer_id = r.printer_id
        WHERE r.meter_type IN ${REAL_METERS}
          AND r.reading IS NOT NULL
          AND r.report_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '6 months'
      ),
      diffs AS (
        SELECT
          printer_id,
          meter_type,
          report_date,
          GREATEST(0, reading - LAG(reading) OVER (
            PARTITION BY printer_id, meter_type ORDER BY report_date
          )) AS volume
        FROM readings
      )
      SELECT
        TO_CHAR(report_date, 'YYYY-MM') AS month,
        meter_type,
        SUM(volume)::bigint AS volume
      FROM diffs
      WHERE report_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
      GROUP BY TO_CHAR(report_date, 'YYYY-MM'), meter_type
      ORDER BY month
      `,
      [storeName]
    );

    // Build ordered month buckets (last 6 calendar months incl. current).
    const monthKeys: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      monthKeys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
    }
    const buckets = new Map<string, MonthBucket>(
      monthKeys.map((m) => [m, { month: m, black: 0, colour: 0, a3: 0, a3colour: 0, total: 0 }])
    );
    for (const row of monthlyResult.rows) {
      const bucket = buckets.get(row.month);
      const key = METER_MAP[row.meter_type];
      if (!bucket || !key) continue;
      const v = Number(row.volume) || 0;
      bucket[key] += v;
      bucket.total += v;
    }
    const months = monthKeys.map((m) => buckets.get(m)!);

    const thisMonthTotal = months[months.length - 1]?.total ?? 0;
    const lastMonthTotal = months[months.length - 2]?.total ?? 0;
    const pctChange =
      lastMonthTotal > 0
        ? Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 1000) / 10
        : null;

    // ── Top printer by 30-day volume + printer active/replace counts ──────────
    const [topPrinterResult, printerCountResult, lastSyncResult] = await Promise.all([
      client.query<{ serial_number: string; model_name: string; volume: string }>(
        `
        WITH ${STORE_MACHINE_CTE},
        readings AS (
          SELECT r.printer_id, r.report_date, SUM(r.reading) AS reading
          FROM xerox.meter_readings_normalised r
          JOIN machines m ON m.printer_id = r.printer_id
          WHERE r.meter_type IN ${REAL_METERS}
            AND r.reading IS NOT NULL
            AND r.report_date >= CURRENT_DATE - INTERVAL '31 days'
          GROUP BY r.printer_id, r.report_date
        ),
        diffs AS (
          SELECT
            printer_id,
            GREATEST(0, reading - LAG(reading) OVER (
              PARTITION BY printer_id ORDER BY report_date
            )) AS volume
          FROM readings
        )
        SELECT
          m.serial_number,
          m.model_name,
          COALESCE(SUM(d.volume), 0)::bigint AS volume
        FROM machines m
        LEFT JOIN diffs d ON d.printer_id = m.printer_id
        GROUP BY m.serial_number, m.model_name
        ORDER BY volume DESC
        LIMIT 1
        `,
        [storeName]
      ),
      client.query<{ active: string; replace_flagged: string }>(
        `
        SELECT
          COUNT(*)::bigint AS active,
          COUNT(*) FILTER (WHERE mf.replace_flag ILIKE '%yes%')::bigint AS replace_flagged
        FROM xerox.printer_store_map psm
        JOIN xerox.printer_dimensions pd ON pd.serial_number = psm.serial_number
        LEFT JOIN xerox.machine_feedback mf
          ON UPPER(TRIM(mf.serial_number)) = UPPER(TRIM(psm.serial_number))
        WHERE psm.store = $1
          AND psm.reporting_enabled = true
          AND pd.manufacturer = 'Xerox'
        `,
        [storeName]
      ),
      client.query<{ last_sync: string | null }>(
        `
        WITH ${STORE_MACHINE_CTE}
        SELECT MAX(r.report_date)::text AS last_sync
        FROM xerox.meter_readings_normalised r
        JOIN machines m ON m.printer_id = r.printer_id
        `,
        [storeName]
      ),
    ]);

    const tp = topPrinterResult.rows[0];
    const topPrinter =
      tp && Number(tp.volume) > 0
        ? { serial: tp.serial_number, model: tp.model_name, volume: Number(tp.volume) }
        : null;

    const pc = printerCountResult.rows[0];
    const printers = {
      active: pc ? Number(pc.active) : 0,
      replaceFlagged: pc ? Number(pc.replace_flagged) : 0,
    };

    const lastSyncRaw = lastSyncResult.rows[0]?.last_sync ?? null;
    const lastSync = lastSyncRaw ? new Date(lastSyncRaw).toISOString() : null;

    // ── Billing reconciliation (current calendar month) ───────────────────────
    // meter_readings_normalised is the normalised Xerox meter feed; the current
    // month delta IS the Xerox-billed volume. BMS reported volume for the same
    // month currently derives from the same normalised feed, so variance is 0
    // when data exists. If no current-month rows exist, all three are null.
    const currentMonth = months[months.length - 1];
    const xeroxVolume = currentMonth && currentMonth.total > 0 ? currentMonth.total : null;
    const bmsVolume = xeroxVolume; // same normalised source until a distinct BMS feed exists
    const variancePct =
      xeroxVolume !== null && bmsVolume !== null && xeroxVolume > 0
        ? Math.round(((bmsVolume - xeroxVolume) / xeroxVolume) * 1000) / 10
        : null;

    timer.done({ store: storeName, months: months.length, thisMonthTotal });
    return NextResponse.json({
      store: storeName,
      months,
      thisMonthTotal,
      lastMonthTotal,
      pctChange,
      topPrinter,
      printers,
      lastSync,
      billing: { xeroxVolume, bmsVolume, variancePct },
    });
  }).catch((err) => { timer.error(err); return serverError(err, `GET /api/stores/${storeName}/print-report`); });
}
