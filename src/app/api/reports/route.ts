import { NextRequest, NextResponse } from "next/server";
import { xeroxPool } from "@/lib/xerox-pool";
import { bmsPool } from "@/lib/bms-pool";
import { requireCapability, AuthError } from "@/lib/auth";

// xerox.meter_readings_normalised: printer_id, report_date, meter_type, reading
// Volume = sum of 4 sub-meters (NOT total_impressions which excludes A3)
// xerox.meter_volumes: printer_id, date, volume (pre-aggregated by Dagster)

const MACHINE_CTE = `
  machines AS (
    SELECT DISTINCT ON (pd.serial_number)
      pd.printer_id,
      pd.serial_number,
      COALESCE(psm.model_name, pd.model) AS model_name,
      psm.store,
      psm.company_group,
      psm.printer_type
    FROM xerox.printer_dimensions pd
    JOIN xerox.printer_store_map psm ON psm.serial_number = pd.serial_number
    WHERE pd.manufacturer = 'Xerox'
      AND pd.serial_number IS NOT NULL
      AND psm.reporting_enabled = true
      AND (psm.store IS NOT NULL OR psm.company_group IS NOT NULL)
    ORDER BY pd.serial_number
  )
`;

const REAL_METERS = `('black_impressions','color_impressions','black_large_impressions','color_large_impressions')`;

async function getBmsInstallDates(): Promise<Map<string, string>> {
  const bmsClient = await bmsPool.connect();
  try {
    const r = await bmsClient.query<{ serial_number: string; installed_date: string }>(
      `SELECT serial_number, installed_date::text FROM machines.machines WHERE installed_date IS NOT NULL`
    );
    return new Map(r.rows.map((row) => [row.serial_number.trim().toUpperCase(), row.installed_date]));
  } finally {
    bmsClient.release();
  }
}

export async function GET(request: NextRequest) {
  // Reports are fleet-wide, admin-only (store staff are scoped to their store).
  try {
    await requireCapability("nav:machine-reports");
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { searchParams } = request.nextUrl;
  const tab = searchParams.get("tab") ?? "summary";
  const client = await xeroxPool.connect();

  try {
    // ── SUMMARY: max/avg daily vol, min/max monthly vol per machine ───────────
    if (tab === "summary") {
      const result = await client.query(`
        WITH ${MACHINE_CTE},
        -- Daily volumes from meter_readings_normalised (diff between consecutive readings)
        true_total AS (
          SELECT printer_id, report_date, SUM(reading) AS reading
          FROM xerox.meter_readings_normalised
          WHERE meter_type IN ${REAL_METERS} AND reading IS NOT NULL
          GROUP BY printer_id, report_date
        ),
        daily_diffs AS (
          SELECT
            printer_id,
            report_date,
            GREATEST(0, reading - LAG(reading) OVER (PARTITION BY printer_id ORDER BY report_date)) AS volume
          FROM true_total
        ),
        daily_stats AS (
          SELECT
            printer_id,
            MAX(volume)                                              AS max_daily_vol,
            ROUND(AVG(volume) FILTER (WHERE volume > 0))::bigint    AS avg_daily_vol,
            COUNT(*) FILTER (WHERE volume > 0)                       AS reading_days,
            MAX(report_date)::text                                   AS last_reading
          FROM daily_diffs
          WHERE volume IS NOT NULL
          GROUP BY printer_id
        ),
        -- Monthly volumes from pre-aggregated table
        monthly_agg AS (
          SELECT
            printer_id,
            MIN(volume)::bigint AS min_monthly_vol,
            MAX(volume)::bigint AS max_monthly_vol
          FROM xerox.meter_volumes
          GROUP BY printer_id
        ),
        monthly_min_month AS (
          SELECT DISTINCT ON (mv.printer_id)
            mv.printer_id,
            TO_CHAR(mv.date, 'Mon YY') AS min_month
          FROM xerox.meter_volumes mv
          JOIN monthly_agg ma ON ma.printer_id = mv.printer_id
          WHERE mv.volume = ma.min_monthly_vol
          ORDER BY mv.printer_id, mv.date DESC
        ),
        monthly_max_month AS (
          SELECT DISTINCT ON (mv.printer_id)
            mv.printer_id,
            TO_CHAR(mv.date, 'Mon YY') AS max_month
          FROM xerox.meter_volumes mv
          JOIN monthly_agg ma ON ma.printer_id = mv.printer_id
          WHERE mv.volume = ma.max_monthly_vol
          ORDER BY mv.printer_id, mv.date DESC
        ),
        monthly_stats AS (
          SELECT
            ma.printer_id,
            ma.min_monthly_vol,
            ma.max_monthly_vol,
            mn.min_month,
            mx.max_month
          FROM monthly_agg ma
          LEFT JOIN monthly_min_month mn ON mn.printer_id = ma.printer_id
          LEFT JOIN monthly_max_month mx ON mx.printer_id = ma.printer_id
        ),
        -- Latest absolute meter readings per machine (only BW + Colour, A3 is a subset)
        latest_readings AS (
          SELECT DISTINCT ON (printer_id, meter_type)
            printer_id,
            meter_type,
            reading::bigint AS reading
          FROM xerox.meter_readings_normalised
          WHERE meter_type IN ('black_impressions','color_impressions') AND reading IS NOT NULL
          ORDER BY printer_id, meter_type, report_date DESC
        ),
        latest_balances AS (
          SELECT
            printer_id,
            json_object_agg(meter_type, reading ORDER BY meter_type) AS balances
          FROM latest_readings
          GROUP BY printer_id
        )
        SELECT
          m.serial_number,
          m.model_name,
          m.store,
          m.company_group,
          m.printer_type,
          COALESCE(ds.max_daily_vol, 0)::bigint   AS max_daily_vol,
          COALESCE(ds.avg_daily_vol, 0)::bigint   AS avg_daily_vol,
          COALESCE(ds.reading_days, 0)::int        AS reading_days,
          ds.last_reading,
          COALESCE(ms.min_monthly_vol, 0)::bigint  AS min_monthly_vol,
          COALESCE(ms.max_monthly_vol, 0)::bigint  AS max_monthly_vol,
          ms.min_month,
          ms.max_month,
          COALESCE(lb.balances, '{}'::json)        AS latest_balances,
        mf.age,
        mf.condition_notes
        FROM machines m
        LEFT JOIN daily_stats ds ON ds.printer_id = m.printer_id
        LEFT JOIN monthly_stats ms ON ms.printer_id = m.printer_id
        LEFT JOIN latest_balances lb ON lb.printer_id = m.printer_id
        LEFT JOIN xerox.machine_feedback mf ON UPPER(TRIM(mf.serial_number)) = UPPER(TRIM(m.serial_number))
        ORDER BY m.store NULLS LAST, m.serial_number
      `);
      const installDates = await getBmsInstallDates();
      const rows = result.rows.map((r) => ({
        ...r,
        bms_installed_date: installDates.get(r.serial_number.trim().toUpperCase()) ?? null,
      }));
      return NextResponse.json({ tab, rows });
    }

    // ── MTD: daily volumes from 1st of month to today ────────────────────────
    if (tab === "mtd") {
      const datesResult = await client.query<{ report_date: string }>(
        `SELECT DISTINCT report_date::text
         FROM xerox.meter_readings_normalised
         WHERE report_date >= DATE_TRUNC('month', CURRENT_DATE)
           AND report_date <= CURRENT_DATE
         ORDER BY report_date`
      );
      const dates = datesResult.rows.map((r) => r.report_date);

      if (dates.length === 0) return NextResponse.json({ tab, rows: [], dates });

      const result = await client.query(`
        WITH ${MACHINE_CTE},
        true_total AS (
          SELECT printer_id, report_date, SUM(reading) AS reading
          FROM xerox.meter_readings_normalised
          WHERE meter_type IN ${REAL_METERS}
            AND reading IS NOT NULL
            AND report_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 day'
          GROUP BY printer_id, report_date
        ),
        daily_diffs AS (
          SELECT
            printer_id,
            report_date::text AS report_date,
            GREATEST(0, reading - LAG(reading) OVER (PARTITION BY printer_id ORDER BY report_date)) AS volume
          FROM true_total
          WHERE report_date >= DATE_TRUNC('month', CURRENT_DATE)
        )
        SELECT
          m.serial_number,
          m.model_name,
          m.store,
          m.company_group,
          m.printer_type,
          COALESCE(
            json_object_agg(dd.report_date, dd.volume ORDER BY dd.report_date)
            FILTER (WHERE dd.report_date IS NOT NULL), '{}'::json
          ) AS daily_volumes,
          COALESCE(SUM(dd.volume), 0)::bigint AS period_total
        FROM machines m
        LEFT JOIN daily_diffs dd ON dd.printer_id = m.printer_id
        GROUP BY m.serial_number, m.model_name, m.store, m.company_group, m.printer_type
        ORDER BY m.store NULLS LAST, m.serial_number
      `);
      return NextResponse.json({ tab, rows: result.rows, dates });
    }

    // ── MONTHLY: rolling 6 months ─────────────────────────────────────────────
    if (tab === "monthly") {
      const monthsResult = await client.query<{ month: string }>(
        `SELECT DISTINCT TO_CHAR(date, 'YYYY-MM') AS month
         FROM xerox.meter_volumes
         WHERE date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
         ORDER BY month`
      );
      const months = monthsResult.rows.map((r) => r.month);

      const result = await client.query(`
        WITH ${MACHINE_CTE},
        monthly AS (
          SELECT printer_id, TO_CHAR(date, 'YYYY-MM') AS month, SUM(volume)::bigint AS volume
          FROM xerox.meter_volumes
          WHERE date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
          GROUP BY printer_id, TO_CHAR(date, 'YYYY-MM')
        )
        SELECT
          m.serial_number,
          m.model_name,
          m.store,
          m.company_group,
          m.printer_type,
          COALESCE(
            json_object_agg(mo.month, COALESCE(mv.volume, 0) ORDER BY mo.month)
            FILTER (WHERE mo.month IS NOT NULL), '{}'::json
          ) AS monthly_volumes,
          COALESCE(SUM(mv.volume), 0)::bigint AS period_total
        FROM machines m
        CROSS JOIN (SELECT DISTINCT month FROM monthly) mo
        LEFT JOIN monthly mv ON mv.printer_id = m.printer_id AND mv.month = mo.month
        GROUP BY m.serial_number, m.model_name, m.store, m.company_group, m.printer_type
        ORDER BY m.store NULLS LAST, m.serial_number
      `);
      return NextResponse.json({ tab, rows: result.rows, months });
    }

    // ── YTD: one column per month Jan→current month ───────────────────────────
    if (tab === "ytd") {
      const monthsResult = await client.query<{ month: string }>(
        `SELECT DISTINCT TO_CHAR(date, 'YYYY-MM') AS month
         FROM xerox.meter_volumes
         WHERE date >= DATE_TRUNC('year', CURRENT_DATE)
           AND date <= CURRENT_DATE
         ORDER BY month`
      );
      const months = monthsResult.rows.map((r) => r.month);

      const result = await client.query(`
        WITH ${MACHINE_CTE},
        monthly AS (
          SELECT printer_id, TO_CHAR(date, 'YYYY-MM') AS month, SUM(volume)::bigint AS volume
          FROM xerox.meter_volumes
          WHERE date >= DATE_TRUNC('year', CURRENT_DATE) AND date <= CURRENT_DATE
          GROUP BY printer_id, TO_CHAR(date, 'YYYY-MM')
        )
        SELECT
          m.serial_number,
          m.model_name,
          m.store,
          m.company_group,
          m.printer_type,
          COALESCE(
            json_object_agg(mo.month, COALESCE(mv.volume, 0) ORDER BY mo.month)
            FILTER (WHERE mo.month IS NOT NULL), '{}'::json
          ) AS monthly_volumes,
          COALESCE(SUM(mv.volume), 0)::bigint AS period_total
        FROM machines m
        CROSS JOIN (SELECT DISTINCT month FROM monthly) mo
        LEFT JOIN monthly mv ON mv.printer_id = m.printer_id AND mv.month = mo.month
        GROUP BY m.serial_number, m.model_name, m.store, m.company_group, m.printer_type
        ORDER BY m.store NULLS LAST, m.serial_number
      `);
      return NextResponse.json({ tab, rows: result.rows, months });
    }

    // ── WEEKLY: total per ISO week (Mon–Sun), year-to-date ─────────────────────
    // Each week is keyed by its SUNDAY end-date (YYYY-MM-DD). Postgres weeks start
    // Monday, so date_trunc('week', date) is the Monday and +6 days is the Sunday.
    if (tab === "weekly") {
      const weeksResult = await client.query<{ week: string }>(
        `SELECT DISTINCT (DATE_TRUNC('week', date) + INTERVAL '6 days')::date::text AS week
         FROM xerox.meter_volumes
         WHERE date >= DATE_TRUNC('year', CURRENT_DATE)
           AND date <= CURRENT_DATE
         ORDER BY week`
      );
      const months = weeksResult.rows.map((r) => r.week);

      const result = await client.query(`
        WITH ${MACHINE_CTE},
        weekly AS (
          SELECT
            printer_id,
            (DATE_TRUNC('week', date) + INTERVAL '6 days')::date::text AS week,
            SUM(volume)::bigint AS volume
          FROM xerox.meter_volumes
          WHERE date >= DATE_TRUNC('year', CURRENT_DATE) AND date <= CURRENT_DATE
          GROUP BY printer_id, (DATE_TRUNC('week', date) + INTERVAL '6 days')::date::text
        )
        SELECT
          m.serial_number,
          m.model_name,
          m.store,
          m.company_group,
          m.printer_type,
          COALESCE(
            json_object_agg(wk.week, COALESCE(wv.volume, 0) ORDER BY wk.week)
            FILTER (WHERE wk.week IS NOT NULL), '{}'::json
          ) AS monthly_volumes,
          COALESCE(SUM(wv.volume), 0)::bigint AS period_total
        FROM machines m
        CROSS JOIN (SELECT DISTINCT week FROM weekly) wk
        LEFT JOIN weekly wv ON wv.printer_id = m.printer_id AND wv.week = wk.week
        GROUP BY m.serial_number, m.model_name, m.store, m.company_group, m.printer_type
        ORDER BY m.store NULLS LAST, m.serial_number
      `);
      return NextResponse.json({ tab, rows: result.rows, months });
    }

    // ── STATUS: machine feedback list (all machines with feedback data) ────────
    if (tab === "status") {
      const result = await client.query(`
        SELECT
          COALESCE(psm.store, mf.serial_number)   AS store,
          COALESCE(psm.model_name, pd.model)       AS model_name,
          mf.serial_number,
          mf.age,
          mf.condition_notes,
          psm.company_group,
          psm.printer_type,
          psm.reporting_enabled
        FROM xerox.machine_feedback mf
        LEFT JOIN xerox.printer_dimensions pd ON UPPER(TRIM(pd.serial_number)) = UPPER(TRIM(mf.serial_number))
          AND pd.manufacturer = 'Xerox'
        LEFT JOIN xerox.printer_store_map psm ON UPPER(TRIM(psm.serial_number)) = UPPER(TRIM(mf.serial_number))
        ORDER BY psm.store NULLS LAST, mf.serial_number
      `);
      const installDates = await getBmsInstallDates();
      const rows = result.rows.map((r) => ({
        ...r,
        bms_installed_date: installDates.get(r.serial_number.trim().toUpperCase()) ?? null,
      }));
      return NextResponse.json({ tab, rows });
    }

    return NextResponse.json({ error: "Invalid tab" }, { status: 400 });
  } finally {
    client.release();
  }
}
