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
      // Get the 7 most recent distinct report dates across all machines
      const datesResult = await client.query<{ report_date: string }>(
        `SELECT DISTINCT report_date::text
         FROM xerox.meter_readings_normalised
         ORDER BY report_date DESC
         LIMIT 7`
      );
      const dates = datesResult.rows.map((r) => r.report_date); // newest first

      if (dates.length === 0) {
        return NextResponse.json({ data: [], dates: [], rowCount: 0 });
      }

      // All machines in store map + their per-day volumes for the 7-day window
      // + their actual latest reading (regardless of window)
      const rawResult = await client.query<{
        printer_id: number;
        serial_number: string;
        store: string | null;
        company_group: string | null;
        model: string;
        printer_type: string;
        report_date: string | null;
        daily_volume: string | null;
        latest_balance: string | null;
      }>(
        `WITH all_machines AS (
          SELECT
            pd.printer_id,
            pd.serial_number,
            psm.store,
            psm.company_group,
            pd.model,
            COALESCE(psm.printer_type, 'Unknown') AS printer_type
          FROM xerox.printer_dimensions pd
          INNER JOIN xerox.printer_store_map psm ON psm.serial_number = pd.serial_number
        ),
        -- For each printer+date in the window, get the total_impressions reading
        readings_in_window AS (
          SELECT
            printer_id,
            report_date,
            reading
          FROM xerox.meter_readings_normalised
          WHERE meter_type = 'total_impressions'
            AND reading IS NOT NULL
            AND report_date = ANY($1::date[])
        ),
        -- For each printer+date, get the previous reading (closest before that date)
        prev_readings AS (
          SELECT
            r.printer_id,
            r.report_date,
            r.reading AS curr_reading,
            (
              SELECT prev.reading
              FROM xerox.meter_readings_normalised prev
              WHERE prev.printer_id = r.printer_id
                AND prev.meter_type = 'total_impressions'
                AND prev.reading IS NOT NULL
                AND prev.report_date < r.report_date
              ORDER BY prev.report_date DESC
              LIMIT 1
            ) AS prev_reading
          FROM readings_in_window r
        ),
        daily_vols AS (
          SELECT
            printer_id,
            report_date::text AS report_date,
            CASE
              WHEN prev_reading IS NOT NULL AND curr_reading >= prev_reading
              THEN (curr_reading - prev_reading)::bigint
              ELSE NULL
            END AS daily_volume
          FROM prev_readings
        ),
        latest_bal AS (
          SELECT DISTINCT ON (printer_id)
            printer_id,
            reading::bigint AS latest_balance
          FROM xerox.meter_readings_normalised
          WHERE meter_type = 'total_impressions'
            AND reading IS NOT NULL
          ORDER BY printer_id, report_date DESC
        )
        SELECT
          am.printer_id,
          am.serial_number,
          am.store,
          am.company_group,
          am.model,
          am.printer_type,
          dv.report_date,
          dv.daily_volume::text,
          lb.latest_balance::text
        FROM all_machines am
        LEFT JOIN daily_vols dv ON dv.printer_id = am.printer_id
        LEFT JOIN latest_bal lb ON lb.printer_id = am.printer_id
        ORDER BY am.company_group NULLS LAST, am.store NULLS LAST, am.serial_number, dv.report_date`,
        [dates]
      );

      // Pivot: one row per machine, with vol_YYYY-MM-DD columns + latest_balance
      const machineMap = new Map<number, Record<string, string | number | null>>();
      for (const row of rawResult.rows) {
        if (!machineMap.has(row.printer_id)) {
          machineMap.set(row.printer_id, {
            serial_number: row.serial_number,
            store: row.store,
            company_group: row.company_group,
            model: row.model,
            printer_type: row.printer_type,
            latest_balance: row.latest_balance !== null ? Number(row.latest_balance) : null,
          });
        }
        if (row.report_date !== null) {
          const machine = machineMap.get(row.printer_id)!;
          machine[`vol_${row.report_date}`] = row.daily_volume !== null ? Number(row.daily_volume) : null;
        }
      }

      const data = Array.from(machineMap.values());

      return NextResponse.json({ data, dates, rowCount: data.length });
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
      // Full outer join: Xerox portal (printer_dimensions) vs BMS store map (printer_store_map)
      // Shows every serial that appears on either side, flagging which side it appears on.
      // - In Xerox only  → Xerox billing us but BMS has no record (ghost billing?)
      // - In BMS only    → BMS knows it but Xerox dropped it (decommissioned/removed?)
      // - In both        → normal, matched machine
      // Pull bms_status + model from the synced machines table in jetline_machines
      const bmsStatusRows = await prisma.machine.findMany({
        select: { serialNumber: true, bmsStatus: true, modelName: true },
      });
      const bmsStatusMap = new Map(bmsStatusRows.map((m) => [m.serialNumber.trim().toUpperCase(), { bmsStatus: m.bmsStatus, modelName: m.modelName }]));

      const result = await client.query<{
        serial_number: string;
        store: string | null;
        company_group: string | null;
        model: string | null;
        printer_type: string | null;
        in_xerox: boolean;
        in_bms: boolean;
        has_readings: boolean;
      }>(
        `SELECT
          COALESCE(pd.serial_number, psm.serial_number) AS serial_number,
          psm.store,
          psm.company_group,
          pd.model,
          COALESCE(psm.printer_type, 'Unknown') AS printer_type,
          (pd.serial_number IS NOT NULL) AS in_xerox,
          (psm.serial_number IS NOT NULL) AS in_bms,
          EXISTS (
            SELECT 1 FROM xerox.meter_readings_normalised mr WHERE mr.printer_id = pd.printer_id
          ) AS has_readings
        FROM xerox.printer_dimensions pd
        FULL OUTER JOIN xerox.printer_store_map psm ON psm.serial_number = pd.serial_number
        ORDER BY
          psm.company_group NULLS LAST,
          psm.store NULLS LAST,
          COALESCE(pd.serial_number, psm.serial_number)`
      );

      const data = result.rows.map((r) => {
        const bms = bmsStatusMap.get((r.serial_number ?? "").trim().toUpperCase());
        return {
          ...r,
          model: r.model ?? bms?.modelName ?? null,
          bms_status: bms?.bmsStatus ?? null,
        };
      });

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
