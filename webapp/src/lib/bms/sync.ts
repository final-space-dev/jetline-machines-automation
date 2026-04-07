/**
 * BMS Data Sync Service
 * Synchronizes data from BMS MySQL databases to local PostgreSQL
 *
 * Performance: Uses parallel company syncs (5 concurrent) and raw SQL
 * bulk upserts (INSERT ... ON CONFLICT) instead of individual Prisma upserts.
 */

import { MachineStatus, SyncStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  BMSConnectionConfig,
  BMSMachineRow,
  BMSMeterReadingRow,
  BMSMachineRateRow,
  SyncResult,
  FullSyncSummary,
  CompanyBMSConfig,
} from "./types";
import { createBMSConfig, closeBMSConnection } from "./connection";
import { fetchAllMachines, fetchAllMeterReadings, fetchAllMachineRates } from "./queries";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BULK_BATCH = 500;
const CONCURRENCY = 5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractMakeName(modelName: string | null): string | null {
  if (!modelName) return null;
  const parts = modelName.trim().split(/\s+/);
  return parts[0] || null;
}

/**
 * Run async tasks with a concurrency limit. No external deps needed.
 */
async function withConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let idx = 0;
  let running = 0;

  return new Promise<void>((resolve, reject) => {
    let rejected = false;
    function next() {
      while (running < limit && idx < items.length) {
        const i = idx++;
        running++;
        fn(items[i])
          .then(() => {
            running--;
            if (idx >= items.length && running === 0) resolve();
            else next();
          })
          .catch((err) => {
            if (!rejected) {
              rejected = true;
              reject(err);
            }
          });
      }
    }
    next();
  });
}

// ---------------------------------------------------------------------------
// Anomaly detection (unchanged)
// ---------------------------------------------------------------------------

function hasNegativeDiff(
  current: BMSMeterReadingRow,
  previous: BMSMeterReadingRow | null,
): boolean {
  if (!previous) return false;
  const pairs: [number | null, number | null][] = [
    [current.total, previous.total],
    [current.a3, previous.a3],
    [current.black, previous.black],
    [current.large, previous.large],
    [current.colour, previous.colour],
    [current.extralarge, previous.extralarge],
  ];
  return pairs.some(([c, p]) => c !== null && p !== null && c < p);
}

function calculateIncrementals(
  current: BMSMeterReadingRow,
  previous: BMSMeterReadingRow | null,
): {
  incrementalTotal: number | null;
  incrementalA3: number | null;
  incrementalBlack: number | null;
  incrementalLarge: number | null;
  incrementalColour: number | null;
  incrementalXl: number | null;
} {
  if (!previous) {
    return {
      incrementalTotal: null,
      incrementalA3: null,
      incrementalBlack: null,
      incrementalLarge: null,
      incrementalColour: null,
      incrementalXl: null,
    };
  }

  const safeIncrement = (curr: number | null, prev: number | null): number | null => {
    if (curr === null || prev === null) return null;
    const diff = curr - prev;
    if (diff < 0) return null; // individual counter went backwards
    return diff;
  };

  return {
    incrementalTotal: safeIncrement(current.total, previous.total),
    incrementalA3: safeIncrement(current.a3, previous.a3),
    incrementalBlack: safeIncrement(current.black, previous.black),
    incrementalLarge: safeIncrement(current.large, previous.large),
    incrementalColour: safeIncrement(current.colour, previous.colour),
    incrementalXl: safeIncrement(current.extralarge, previous.extralarge),
  };
}

// ---------------------------------------------------------------------------
// Bulk upsert: Machines
// ---------------------------------------------------------------------------

async function syncMachinesFromBMS(
  companyId: string,
  bmsRows: BMSMachineRow[],
): Promise<{ processed: number; errors: string[] }> {
  const errors: string[] = [];
  // Deduplicate by serial number (keep last occurrence to avoid ON CONFLICT within batch)
  const deduped = new Map<string, BMSMachineRow>();
  for (const row of bmsRows) {
    if (row.serialnumber) deduped.set(row.serialnumber, row);
  }
  const validRows = Array.from(deduped.values());
  if (validRows.length === 0) return { processed: 0, errors };

  // Pre-create all categories in bulk
  const uniqueCategories = [
    ...new Set(validRows.map((r) => r.machines_category).filter(Boolean)),
  ] as string[];

  const existingCategories = await prisma.category.findMany();
  const categoryMap = new Map<string, string>();
  existingCategories.forEach((c) => categoryMap.set(c.name, c.id));

  const newCategories = uniqueCategories.filter((name) => !categoryMap.has(name));
  if (newCategories.length > 0) {
    await prisma.category.createMany({
      data: newCategories.map((name) => ({ name })),
      skipDuplicates: true,
    });
    const allCategories = await prisma.category.findMany();
    categoryMap.clear();
    allCategories.forEach((c) => categoryMap.set(c.name, c.id));
  }

  // 24 columns per row
  const COLS = 24;
  let processed = 0;

  for (let i = 0; i < validRows.length; i += BULK_BATCH) {
    const batch = validRows.slice(i, i + BULK_BATCH);
    const values: unknown[] = [];
    const placeholders: string[] = [];

    for (let j = 0; j < batch.length; j++) {
      const row = batch[j];
      const base = j * COLS;
      placeholders.push(
        `(${Array.from({ length: COLS }, (_, k) => {
          // Cast column 10 (status) to the PostgreSQL enum type
          const p = `$${base + k + 1}`;
          return k === 9 ? `${p}::"MachineStatus"` : p;
        }).join(", ")})`,
      );

      const bmsStatusNum =
        row.machinestatus !== null && row.machinestatus !== undefined
          ? parseInt(String(row.machinestatus), 10)
          : null;
      const status = bmsStatusNum === 0 ? MachineStatus.INACTIVE : MachineStatus.ACTIVE;
      const rentalAmount =
        row.rental_amount_ex_vat !== null && row.rental_amount_ex_vat !== undefined
          ? parseFloat(String(row.rental_amount_ex_vat))
          : null;
      const otherFixed =
        row.other_fixed_amount_ex_vat !== null && row.other_fixed_amount_ex_vat !== undefined
          ? parseFloat(String(row.other_fixed_amount_ex_vat))
          : null;
      const categoryId = row.machines_category
        ? categoryMap.get(row.machines_category) ?? null
        : null;
      const now = new Date();

      values.push(
        crypto.randomUUID(),                     // 1  id
        row.serialnumber,                        // 2  serial_number
        companyId,                               // 3  company_id
        categoryId,                              // 4  category_id
        row.machinesid ?? null,                  // 5  bms_machines_id
        row.machinesno ?? null,                  // 6  bms_machine_no
        row.machines_machine_name ?? null,       // 7  machine_name
        extractMakeName(row.machine_model_name), // 8  make_name
        row.machine_model_name ?? null,          // 9  model_name
        status,                                  // 10 status
        bmsStatusNum,                            // 11 bms_status
        row.original_installation_date ?? null,  // 12 install_date
        row.start_date ?? null,                  // 13 start_date
        row.machine_contract_no ?? null,         // 14 contract_number
        row.machine_contract_type ?? null,       // 15 contract_type
        row.rental_start_date ?? null,           // 16 rental_start_date
        row.rental_end_date ?? null,             // 17 rental_end_date
        row.rental_months_remaining ?? null,     // 18 rental_months_remaining
        rentalAmount,                            // 19 rental_amount_ex_vat
        otherFixed,                              // 20 other_fixed_amount_ex_vat
        row.lift === 1,                          // 21 is_lifted
        now,                                     // 22 last_synced_at
        now,                                     // 23 created_at
        now,                                     // 24 updated_at
      );
    }

    const sql = `
      INSERT INTO machines (
        id, serial_number, company_id, category_id,
        bms_machines_id, bms_machine_no, machine_name, make_name, model_name,
        status, bms_status, install_date, start_date,
        contract_number, contract_type,
        rental_start_date, rental_end_date, rental_months_remaining,
        rental_amount_ex_vat, other_fixed_amount_ex_vat,
        is_lifted, last_synced_at, created_at, updated_at
      ) VALUES ${placeholders.join(",\n")}
      ON CONFLICT (serial_number) DO UPDATE SET
        company_id = EXCLUDED.company_id,
        category_id = EXCLUDED.category_id,
        bms_machines_id = EXCLUDED.bms_machines_id,
        bms_machine_no = EXCLUDED.bms_machine_no,
        machine_name = EXCLUDED.machine_name,
        make_name = EXCLUDED.make_name,
        model_name = EXCLUDED.model_name,
        status = EXCLUDED.status,
        bms_status = EXCLUDED.bms_status,
        install_date = EXCLUDED.install_date,
        start_date = EXCLUDED.start_date,
        contract_number = EXCLUDED.contract_number,
        contract_type = EXCLUDED.contract_type,
        rental_start_date = EXCLUDED.rental_start_date,
        rental_end_date = EXCLUDED.rental_end_date,
        rental_months_remaining = EXCLUDED.rental_months_remaining,
        rental_amount_ex_vat = EXCLUDED.rental_amount_ex_vat,
        other_fixed_amount_ex_vat = EXCLUDED.other_fixed_amount_ex_vat,
        is_lifted = EXCLUDED.is_lifted,
        last_synced_at = EXCLUDED.last_synced_at,
        updated_at = EXCLUDED.updated_at
      WHERE
        -- Never let an INACTIVE record overwrite an ACTIVE one.
        -- Active always wins; only update if incoming is active OR existing is not active.
        EXCLUDED.status = 'ACTIVE' OR machines.status != 'ACTIVE'
    `;

    try {
      await prisma.$executeRawUnsafe(sql, ...values);
      processed += batch.length;
    } catch (error) {
      errors.push(
        `Machine bulk upsert batch ${i}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return { processed, errors };
}

// ---------------------------------------------------------------------------
// Bulk upsert: Meter Readings
// ---------------------------------------------------------------------------

interface ReadingData {
  machineId: string;
  bmsMeterReadingId: number | null;
  readingDate: Date;
  bmsMeterReadingNo: string | null;
  readingDateTime: Date | null;
  total: number;
  a3: number | null;
  black: number | null;
  large: number | null;
  colour: number | null;
  extraLarge: number | null;
  incrementalTotal: number | null;
  incrementalA3: number | null;
  incrementalBlack: number | null;
  incrementalLarge: number | null;
  incrementalColour: number | null;
  incrementalXl: number | null;
  isReported: boolean;
  forBilling: boolean;
  isOpeningReading: boolean;
  isClosingReading: boolean;
}

async function syncReadingsFromBMS(
  bmsRows: BMSMeterReadingRow[],
  machineIdMap: Map<number, string>,
): Promise<{ processed: number; errors: string[] }> {
  const errors: string[] = [];
  let processed = 0;

  // Group readings by machine for incremental calculation
  const readingsByMachine = new Map<number, BMSMeterReadingRow[]>();
  for (const row of bmsRows) {
    if (!readingsByMachine.has(row.asset)) {
      readingsByMachine.set(row.asset, []);
    }
    readingsByMachine.get(row.asset)!.push(row);
  }

  // Collect all row data across all machines
  const allRows: ReadingData[] = [];
  const machineUpdates: { machineId: string; total: number; date: Date }[] = [];

  // Pass 1: Calculate incrementals + anomaly detection in memory (UNCHANGED)
  for (const [asset, readings] of readingsByMachine) {
    const machineId = machineIdMap.get(asset);
    if (!machineId) continue;

    readings.sort(
      (a, b) => new Date(a.reading_date).getTime() - new Date(b.reading_date).getTime(),
    );

    const history: { reading: BMSMeterReadingRow; rowIndex: number }[] = [];

    for (let ri = 0; ri < readings.length; ri++) {
      const row = readings[ri];
      try {
        const prevEntry = history.length > 0 ? history[history.length - 1] : null;
        const prevReading = prevEntry?.reading ?? null;

        let incrementals = calculateIncrementals(row, prevReading);
        const wentBackwards = hasNegativeDiff(row, prevReading);

        if (wentBackwards && history.length > 0) {
          const MAX_WALKBACK = 90;
          const minIdx = Math.max(0, history.length - MAX_WALKBACK);
          let goodIdx = -1;
          for (let h = history.length - 1; h >= minIdx; h--) {
            const candidate = history[h].reading;
            if (!hasNegativeDiff(row, candidate)) {
              goodIdx = h;
              break;
            }
          }

          const nullIncrementals = {
            incrementalTotal: null,
            incrementalA3: null,
            incrementalBlack: null,
            incrementalLarge: null,
            incrementalColour: null,
            incrementalXl: null,
          };

          if (goodIdx >= 0) {
            const lastGood = history[goodIdx];
            // Null out incrementals for readings between last good and now
            for (let h = goodIdx + 1; h < history.length; h++) {
              const badRow = allRows[history[h].rowIndex];
              Object.assign(badRow, nullIncrementals);
            }
            incrementals = calculateIncrementals(row, lastGood.reading);
            history.length = goodIdx + 1;
          } else {
            incrementals = { ...nullIncrementals };
          }
        }

        const rowIndex = allRows.length;
        allRows.push({
          machineId,
          bmsMeterReadingId: row.meterreadingid,
          readingDate: new Date(row.reading_date),
          bmsMeterReadingNo: row.meterreading_no,
          readingDateTime: row.createdtime ?? null,
          total: row.total || 0,
          a3: row.a3,
          black: row.black,
          large: row.large,
          colour: row.colour,
          extraLarge: row.extralarge,
          incrementalTotal: incrementals.incrementalTotal,
          incrementalA3: incrementals.incrementalA3,
          incrementalBlack: incrementals.incrementalBlack,
          incrementalLarge: incrementals.incrementalLarge,
          incrementalColour: incrementals.incrementalColour,
          incrementalXl: incrementals.incrementalXl,
          isReported: row.is_reported === 1,
          forBilling: row.for_billing === 1,
          isOpeningReading: row.is_opening_reading === 1,
          isClosingReading: row.is_closing_reading === 1,
        });

        // Always add to history — the balance is the reference for the next reading
        history.push({ reading: row, rowIndex });
      } catch (error) {
        errors.push(
          `Reading ${row.meterreadingid}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const latestReading = readings[readings.length - 1];
    if (latestReading) {
      machineUpdates.push({
        machineId,
        total: latestReading.total || 0,
        date: new Date(latestReading.reading_date),
      });
    }
  }

  // Pass 2: Bulk write all readings via raw SQL
  const COLS = 25;
  for (let i = 0; i < allRows.length; i += BULK_BATCH) {
    const batch = allRows.slice(i, i + BULK_BATCH);
    const values: unknown[] = [];
    const placeholders: string[] = [];

    for (let j = 0; j < batch.length; j++) {
      const r = batch[j];
      const base = j * COLS;
      placeholders.push(
        `(${Array.from({ length: COLS }, (_, k) => `$${base + k + 1}`).join(", ")})`,
      );

      values.push(
        crypto.randomUUID(),    // 1  id
        r.machineId,            // 2  machine_id
        r.bmsMeterReadingId,    // 3  bms_meterreading_id
        r.bmsMeterReadingNo,    // 4  bms_meterreading_no
        r.readingDate,          // 5  reading_date
        r.readingDateTime,      // 6  reading_datetime
        r.total,                // 7  total
        r.a3,                   // 8  a3
        r.black,                // 9  black
        r.large,                // 10 large
        r.colour,               // 11 colour
        r.extraLarge,           // 12 extra_large
        r.incrementalTotal,     // 13 incremental_total
        r.incrementalA3,        // 14 incremental_a3
        r.incrementalBlack,     // 15 incremental_black
        r.incrementalLarge,     // 16 incremental_large
        r.incrementalColour,    // 17 incremental_colour
        r.incrementalXl,        // 18 incremental_xl
        r.isReported,           // 19 is_reported
        r.forBilling,           // 20 for_billing
        r.isOpeningReading,     // 21 is_opening_reading
        r.isClosingReading,     // 22 is_closing_reading
        false,                  // 23 is_anomaly
        "BMS",                  // 24 source
        new Date(),             // 25 created_at
      );
    }

    const sql = `
      INSERT INTO meter_readings (
        id, machine_id, bms_meterreading_id, bms_meterreading_no,
        reading_date, reading_datetime, total, a3, black, large, colour, extra_large,
        incremental_total, incremental_a3, incremental_black, incremental_large,
        incremental_colour, incremental_xl,
        is_reported, for_billing, is_opening_reading, is_closing_reading,
        is_anomaly, source, created_at
      ) VALUES ${placeholders.join(",\n")}
      ON CONFLICT (machine_id, reading_date, bms_meterreading_id) DO UPDATE SET
        bms_meterreading_no = EXCLUDED.bms_meterreading_no,
        reading_datetime = EXCLUDED.reading_datetime,
        total = EXCLUDED.total,
        a3 = EXCLUDED.a3,
        black = EXCLUDED.black,
        large = EXCLUDED.large,
        colour = EXCLUDED.colour,
        extra_large = EXCLUDED.extra_large,
        incremental_total = EXCLUDED.incremental_total,
        incremental_a3 = EXCLUDED.incremental_a3,
        incremental_black = EXCLUDED.incremental_black,
        incremental_large = EXCLUDED.incremental_large,
        incremental_colour = EXCLUDED.incremental_colour,
        incremental_xl = EXCLUDED.incremental_xl,
        is_reported = EXCLUDED.is_reported,
        for_billing = EXCLUDED.for_billing,
        is_opening_reading = EXCLUDED.is_opening_reading,
        is_closing_reading = EXCLUDED.is_closing_reading
    `;

    try {
      await prisma.$executeRawUnsafe(sql, ...values);
      processed += batch.length;
    } catch (error) {
      errors.push(
        `Reading bulk upsert batch ${i}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Bulk update machine balances
  if (machineUpdates.length > 0) {
    for (let i = 0; i < machineUpdates.length; i += BULK_BATCH) {
      const batch = machineUpdates.slice(i, i + BULK_BATCH);
      const values: unknown[] = [];
      const placeholders: string[] = [];

      for (let j = 0; j < batch.length; j++) {
        const u = batch[j];
        const base = j * 3;
        placeholders.push(`($${base + 1}, $${base + 2}::int, $${base + 3}::timestamp)`);
        values.push(u.machineId, u.total, u.date);
      }

      try {
        await prisma.$executeRawUnsafe(
          `UPDATE machines SET
            current_balance = v.total,
            last_reading_date = v.reading_date,
            updated_at = NOW()
          FROM (VALUES ${placeholders.join(", ")}) AS v(id, total, reading_date)
          WHERE machines.id = v.id`,
          ...values,
        );
      } catch (error) {
        errors.push(
          `Machine balance update: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  return { processed, errors };
}

// ---------------------------------------------------------------------------
// Bulk upsert: Rates
// ---------------------------------------------------------------------------

async function syncRatesFromBMS(
  bmsRows: BMSMachineRateRow[],
  machineIdMap: Map<number, string>,
): Promise<{ processed: number; errors: string[] }> {
  const errors: string[] = [];
  let processed = 0;

  const parseRate = (val: number | string | null): number | null => {
    if (val === null || val === undefined) return null;
    const parsed = parseFloat(String(val));
    return isNaN(parsed) ? null : parsed;
  };

  // Filter to rows with valid machineId, deduplicate by (machineId, rates_from)
  const deduped = new Map<string, BMSMachineRateRow>();
  for (const row of bmsRows) {
    if (!machineIdMap.has(row.machineid)) continue;
    const key = `${machineIdMap.get(row.machineid)}|${new Date(row.rates_from).toISOString()}`;
    deduped.set(key, row);
  }
  const validRows = Array.from(deduped.values());
  if (validRows.length === 0) return { processed: 0, errors };

  const COLS = 14;
  for (let i = 0; i < validRows.length; i += BULK_BATCH) {
    const batch = validRows.slice(i, i + BULK_BATCH);
    const values: unknown[] = [];
    const placeholders: string[] = [];

    for (let j = 0; j < batch.length; j++) {
      const row = batch[j];
      const machineId = machineIdMap.get(row.machineid)!;
      const base = j * COLS;
      placeholders.push(
        `(${Array.from({ length: COLS }, (_, k) => `$${base + k + 1}`).join(", ")})`,
      );

      values.push(
        crypto.randomUUID(),                              // 1  id
        machineId,                                        // 2  machine_id
        row.machineid ?? null,                            // 3  bms_machines_id
        row.category || "Unknown",                        // 4  category
        new Date(row.rates_from),                         // 5  rates_from
        parseRate(row.meters),                            // 6  meters
        parseRate(row.a4_mono),                           // 7  a4_mono
        parseRate(row.a3_mono),                           // 8  a3_mono
        parseRate(row.a4_colour),                         // 9  a4_colour
        parseRate(row.a3_colour),                         // 10 a3_colour
        parseRate(row.colour_extra_large),                // 11 colour_extra_large
        row.date_saved ? new Date(row.date_saved) : null, // 12 date_saved
        row.saved_by ?? null,                             // 13 saved_by
        new Date(),                                       // 14 created_at
      );
    }

    const sql = `
      INSERT INTO machine_rates (
        id, machine_id, bms_machines_id, category, rates_from,
        meters, a4_mono, a3_mono, a4_colour, a3_colour, colour_extra_large,
        date_saved, saved_by, created_at
      ) VALUES ${placeholders.join(",\n")}
      ON CONFLICT (machine_id, rates_from) DO UPDATE SET
        bms_machines_id = EXCLUDED.bms_machines_id,
        category = EXCLUDED.category,
        meters = EXCLUDED.meters,
        a4_mono = EXCLUDED.a4_mono,
        a3_mono = EXCLUDED.a3_mono,
        a4_colour = EXCLUDED.a4_colour,
        a3_colour = EXCLUDED.a3_colour,
        colour_extra_large = EXCLUDED.colour_extra_large,
        date_saved = EXCLUDED.date_saved,
        saved_by = EXCLUDED.saved_by
    `;

    try {
      await prisma.$executeRawUnsafe(sql, ...values);
      processed += batch.length;
    } catch (error) {
      errors.push(
        `Rate bulk upsert batch ${i}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return { processed, errors };
}

// ---------------------------------------------------------------------------
// Company sync
// ---------------------------------------------------------------------------

export async function syncCompany(company: CompanyBMSConfig): Promise<SyncResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let machinesProcessed = 0;
  let readingsProcessed = 0;
  let ratesProcessed = 0;

  const bmsConfig = createBMSConfig(company.bmsSchema, company.bmsHost);

  try {
    console.log(`[Sync] Starting sync for ${company.name} (${company.bmsSchema})`);

    // 1. Fetch & sync machines
    const bmsMachines = await fetchAllMachines(bmsConfig);
    const machineResult = await syncMachinesFromBMS(company.id, bmsMachines);
    machinesProcessed = machineResult.processed;
    errors.push(...machineResult.errors);

    // 2. Build machineIdMap ONCE for this company
    const machines = await prisma.machine.findMany({
      where: { companyId: company.id, bmsMachinesId: { not: null } },
      select: { id: true, bmsMachinesId: true },
    });
    const machineIdMap = new Map<number, string>();
    machines.forEach((m) => {
      if (m.bmsMachinesId) machineIdMap.set(m.bmsMachinesId, m.id);
    });

    // 3. Fetch & sync readings (pass shared machineIdMap)
    const bmsReadings = await fetchAllMeterReadings(bmsConfig);
    const readingResult = await syncReadingsFromBMS(bmsReadings, machineIdMap);
    readingsProcessed = readingResult.processed;
    errors.push(...readingResult.errors);

    // 4. Fetch & sync rates (pass shared machineIdMap)
    try {
      const bmsRates = await fetchAllMachineRates(bmsConfig);
      const rateResult = await syncRatesFromBMS(bmsRates, machineIdMap);
      ratesProcessed = rateResult.processed;
      errors.push(...rateResult.errors);
    } catch (rateError) {
      console.log(
        `[Sync] Rate sync skipped for ${company.name}: ${rateError instanceof Error ? rateError.message : String(rateError)}`,
      );
    }

    console.log(
      `[Sync] Completed ${company.name}: ${machinesProcessed} machines, ${readingsProcessed} readings, ${ratesProcessed} rates in ${Date.now() - startTime}ms`,
    );
  } catch (error) {
    errors.push(
      `Company sync failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    console.error(`[Sync] Error syncing ${company.name}:`, error);
  } finally {
    await closeBMSConnection(bmsConfig);
  }

  return {
    companyId: company.id,
    companyName: company.name,
    bmsSchema: company.bmsSchema,
    machinesProcessed,
    readingsProcessed,
    ratesProcessed,
    errors,
    duration: Date.now() - startTime,
  };
}

// ---------------------------------------------------------------------------
// Full sync (parallel)
// ---------------------------------------------------------------------------

export async function runFullSync(): Promise<FullSyncSummary> {
  const startedAt = new Date();
  const companyResults: SyncResult[] = [];
  const errors: string[] = [];

  const companies = await prisma.company.findMany({
    where: { isActive: true },
    select: { id: true, name: true, bmsSchema: true, bmsHost: true },
  });

  const syncLog = await prisma.syncLog.create({
    data: {
      syncType: "FULL",
      startedAt,
      status: SyncStatus.RUNNING,
      totalCompanies: companies.length,
      companiesProcessed: 0,
      machinesProcessed: 0,
      readingsProcessed: 0,
    },
  });

  try {
    console.log(
      `[Sync] Starting full sync for ${companies.length} companies (concurrency: ${CONCURRENCY})`,
    );

    let completedCount = 0;

    await withConcurrency(companies, CONCURRENCY, async (company) => {
      const result = await syncCompany(company);
      companyResults.push(result);

      if (result.errors.length > 0) {
        errors.push(`${company.name}: ${result.errors.join("; ")}`);
      }

      // Atomic increment — safe for concurrent updates
      completedCount++;
      await prisma.$executeRawUnsafe(
        `UPDATE sync_logs SET
          companies_processed = companies_processed + 1,
          machines_processed = machines_processed + $1,
          readings_processed = readings_processed + $2,
          current_company = $3
        WHERE id = $4`,
        result.machinesProcessed,
        result.readingsProcessed,
        `${completedCount} of ${companies.length} complete`,
        syncLog.id,
      );
    });

    const totalMachines = companyResults.reduce((s, r) => s + r.machinesProcessed, 0);
    const totalReadings = companyResults.reduce((s, r) => s + r.readingsProcessed, 0);
    const totalRates = companyResults.reduce((s, r) => s + r.ratesProcessed, 0);

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        completedAt: new Date(),
        status: SyncStatus.COMPLETED,
        currentCompany: null,
        companiesProcessed: companies.length,
        machinesProcessed: totalMachines,
        readingsProcessed: totalReadings,
        errors: errors.length > 0 ? errors.join("\n") : null,
      },
    });

    console.log(
      `[Sync] Full sync completed in ${Date.now() - startedAt.getTime()}ms: ${totalMachines} machines, ${totalReadings} readings, ${totalRates} rates`,
    );

    return {
      syncId: syncLog.id,
      startedAt,
      completedAt: new Date(),
      companiesProcessed: companies.length,
      totalMachines,
      totalReadings,
      totalRates,
      errors,
      companyResults,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(errorMessage);

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        completedAt: new Date(),
        status: SyncStatus.FAILED,
        errors: errorMessage,
      },
    });

    throw error;
  }
}

// ---------------------------------------------------------------------------
// Single company sync by ID
// ---------------------------------------------------------------------------

export async function syncCompanyById(companyId: string): Promise<SyncResult> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, bmsSchema: true, bmsHost: true },
  });

  if (!company) throw new Error(`Company not found: ${companyId}`);

  const syncLog = await prisma.syncLog.create({
    data: {
      syncType: "COMPANY",
      targetCompany: company.bmsSchema,
      startedAt: new Date(),
      status: SyncStatus.RUNNING,
    },
  });

  try {
    const result = await syncCompany(company);

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        completedAt: new Date(),
        status: SyncStatus.COMPLETED,
        companiesProcessed: 1,
        machinesProcessed: result.machinesProcessed,
        readingsProcessed: result.readingsProcessed,
        errors: result.errors.length > 0 ? result.errors.join("\n") : null,
      },
    });

    return result;
  } catch (error) {
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        completedAt: new Date(),
        status: SyncStatus.FAILED,
        errors: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}
