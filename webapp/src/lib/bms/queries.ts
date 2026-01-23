/**
 * BMS Database Queries
 * SQL queries for extracting data from BMS MySQL databases
 */

import { RowDataPacket } from "mysql2/promise";
import { BMSConnectionConfig, BMSMachineRow, BMSMeterReadingRow, BMSMachineRateRow } from "./types";
import { queryBMS } from "./connection";

/**
 * Get all machines from a BMS database with full details
 * Uses SELECT * approach to capture all available data
 */
export async function fetchAllMachines(
  config: BMSConnectionConfig
): Promise<BMSMachineRow[]> {
  const query = `
    SELECT
      ma.*,
      crm.crmid,
      crm.smownerid,
      crm.createdtime,
      crm.modifiedtime,
      crm.label,
      crm.setype
    FROM bms_machines ma
    LEFT JOIN vtiger_crmentity crm ON crm.crmid = ma.machinesid
    WHERE ma.serialnumber IS NOT NULL
      AND ma.serialnumber != ''
    ORDER BY ma.machinesid
  `;

  return queryBMS<BMSMachineRow & RowDataPacket>(config, query);
}

/**
 * Get all meter readings from a BMS database
 * Returns full reading history with all sub-meters
 */
export async function fetchAllMeterReadings(
  config: BMSConnectionConfig
): Promise<BMSMeterReadingRow[]> {
  const query = `
    SELECT
      mrd.*,
      crm.createdtime
    FROM bms_meterreading mrd
    LEFT JOIN vtiger_crmentity crm ON crm.crmid = mrd.meterreadingid
    WHERE mrd.asset IS NOT NULL
    ORDER BY mrd.asset, mrd.reading_date
  `;

  return queryBMS<BMSMeterReadingRow & RowDataPacket>(config, query);
}

/**
 * Get meter readings for specific machines
 */
export async function fetchMeterReadingsForMachines(
  config: BMSConnectionConfig,
  machineIds: number[]
): Promise<BMSMeterReadingRow[]> {
  if (machineIds.length === 0) return [];

  const placeholders = machineIds.map(() => "?").join(",");
  const query = `
    SELECT
      mrd.*,
      crm.createdtime
    FROM bms_meterreading mrd
    LEFT JOIN vtiger_crmentity crm ON crm.crmid = mrd.meterreadingid
    WHERE mrd.asset IN (${placeholders})
    ORDER BY mrd.asset, mrd.reading_date
  `;

  return queryBMS<BMSMeterReadingRow & RowDataPacket>(config, query, machineIds);
}

/**
 * Get meter readings since a specific date (for incremental sync)
 */
export async function fetchMeterReadingsSince(
  config: BMSConnectionConfig,
  sinceDate: Date
): Promise<BMSMeterReadingRow[]> {
  const query = `
    SELECT
      mrd.*,
      crm.createdtime
    FROM bms_meterreading mrd
    LEFT JOIN vtiger_crmentity crm ON crm.crmid = mrd.meterreadingid
    WHERE mrd.reading_date >= ?
      AND mrd.asset IS NOT NULL
    ORDER BY mrd.asset, mrd.reading_date
  `;

  return queryBMS<BMSMeterReadingRow & RowDataPacket>(config, query, [sinceDate]);
}

/**
 * Get machine count from a BMS database
 */
export async function fetchMachineCount(
  config: BMSConnectionConfig
): Promise<number> {
  const query = `
    SELECT COUNT(*) as count
    FROM bms_machines
    WHERE serialnumber IS NOT NULL AND serialnumber != ''
  `;

  const result = await queryBMS<{ count: number } & RowDataPacket>(config, query);
  return result[0]?.count || 0;
}

/**
 * Get reading count from a BMS database
 */
export async function fetchReadingCount(
  config: BMSConnectionConfig
): Promise<number> {
  const query = `
    SELECT COUNT(*) as count
    FROM bms_meterreading
    WHERE asset IS NOT NULL
  `;

  const result = await queryBMS<{ count: number } & RowDataPacket>(config, query);
  return result[0]?.count || 0;
}

/**
 * Get distinct categories from a BMS database
 */
export async function fetchCategories(
  config: BMSConnectionConfig
): Promise<string[]> {
  const query = `
    SELECT DISTINCT machines_category as category
    FROM bms_machines
    WHERE machines_category IS NOT NULL
      AND machines_category != ''
    ORDER BY machines_category
  `;

  const result = await queryBMS<{ category: string } & RowDataPacket>(config, query);
  return result.map((r) => r.category);
}

/**
 * Get distinct models from a BMS database
 */
export async function fetchModels(
  config: BMSConnectionConfig
): Promise<string[]> {
  const query = `
    SELECT DISTINCT machine_model_name as model
    FROM bms_machines
    WHERE machine_model_name IS NOT NULL
      AND machine_model_name != ''
    ORDER BY machine_model_name
  `;

  const result = await queryBMS<{ model: string } & RowDataPacket>(config, query);
  return result.map((r) => r.model);
}

/**
 * Get full join of machines and their latest reading
 * Useful for quick overview without full reading history
 */
export async function fetchMachinesWithLatestReading(
  config: BMSConnectionConfig
): Promise<(BMSMachineRow & { latest_reading_date?: Date; latest_total?: number })[]> {
  const query = `
    SELECT
      ma.*,
      crm.crmid,
      crm.smownerid,
      crm.createdtime,
      crm.modifiedtime,
      crm.label,
      crm.setype,
      latest.reading_date as latest_reading_date,
      latest.total as latest_total
    FROM bms_machines ma
    LEFT JOIN vtiger_crmentity crm ON crm.crmid = ma.machinesid
    LEFT JOIN (
      SELECT asset, reading_date, total
      FROM bms_meterreading mrd1
      WHERE reading_date = (
        SELECT MAX(reading_date)
        FROM bms_meterreading mrd2
        WHERE mrd2.asset = mrd1.asset
      )
    ) latest ON latest.asset = ma.machinesid
    WHERE ma.serialnumber IS NOT NULL
      AND ma.serialnumber != ''
    ORDER BY ma.machinesid
  `;

  return queryBMS<
    (BMSMachineRow & { latest_reading_date?: Date; latest_total?: number }) & RowDataPacket
  >(config, query);
}

/**
 * Get all machine rates from a BMS database
 * Returns full rate history with all rate types
 */
export async function fetchAllMachineRates(
  config: BMSConnectionConfig
): Promise<BMSMachineRateRow[]> {
  const query = `
    SELECT
      machineid,
      category,
      rates_from,
      meters,
      a4_mono,
      a3_mono,
      a4_colour,
      a3_colour,
      colour_extra_large,
      date_saved,
      saved_by
    FROM bms_machines_fsma_rates
    WHERE machineid IS NOT NULL
    ORDER BY machineid, rates_from
  `;

  return queryBMS<BMSMachineRateRow & RowDataPacket>(config, query);
}

/**
 * Get rate count from a BMS database
 */
export async function fetchRateCount(
  config: BMSConnectionConfig
): Promise<number> {
  const query = `
    SELECT COUNT(*) as count
    FROM bms_machines_fsma_rates
    WHERE machineid IS NOT NULL
  `;

  const result = await queryBMS<{ count: number } & RowDataPacket>(config, query);
  return result[0]?.count || 0;
}
