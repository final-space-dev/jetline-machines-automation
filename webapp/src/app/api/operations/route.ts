import { NextResponse } from "next/server";
import { xeroxPool } from "@/lib/xerox-pool";
import { bmsPool } from "@/lib/bms-pool";

export async function GET() {
  const xeroxClient = await xeroxPool.connect();
  const bmsClient = await bmsPool.connect();

  try {
    // ── Fleet stats from Xerox ────────────────────────────────────────────────
    const fleetResult = await xeroxClient.query<{
      total: string; present: string; missing: string; never_seen: string;
    }>(`
      SELECT
        COUNT(*)                                                 AS total,
        COUNT(*) FILTER (WHERE last_seen >= CURRENT_DATE - 7)   AS present,
        COUNT(*) FILTER (WHERE last_seen < CURRENT_DATE - 7)    AS missing,
        COUNT(*) FILTER (WHERE last_seen IS NULL)               AS never_seen
      FROM xerox.printer_dimensions pd
      JOIN xerox.printer_store_map psm ON psm.serial_number = pd.serial_number
      WHERE pd.manufacturer = 'Xerox'
        AND pd.serial_number IS NOT NULL
        AND psm.reporting_enabled = true
        AND (psm.store IS NOT NULL OR psm.company_group IS NOT NULL)
    `);
    const fleet = fleetResult.rows[0];

    // ── Mapping stats ─────────────────────────────────────────────────────────
    const mappingResult = await xeroxClient.query<{
      mapped: string; unmapped: string; reporting_off: string;
    }>(`
      SELECT
        COUNT(*) FILTER (WHERE psm.store IS NOT NULL OR psm.company_group IS NOT NULL) AS mapped,
        COUNT(*) FILTER (WHERE
          COALESCE(psm.reporting_enabled, true) = true
          AND psm.store IS NULL AND psm.company_group IS NULL
        ) AS unmapped,
        COUNT(*) FILTER (WHERE psm.reporting_enabled = false) AS reporting_off
      FROM xerox.printer_dimensions pd
      JOIN xerox.printer_store_map psm ON psm.serial_number = pd.serial_number
      WHERE pd.manufacturer = 'Xerox'
        AND pd.serial_number IS NOT NULL
        AND psm.reporting_enabled = true
        AND (psm.store IS NOT NULL OR psm.company_group IS NOT NULL)
    `);
    const mapping = mappingResult.rows[0];

    // ── Reading staleness ─────────────────────────────────────────────────────
    const stalenessResult = await xeroxClient.query<{
      fresh: string; ok: string; stale: string; critical: string; never: string;
    }>(`
      WITH latest AS (
        SELECT pd.serial_number, MAX(mr.report_date) AS latest_date
        FROM xerox.printer_dimensions pd
        JOIN xerox.printer_store_map psm ON psm.serial_number = pd.serial_number
        LEFT JOIN xerox.meter_readings_normalised mr ON mr.printer_id = pd.printer_id
        WHERE pd.manufacturer = 'Xerox'
          AND pd.serial_number IS NOT NULL
          AND psm.reporting_enabled = true
          AND (psm.store IS NOT NULL OR psm.company_group IS NOT NULL)
        GROUP BY pd.serial_number
      )
      SELECT
        COUNT(*) FILTER (WHERE latest_date >= CURRENT_DATE - 3)                                    AS fresh,
        COUNT(*) FILTER (WHERE latest_date >= CURRENT_DATE - 14 AND latest_date < CURRENT_DATE - 3) AS ok,
        COUNT(*) FILTER (WHERE latest_date >= CURRENT_DATE - 30 AND latest_date < CURRENT_DATE - 14) AS stale,
        COUNT(*) FILTER (WHERE latest_date < CURRENT_DATE - 30)                                    AS critical,
        COUNT(*) FILTER (WHERE latest_date IS NULL)                                                AS never
      FROM latest
    `);
    const staleness = stalenessResult.rows[0];

    // ── Alert feed ────────────────────────────────────────────────────────────
    const alertsResult = await xeroxClient.query<{
      type: string; serial_number: string; store: string | null;
      model: string; detail: string; days_since: number | null;
    }>(`
      WITH latest AS (
        SELECT
          pd.serial_number, pd.model, psm.store, psm.company_group,
          MAX(mr.report_date) AS latest_date
        FROM xerox.printer_dimensions pd
        LEFT JOIN xerox.printer_store_map psm ON psm.serial_number = pd.serial_number
        LEFT JOIN xerox.meter_readings_normalised mr ON mr.printer_id = pd.printer_id
        WHERE pd.manufacturer = 'Xerox'
          AND pd.serial_number IS NOT NULL
          AND psm.reporting_enabled = true
          AND (psm.store IS NOT NULL OR psm.company_group IS NOT NULL)
        GROUP BY pd.serial_number, pd.model, psm.store, psm.company_group
      )
      SELECT
        CASE
          WHEN latest_date IS NULL             THEN 'never_reported'
          WHEN latest_date < CURRENT_DATE - 30 THEN 'critical'
          WHEN latest_date < CURRENT_DATE - 14 THEN 'stale'
        END AS type,
        serial_number, store, model,
        CASE
          WHEN latest_date IS NULL THEN 'Never sent a reading'
          ELSE 'Last reading ' || (CURRENT_DATE - latest_date) || ' days ago'
        END AS detail,
        CASE WHEN latest_date IS NOT NULL THEN (CURRENT_DATE - latest_date) END AS days_since
      FROM latest
      WHERE latest_date IS NULL OR latest_date < CURRENT_DATE - 14
      ORDER BY days_since DESC NULLS FIRST
      LIMIT 50
    `);

    // ── Xerox pipeline status ─────────────────────────────────────────────────
    const pipelineResult = await xeroxClient.query<{ last_ingested: string | null }>(`
      SELECT MAX(loaded_at)::text AS last_ingested
      FROM xerox.load_history
    `);
    const lastIngested = pipelineResult.rows[0]?.last_ingested ?? null;

    // ── BMS sync health from Dagster ETL ─────────────────────────────────────
    const lastSuccessResult = await bmsClient.query<{
      completed_at: string | null; company_id: string | null; machines_synced: number | null;
    }>(`
      SELECT completed_at::text, company_id, machines_synced
      FROM machines.sync_runs
      WHERE status = 'success' AND completed_at IS NOT NULL
      ORDER BY completed_at DESC LIMIT 1
    `);

    const lastFailedResult = await bmsClient.query<{
      started_at: string; company_id: string | null; error_detail: string | null;
    }>(`
      SELECT started_at::text, company_id, error_detail
      FROM machines.sync_runs
      WHERE status = 'failed'
      ORDER BY started_at DESC LIMIT 1
    `);

    const recentSyncsResult = await bmsClient.query<{
      id: number; started_at: string; completed_at: string | null;
      status: string; company_id: string | null; triggered_by: string | null;
      machines_synced: number | null; error_detail: string | null;
    }>(`
      SELECT id, started_at::text, completed_at::text, status, company_id,
             triggered_by, machines_synced, error_detail
      FROM machines.sync_runs
      ORDER BY started_at DESC LIMIT 10
    `);

    // ── BMS cross-reference: active Xerox machines not found in BMS ──────────
    const xeroxSerialsResult = await xeroxClient.query<{ serial_number: string }>(`
      SELECT pd.serial_number FROM xerox.printer_dimensions pd
      JOIN xerox.printer_store_map psm ON psm.serial_number = pd.serial_number
      WHERE pd.manufacturer = 'Xerox'
        AND pd.serial_number IS NOT NULL
        AND pd.last_seen >= CURRENT_DATE - 7
        AND psm.reporting_enabled = true
        AND (psm.store IS NOT NULL OR psm.company_group IS NOT NULL)
    `);
    const bmsSerialsResult = await bmsClient.query<{ serial_number: string }>(
      `SELECT serial_number FROM machines.machines`
    );
    const bmsSet = new Set(bmsSerialsResult.rows.map((r) => r.serial_number.trim().toUpperCase()));
    const notInBms = xeroxSerialsResult.rows.filter(
      (r) => !bmsSet.has(r.serial_number.trim().toUpperCase())
    ).length;

    return NextResponse.json({
      fleet: {
        total: parseInt(fleet.total),
        present: parseInt(fleet.present),
        missing: parseInt(fleet.missing),
        neverSeen: parseInt(fleet.never_seen),
      },
      mapping: {
        mapped: parseInt(mapping.mapped),
        unmapped: parseInt(mapping.unmapped),
        reportingOff: parseInt(mapping.reporting_off),
      },
      staleness: {
        fresh: parseInt(staleness.fresh),
        ok: parseInt(staleness.ok),
        stale: parseInt(staleness.stale),
        critical: parseInt(staleness.critical),
        never: parseInt(staleness.never),
      },
      alerts: alertsResult.rows,
      sync: {
        lastSuccess: lastSuccessResult.rows[0]?.completed_at ?? null,
        lastFailed: lastFailedResult.rows[0]?.started_at ?? null,
        recentSyncs: recentSyncsResult.rows,
      },
      pipeline: {
        lastIngested,
        daysSinceIngestion: lastIngested
          ? Math.floor((Date.now() - new Date(lastIngested).getTime()) / 86_400_000)
          : null,
      },
      crossRef: { notInBms },
    });
  } finally {
    xeroxClient.release();
    bmsClient.release();
  }
}
