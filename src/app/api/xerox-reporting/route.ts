import { NextRequest, NextResponse } from "next/server";
import { xeroxPool, parseSiteName } from "@/lib/xerox-pool";

export async function GET(request: NextRequest) {
  const client = await xeroxPool.connect();
  try {
    const searchParams = request.nextUrl.searchParams;

    const today = new Date();
    const defaultTo = today.toISOString().split("T")[0];
    const defaultFrom = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const from = searchParams.get("from") || defaultFrom;
    const to = searchParams.get("to") || defaultTo;

    // 1. Get all distinct available dates
    const datesResult = await client.query<{ date: string }>(
      `SELECT DISTINCT date::text FROM xerox.meter_volumes ORDER BY date DESC`
    );
    const availableDates = datesResult.rows.map((r) => r.date);

    // 2. Aggregate volumes per printer + meter_type over the date range
    const volResult = await client.query<{
      printer_id: number;
      meter_type: string;
      total_volume: string;
      any_estimated: boolean;
    }>(
      `SELECT
        printer_id,
        meter_type,
        SUM(volume)::bigint AS total_volume,
        bool_or(is_estimated) AS any_estimated
      FROM xerox.meter_volumes
      WHERE date BETWEEN $1 AND $2
      GROUP BY printer_id, meter_type`,
      [from, to]
    );

    // 3. Latest reading per printer (across all meter types — most recent date any reading was captured)
    const lastRdgResult = await client.query<{
      printer_id: number;
      last_reading_date: string;
    }>(
      `SELECT printer_id, MAX(report_date)::text AS last_reading_date
       FROM xerox.meter_readings_normalised
       GROUP BY printer_id`
    );

    // 4. Printer dimensions + store map join + printer_type from psm
    const dimsResult = await client.query<{
      printer_id: number;
      serial_number: string;
      model: string;
      service_plan: string;
      price_plan: string;
      asset_status: string;
      store: string | null;
      company_group: string | null;
      install_date: string | null;
      printer_type: string | null;
    }>(
      `SELECT
        pd.printer_id,
        pd.serial_number,
        pd.model,
        pd.service_plan,
        pd.price_plan,
        pd.asset_status,
        psm.store,
        psm.company_group,
        psm.install_date::text,
        COALESCE(psm.printer_type, 'Unknown') AS printer_type
      FROM xerox.printer_dimensions pd
      INNER JOIN xerox.printer_store_map psm ON psm.serial_number = pd.serial_number`
    );

    // Build lookup maps
    type VolumeKey = `${number}:${string}`;
    const volMap = new Map<
      VolumeKey,
      { volume: number | null; anyEstimated: boolean }
    >();
    for (const row of volResult.rows) {
      const key: VolumeKey = `${row.printer_id}:${row.meter_type}`;
      volMap.set(key, {
        volume: row.total_volume != null ? Number(row.total_volume) : null,
        anyEstimated: row.any_estimated,
      });
    }

    const lastRdgMap = new Map<number, string>();
    for (const row of lastRdgResult.rows) {
      lastRdgMap.set(row.printer_id, row.last_reading_date);
    }

    const getVol = (printerId: number, meterType: string) =>
      volMap.get(`${printerId}:${meterType}` as VolumeKey)?.volume ?? null;
    const getEstimated = (printerId: number, meterType: string) =>
      volMap.get(`${printerId}:${meterType}` as VolumeKey)?.anyEstimated ?? false;

    // Build one row per printer
    const data = dimsResult.rows.map((dim) => {
      const pid = dim.printer_id;

      const totalVol = getVol(pid, "total_impressions");
      const blackVol = getVol(pid, "black_impressions");

      // Daily avg: use total vol if available, else black vol
      const lastRdgDate = lastRdgMap.get(pid) ?? null;

      const anyEstimated =
        getEstimated(pid, "black_impressions") ||
        getEstimated(pid, "black_large_impressions") ||
        getEstimated(pid, "color_impressions") ||
        getEstimated(pid, "color_large_impressions") ||
        getEstimated(pid, "total_impressions");

      return {
        printerId: pid,
        serialNumber: dim.serial_number ?? "",
        store: dim.store ?? null,
        companyGroup: dim.company_group ?? null,
        model: dim.model ?? "",
        servicePlan: dim.service_plan ?? "",
        pricePlan: dim.price_plan ?? "",
        assetStatus: dim.asset_status ?? "",
        printerType: dim.printer_type ?? "Unknown",
        installDate: dim.install_date ?? null,
        lastReadingDate: lastRdgDate,
        blackVol,
        blackLargeVol: getVol(pid, "black_large_impressions"),
        colorVol: getVol(pid, "color_impressions"),
        colorLargeVol: getVol(pid, "color_large_impressions"),
        totalVol,
        anyEstimated,
      };
    });

    return NextResponse.json({
      data,
      from,
      to,
      availableDates,
      rowCount: data.length,
    });
  } catch (error) {
    console.error("[xerox-reporting] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch xerox reporting data", detail: String(error) },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
