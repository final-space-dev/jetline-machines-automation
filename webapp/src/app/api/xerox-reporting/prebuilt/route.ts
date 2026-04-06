import { NextRequest, NextResponse } from "next/server";
import { xeroxPool } from "@/lib/xerox-pool";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const report = request.nextUrl.searchParams.get("report") ?? "not-transmitting";
  const client = await xeroxPool.connect();

  try {
    if (report === "not-transmitting") {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      const cutoffStr = cutoff.toISOString().split("T")[0];

      const result = await client.query<{
        serial_number: string;
        store: string | null;
        company_group: string | null;
        model: string;
        asset_status: string;
        printer_type: string | null;
        last_reading_date: string | null;
      }>(
        `SELECT
          pd.serial_number,
          psm.store,
          psm.company_group,
          pd.model,
          pd.asset_status,
          COALESCE(psm.printer_type, 'Unknown') AS printer_type,
          MAX(mr.report_date)::text AS last_reading_date
        FROM xerox.printer_dimensions pd
        INNER JOIN xerox.printer_store_map psm ON psm.serial_number = pd.serial_number
        LEFT JOIN xerox.meter_readings_normalised mr ON mr.printer_id = pd.printer_id
        GROUP BY pd.printer_id, pd.serial_number, psm.store, psm.company_group, pd.model, pd.asset_status, psm.printer_type
        HAVING MAX(mr.report_date) IS NULL OR MAX(mr.report_date) < $1
        ORDER BY psm.company_group NULLS LAST, psm.store NULLS LAST, pd.serial_number`,
        [cutoffStr]
      );

      return NextResponse.json({ data: result.rows, rowCount: result.rows.length });
    }

    if (report === "machine-age") {
      const result = await client.query<{
        serial_number: string;
        store: string | null;
        company_group: string | null;
        model: string;
        asset_status: string;
        printer_type: string | null;
        original_install_date: string | null;
        age_years: number | null;
        last_reading_date: string | null;
      }>(
        `SELECT
          pd.serial_number,
          psm.store,
          psm.company_group,
          pd.model,
          pd.asset_status,
          COALESCE(psm.printer_type, 'Unknown') AS printer_type,
          psm.original_install_date::text,
          CASE WHEN psm.original_install_date IS NOT NULL
            THEN EXTRACT(EPOCH FROM (now() - psm.original_install_date)) / 86400.0 / 365.25
            ELSE NULL
          END AS age_years,
          MAX(mr.report_date)::text AS last_reading_date
        FROM xerox.printer_dimensions pd
        INNER JOIN xerox.printer_store_map psm ON psm.serial_number = pd.serial_number
        LEFT JOIN xerox.meter_readings_normalised mr ON mr.printer_id = pd.printer_id
        GROUP BY pd.printer_id, pd.serial_number, psm.store, psm.company_group, pd.model, pd.asset_status, psm.original_install_date, psm.printer_type
        ORDER BY psm.original_install_date ASC NULLS LAST, psm.store NULLS LAST`
      );

      return NextResponse.json({ data: result.rows, rowCount: result.rows.length });
    }

    if (report === "last-balance") {
      const result = await client.query<{
        store: string | null;
        company_group: string | null;
        model: string;
        serial_number: string;
        printer_type: string | null;
        black_rdg: string | null;
        black_large_rdg: string | null;
        color_rdg: string | null;
        color_large_rdg: string | null;
        total_rdg: string | null;
        last_reading_date: string | null;
      }>(
        `SELECT
          psm.store,
          psm.company_group,
          pd.model,
          pd.serial_number,
          COALESCE(psm.printer_type, 'Unknown') AS printer_type,
          MAX(CASE WHEN mr.meter_type = 'black_impressions'       THEN mr.reading END)::bigint AS black_rdg,
          MAX(CASE WHEN mr.meter_type = 'black_large_impressions' THEN mr.reading END)::bigint AS black_large_rdg,
          MAX(CASE WHEN mr.meter_type = 'color_impressions'       THEN mr.reading END)::bigint AS color_rdg,
          MAX(CASE WHEN mr.meter_type = 'color_large_impressions' THEN mr.reading END)::bigint AS color_large_rdg,
          MAX(CASE WHEN mr.meter_type = 'total_impressions'       THEN mr.reading END)::bigint AS total_rdg,
          MAX(mr.report_date)::text AS last_reading_date
        FROM xerox.printer_dimensions pd
        INNER JOIN xerox.printer_store_map psm ON psm.serial_number = pd.serial_number
        LEFT JOIN xerox.meter_readings_normalised mr ON mr.printer_id = pd.printer_id
        GROUP BY pd.printer_id, pd.serial_number, psm.store, psm.company_group, pd.model, psm.printer_type
        ORDER BY psm.company_group NULLS LAST, psm.store NULLS LAST, pd.model, pd.serial_number`
      );

      return NextResponse.json({ data: result.rows, rowCount: result.rows.length });
    }

    if (report === "monthly-volume") {
      const monthsResult = await client.query<{ month: string }>(
        `SELECT DISTINCT to_char(date, 'YYYY-MM') AS month
         FROM xerox.meter_volumes
         ORDER BY month DESC`
      );
      const months = monthsResult.rows.map((r) => r.month);

      if (months.length === 0) {
        return NextResponse.json({ data: [], months: [], rowCount: 0 });
      }

      const volResult = await client.query<{
        printer_id: number;
        month: string;
        total_vol: string;
      }>(
        `SELECT
          printer_id,
          to_char(date, 'YYYY-MM') AS month,
          SUM(volume)::bigint AS total_vol
         FROM xerox.meter_volumes
         GROUP BY printer_id, to_char(date, 'YYYY-MM')`
      );

      const volMap = new Map<number, Map<string, number>>();
      for (const row of volResult.rows) {
        if (!volMap.has(row.printer_id)) volMap.set(row.printer_id, new Map());
        volMap.get(row.printer_id)!.set(row.month, Number(row.total_vol));
      }

      const dimsResult = await client.query<{
        printer_id: number;
        serial_number: string;
        model: string;
        asset_status: string;
        store: string | null;
        company_group: string | null;
      }>(
        `SELECT
          pd.printer_id,
          pd.serial_number,
          pd.model,
          pd.asset_status,
          psm.store,
          psm.company_group
         FROM xerox.printer_dimensions pd
         INNER JOIN xerox.printer_store_map psm ON psm.serial_number = pd.serial_number`
      );

      const data = dimsResult.rows.map((dim) => {
        const monthVols = volMap.get(dim.printer_id) ?? new Map();
        const row: Record<string, string | number | null> = {
          serialNumber: dim.serial_number,
          store: dim.store ?? null,
          companyGroup: dim.company_group ?? null,
          model: dim.model,
          assetStatus: dim.asset_status,
        };
        for (const m of months) {
          row[m] = monthVols.get(m) ?? null;
        }
        return row;
      });

      data.sort((a, b) =>
        ((a.companyGroup as string) ?? "").localeCompare((b.companyGroup as string) ?? "") ||
        ((a.store as string) ?? "").localeCompare((b.store as string) ?? "") ||
        ((a.serialNumber as string) ?? "").localeCompare((b.serialNumber as string) ?? "")
      );

      return NextResponse.json({ data, months, rowCount: data.length });
    }

    if (report === "no-data") {
      // Get all BMS serial numbers for cross-reference
      const bmsSerials = await prisma.machine.findMany({ select: { serialNumber: true } });
      const bmsSerialSet = new Set(bmsSerials.map((m) => m.serialNumber.trim().toUpperCase()));

      const result = await client.query<{
        serial_number: string;
        store: string | null;
        company_group: string | null;
        model: string;
        printer_type: string | null;
      }>(
        `SELECT
          pd.serial_number,
          psm.store,
          psm.company_group,
          pd.model,
          COALESCE(psm.printer_type, 'Unknown') AS printer_type
        FROM xerox.printer_dimensions pd
        LEFT JOIN xerox.printer_store_map psm ON psm.serial_number = pd.serial_number
        WHERE NOT EXISTS (
          SELECT 1 FROM xerox.meter_readings_normalised mr WHERE mr.printer_id = pd.printer_id
        )
        ORDER BY psm.company_group NULLS LAST, psm.store NULLS LAST, pd.serial_number`
      );

      const data = result.rows.map((row) => ({
        ...row,
        in_bms: row.serial_number ? bmsSerialSet.has(row.serial_number.trim().toUpperCase()) : false,
      }));

      return NextResponse.json({ data, rowCount: data.length });
    }

    if (report === "daily") {
      const result = await client.query<{
        store: string | null;
        company_group: string | null;
        serial_number: string;
        model: string;
        printer_type: string;
        report_date: string;
        total_movement: number | null;
        anomaly: string | null;
      }>(
        `WITH daily_vols AS (
          SELECT
            mv.printer_id,
            mv.date AS report_date,
            SUM(mv.volume) AS total_movement,
            bool_or(mv.volume < 0) AS has_negative
          FROM xerox.meter_volumes mv
          GROUP BY mv.printer_id, mv.date
        ),
        rolling AS (
          SELECT
            printer_id,
            report_date,
            total_movement,
            has_negative,
            AVG(total_movement) OVER (
              PARTITION BY printer_id
              ORDER BY report_date
              ROWS BETWEEN 7 PRECEDING AND 1 PRECEDING
            ) AS rolling_avg
          FROM daily_vols
        ),
        printer_has_nonzero AS (
          SELECT DISTINCT printer_id
          FROM daily_vols
          WHERE total_movement > 0
        )
        SELECT
          psm.store,
          psm.company_group,
          pd.serial_number,
          pd.model,
          COALESCE(psm.printer_type, 'Unknown') AS printer_type,
          r.report_date::text,
          r.total_movement::bigint AS total_movement,
          CASE
            WHEN r.has_negative THEN 'Negative'
            WHEN r.total_movement = 0 AND phnz.printer_id IS NOT NULL THEN 'Zero'
            WHEN r.rolling_avg IS NOT NULL AND r.rolling_avg > 0 AND r.total_movement > r.rolling_avg * 3 THEN 'Spike'
            ELSE NULL
          END AS anomaly
        FROM rolling r
        JOIN xerox.printer_dimensions pd ON pd.printer_id = r.printer_id
        INNER JOIN xerox.printer_store_map psm ON psm.serial_number = pd.serial_number
        LEFT JOIN printer_has_nonzero phnz ON phnz.printer_id = r.printer_id
        ORDER BY r.report_date DESC, psm.company_group NULLS LAST, psm.store NULLS LAST, pd.serial_number`
      );

      return NextResponse.json({ data: result.rows, rowCount: result.rows.length });
    }

    return NextResponse.json({ error: "Unknown report" }, { status: 400 });

  } catch (error) {
    console.error("[xerox-reporting/prebuilt] error:", error);
    return NextResponse.json(
      { error: "Failed to generate report", detail: String(error) },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
