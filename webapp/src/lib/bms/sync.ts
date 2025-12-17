/**
 * BMS Data Sync Service
 * Synchronizes data from BMS MySQL databases to local PostgreSQL
 */

import { PrismaClient, MachineStatus, SyncStatus } from "@prisma/client";
import {
  BMSConnectionConfig,
  BMSMachineRow,
  BMSMeterReadingRow,
  SyncResult,
  FullSyncSummary,
  CompanyBMSConfig,
} from "./types";
import { createBMSConfig, closeBMSConnection } from "./connection";
import { fetchAllMachines, fetchAllMeterReadings } from "./queries";

const prisma = new PrismaClient();

/**
 * Extract make name from model string
 * e.g., "Xerox VersaLink C7025" -> "Xerox"
 */
function extractMakeName(modelName: string | null): string | null {
  if (!modelName) return null;
  const parts = modelName.trim().split(/\s+/);
  return parts[0] || null;
}

/**
 * Calculate incremental values between consecutive readings
 */
function calculateIncrementals(
  current: BMSMeterReadingRow,
  previous: BMSMeterReadingRow | null
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
    return diff >= 0 ? diff : null; // Ignore negative increments (counter resets)
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

/**
 * Sync machines from a single BMS database to local PostgreSQL
 */
async function syncMachinesFromBMS(
  companyId: string,
  bmsConfig: BMSConnectionConfig,
  bmsRows: BMSMachineRow[]
): Promise<{ processed: number; errors: string[] }> {
  const errors: string[] = [];
  let processed = 0;

  // Get or create categories
  const categoryMap = new Map<string, string>();
  const categories = await prisma.category.findMany();
  categories.forEach((c) => categoryMap.set(c.name, c.id));

  for (const row of bmsRows) {
    try {
      // Skip if no serial number
      if (!row.serialnumber) continue;

      // Get or create category
      let categoryId: string | null = null;
      if (row.machines_category) {
        if (!categoryMap.has(row.machines_category)) {
          const category = await prisma.category.create({
            data: { name: row.machines_category },
          });
          categoryMap.set(row.machines_category, category.id);
        }
        categoryId = categoryMap.get(row.machines_category) || null;
      }

      // Determine machine status
      let status: MachineStatus = MachineStatus.ACTIVE;
      if (row.machinestatus === 0) {
        status = MachineStatus.INACTIVE;
      }

      // Convert bmsStatus to number (BMS returns it as string "0" or "1")
      const bmsStatusNum = row.machinestatus !== null && row.machinestatus !== undefined
        ? parseInt(String(row.machinestatus), 10)
        : null;

      // Convert rental amounts to numbers (BMS returns them as strings like "0.00")
      const rentalAmount = row.rental_amount_ex_vat !== null && row.rental_amount_ex_vat !== undefined
        ? parseFloat(String(row.rental_amount_ex_vat))
        : null;
      const otherFixedAmount = row.other_fixed_amount_ex_vat !== null && row.other_fixed_amount_ex_vat !== undefined
        ? parseFloat(String(row.other_fixed_amount_ex_vat))
        : null;

      // Upsert machine
      await prisma.machine.upsert({
        where: { serialNumber: row.serialnumber },
        create: {
          serialNumber: row.serialnumber,
          companyId,
          categoryId,
          bmsMachinesId: row.machinesid,
          bmsMachineNo: row.machinesno,
          machineName: row.machines_machine_name,
          makeName: extractMakeName(row.machine_model_name),
          modelName: row.machine_model_name,
          status,
          bmsStatus: bmsStatusNum,
          installDate: row.original_installation_date,
          startDate: row.start_date,
          contractNumber: row.machine_contract_no,
          contractType: row.machine_contract_type,
          rentalStartDate: row.rental_start_date,
          rentalEndDate: row.rental_end_date,
          rentalMonthsRemaining: row.rental_months_remaining,
          rentalAmountExVat: rentalAmount,
          otherFixedAmountExVat: otherFixedAmount,
          isLifted: row.lift === 1,
          lastSyncedAt: new Date(),
        },
        update: {
          companyId,
          categoryId,
          bmsMachinesId: row.machinesid,
          bmsMachineNo: row.machinesno,
          machineName: row.machines_machine_name,
          makeName: extractMakeName(row.machine_model_name),
          modelName: row.machine_model_name,
          status,
          bmsStatus: bmsStatusNum,
          installDate: row.original_installation_date,
          startDate: row.start_date,
          contractNumber: row.machine_contract_no,
          contractType: row.machine_contract_type,
          rentalStartDate: row.rental_start_date,
          rentalEndDate: row.rental_end_date,
          rentalMonthsRemaining: row.rental_months_remaining,
          rentalAmountExVat: rentalAmount,
          otherFixedAmountExVat: otherFixedAmount,
          isLifted: row.lift === 1,
          lastSyncedAt: new Date(),
        },
      });

      processed++;
    } catch (error) {
      errors.push(
        `Machine ${row.serialnumber}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return { processed, errors };
}

/**
 * Sync meter readings from BMS to local PostgreSQL
 */
async function syncReadingsFromBMS(
  bmsConfig: BMSConnectionConfig,
  bmsRows: BMSMeterReadingRow[]
): Promise<{ processed: number; errors: string[] }> {
  const errors: string[] = [];
  let processed = 0;

  // Build a map of machinesid -> local machine id
  const machines = await prisma.machine.findMany({
    where: { bmsMachinesId: { not: null } },
    select: { id: true, bmsMachinesId: true },
  });
  const machineIdMap = new Map<number, string>();
  machines.forEach((m) => {
    if (m.bmsMachinesId) machineIdMap.set(m.bmsMachinesId, m.id);
  });

  // Group readings by machine for incremental calculation
  const readingsByMachine = new Map<number, BMSMeterReadingRow[]>();
  for (const row of bmsRows) {
    if (!readingsByMachine.has(row.asset)) {
      readingsByMachine.set(row.asset, []);
    }
    readingsByMachine.get(row.asset)!.push(row);
  }

  // Process each machine's readings
  for (const [asset, readings] of readingsByMachine) {
    const machineId = machineIdMap.get(asset);
    if (!machineId) continue;

    // Sort by date
    readings.sort(
      (a, b) => new Date(a.reading_date).getTime() - new Date(b.reading_date).getTime()
    );

    let previousReading: BMSMeterReadingRow | null = null;
    let latestReading: BMSMeterReadingRow | null = null;

    for (const row of readings) {
      try {
        const incrementals = calculateIncrementals(row, previousReading);

        await prisma.meterReading.upsert({
          where: {
            machineId_readingDate_bmsMeterReadingId: {
              machineId,
              readingDate: new Date(row.reading_date),
              bmsMeterReadingId: row.meterreadingid,
            },
          },
          create: {
            machineId,
            bmsMeterReadingId: row.meterreadingid,
            bmsMeterReadingNo: row.meterreading_no,
            readingDate: new Date(row.reading_date),
            readingDateTime: row.createdtime,
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
            source: "BMS",
          },
          update: {
            bmsMeterReadingNo: row.meterreading_no,
            readingDateTime: row.createdtime,
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
          },
        });

        processed++;
        previousReading = row;
        latestReading = row;
      } catch (error) {
        errors.push(
          `Reading ${row.meterreadingid}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Update machine with latest reading info
    if (latestReading) {
      try {
        await prisma.machine.update({
          where: { id: machineId },
          data: {
            currentBalance: latestReading.total || 0,
            lastReadingDate: new Date(latestReading.reading_date),
          },
        });
      } catch (error) {
        errors.push(
          `Update machine balance: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  return { processed, errors };
}

/**
 * Sync a single company's BMS data
 */
export async function syncCompany(company: CompanyBMSConfig): Promise<SyncResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let machinesProcessed = 0;
  let readingsProcessed = 0;

  const bmsConfig = createBMSConfig(company.bmsSchema, company.bmsHost);

  try {
    console.log(`[Sync] Starting sync for ${company.name} (${company.bmsSchema})`);

    // Fetch all machines
    const bmsMultipleMachines = await fetchAllMachines(bmsConfig);
    console.log(`[Sync] Found ${bmsMultipleMachines.length} machines in ${company.bmsSchema}`);

    // Sync machines
    const machineResult = await syncMachinesFromBMS(
      company.id,
      bmsConfig,
      bmsMultipleMachines
    );
    machinesProcessed = machineResult.processed;
    errors.push(...machineResult.errors);

    // Fetch all readings
    const bmsReadings = await fetchAllMeterReadings(bmsConfig);
    console.log(`[Sync] Found ${bmsReadings.length} readings in ${company.bmsSchema}`);

    // Sync readings
    const readingResult = await syncReadingsFromBMS(bmsConfig, bmsReadings);
    readingsProcessed = readingResult.processed;
    errors.push(...readingResult.errors);

    console.log(
      `[Sync] Completed ${company.name}: ${machinesProcessed} machines, ${readingsProcessed} readings`
    );
  } catch (error) {
    errors.push(
      `Company sync failed: ${error instanceof Error ? error.message : String(error)}`
    );
    console.error(`[Sync] Error syncing ${company.name}:`, error);
  } finally {
    // Close connection to this BMS database
    await closeBMSConnection(bmsConfig);
  }

  return {
    companyId: company.id,
    companyName: company.name,
    bmsSchema: company.bmsSchema,
    machinesProcessed,
    readingsProcessed,
    errors,
    duration: Date.now() - startTime,
  };
}

/**
 * Run a full sync of all companies
 */
export async function runFullSync(): Promise<FullSyncSummary> {
  const startedAt = new Date();
  const companyResults: SyncResult[] = [];
  const errors: string[] = [];

  // Create sync log entry
  const syncLog = await prisma.syncLog.create({
    data: {
      syncType: "FULL",
      startedAt,
      status: SyncStatus.RUNNING,
    },
  });

  try {
    // Get all active companies with BMS config
    const companies = await prisma.company.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        bmsSchema: true,
        bmsHost: true,
      },
    });

    console.log(`[Sync] Starting full sync for ${companies.length} companies`);

    // Sync each company sequentially (to avoid overwhelming BMS servers)
    for (const company of companies) {
      const result = await syncCompany(company);
      companyResults.push(result);

      if (result.errors.length > 0) {
        errors.push(`${company.name}: ${result.errors.join("; ")}`);
      }
    }

    // Calculate totals
    const totalMachines = companyResults.reduce((sum, r) => sum + r.machinesProcessed, 0);
    const totalReadings = companyResults.reduce((sum, r) => sum + r.readingsProcessed, 0);

    // Update sync log
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        completedAt: new Date(),
        status: errors.length > 0 ? SyncStatus.COMPLETED : SyncStatus.COMPLETED,
        companiesProcessed: companies.length,
        machinesProcessed: totalMachines,
        readingsProcessed: totalReadings,
        errors: errors.length > 0 ? errors.join("\n") : null,
      },
    });

    console.log(
      `[Sync] Full sync completed: ${totalMachines} machines, ${totalReadings} readings`
    );

    return {
      syncId: syncLog.id,
      startedAt,
      completedAt: new Date(),
      companiesProcessed: companies.length,
      totalMachines,
      totalReadings,
      errors,
      companyResults,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(errorMessage);

    // Update sync log with failure
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

/**
 * Sync a specific company by ID
 */
export async function syncCompanyById(companyId: string): Promise<SyncResult> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      bmsSchema: true,
      bmsHost: true,
    },
  });

  if (!company) {
    throw new Error(`Company not found: ${companyId}`);
  }

  // Create sync log entry
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

    // Update sync log
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        completedAt: new Date(),
        status: result.errors.length > 0 ? SyncStatus.COMPLETED : SyncStatus.COMPLETED,
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
