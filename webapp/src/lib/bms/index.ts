/**
 * BMS Integration Module
 * Exports all BMS-related functionality
 */

// Types
export type {
  BMSConnectionConfig,
  BMSMachineRow,
  BMSMeterReadingRow,
  CompanyBMSConfig,
  SyncResult,
  FullSyncSummary,
} from "./types";

// Connection management
export {
  getBMSConnection,
  createBMSConfig,
  testBMSConnection,
  closeAllBMSConnections,
  closeBMSConnection,
} from "./connection";

// Query functions
export {
  fetchAllMachines,
  fetchAllMeterReadings,
  fetchMeterReadingsForMachines,
  fetchMeterReadingsSince,
  fetchMachineCount,
  fetchReadingCount,
  fetchCategories,
  fetchModels,
  fetchMachinesWithLatestReading,
} from "./queries";

// Sync operations
export {
  syncCompany,
  syncCompanyById,
  runFullSync,
} from "./sync";
