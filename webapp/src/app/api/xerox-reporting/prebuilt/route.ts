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
        daily_volume: number | null;
        running_balance: number | null;
      }>(
        `WITH daily_vols AS (
          SELECT
            mv.printer_id,
            mv.date AS report_date,
            SUM(mv.volume) AS daily_volume
          FROM xerox.meter_volumes mv
          GROUP BY mv.printer_id, mv.date
        )
        SELECT
          psm.store,
          psm.company_group,
          pd.serial_number,
          pd.model,
          COALESCE(psm.printer_type, 'Unknown') AS printer_type,
          dv.report_date::text,
          dv.daily_volume::bigint AS daily_volume,
          SUM(dv.daily_volume) OVER (
            PARTITION BY dv.printer_id
            ORDER BY dv.report_date
          )::bigint AS running_balance
        FROM daily_vols dv
        JOIN xerox.printer_dimensions pd ON pd.printer_id = dv.printer_id
        INNER JOIN xerox.printer_store_map psm ON psm.serial_number = pd.serial_number
        ORDER BY dv.report_date DESC, psm.company_group NULLS LAST, psm.store NULLS LAST, pd.serial_number`
      );

      return NextResponse.json({ data: result.rows, rowCount: result.rows.length });
    }

    if (report === "reading-frequency") {
      // Total distinct reading dates across all machines (= total unique emails/reports received)
      const totalResult = await client.query<{ total_report_days: string }>(
        `SELECT COUNT(DISTINCT report_date) AS total_report_days FROM xerox.meter_readings_normalised`
      );
      const totalReportDays = Number(totalResult.rows[0]?.total_report_days ?? 0);

      const result = await client.query<{
        serial_number: string;
        store: string | null;
        company_group: string | null;
        model: string;
        printer_type: string | null;
        unique_readings: string;
        first_reading_date: string | null;
        last_reading_date: string | null;
        days_in_range: string | null;
        success_rate: string | null;
      }>(
        `WITH per_machine AS (
          SELECT
            mr.printer_id,
            COUNT(DISTINCT mr.reading_date::date) AS unique_readings,
            MIN(mr.report_date)::text            AS first_reading_date,
            MAX(mr.report_date)::text            AS last_reading_date,
            (MAX(mr.report_date) - MIN(mr.report_date) + 1) AS days_in_range
          FROM xerox.meter_readings_normalised mr
          GROUP BY mr.printer_id
        )
        SELECT
          pd.serial_number,
          psm.store,
          psm.company_group,
          pd.model,
          COALESCE(psm.printer_type, 'Unknown') AS printer_type,
          pm.unique_readings::text,
          pm.first_reading_date,
          pm.last_reading_date,
          pm.days_in_range::text,
          CASE
            WHEN $1 > 0 THEN ROUND((pm.unique_readings::numeric / $1) * 100, 1)::text
            ELSE NULL
          END AS success_rate
        FROM per_machine pm
        JOIN xerox.printer_dimensions pd ON pd.printer_id = pm.printer_id
        INNER JOIN xerox.printer_store_map psm ON psm.serial_number = pd.serial_number
        ORDER BY pm.unique_readings ASC, psm.company_group NULLS LAST, psm.store NULLS LAST, pd.serial_number`,
        [totalReportDays]
      );

      return NextResponse.json({
        data: result.rows,
        totalReportDays,
        rowCount: result.rows.length,
      });
    }

    if (report === "bms-machines") {
      // BMS machines that are mapped as Xerox (in printer_store_map), flagged by whether
      // Xerox portal has ever seen them (exists in printer_dimensions)
      const bmsRows = await prisma.machine.findMany({
        select: {
          serialNumber: true,
          machineName: true,
          makeName: true,
          modelName: true,
          status: true,
          bmsStatus: true,
          installDate: true,
          company: { select: { name: true } },
          category: { select: { name: true } },
        },
        orderBy: [{ company: { name: "asc" } }, { serialNumber: "asc" }],
      });

      // Get all serials in the Xerox printer_store_map (= Xerox-enrolled machines)
      const psmResult = await client.query<{ serial_number: string }>(
        `SELECT serial_number FROM xerox.printer_store_map`
      );
      const psmSerials = new Set(
        psmResult.rows.map((r) => (r.serial_number ?? "").trim().toUpperCase()).filter(Boolean)
      );

      // Get all serials in Xerox printer_dimensions (= actively in Xerox portal)
      const dimResult = await client.query<{ serial_number: string }>(
        `SELECT serial_number FROM xerox.printer_dimensions`
      );
      const dimSerials = new Set(
        dimResult.rows.map((r) => (r.serial_number ?? "").trim().toUpperCase()).filter(Boolean)
      );

      // Only return BMS machines that are in the store map (Xerox machines)
      const data = bmsRows
        .filter((m) => m.serialNumber && psmSerials.has(m.serialNumber.trim().toUpperCase()))
        .map((m) => ({
          serial_number: m.serialNumber,
          company_name: m.company.name,
          category: m.category?.name ?? null,
          model_name: m.modelName ?? null,
          bms_status: m.bmsStatus,
          install_date: m.installDate ? m.installDate.toISOString().split("T")[0] : null,
          in_xerox_portal: dimSerials.has(m.serialNumber.trim().toUpperCase()),
        }));

      return NextResponse.json({ data, rowCount: data.length });
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
