/**
 * BMS Database Types
 * Raw data structures from the BMS MySQL databases
 */

// Raw row from bms_machines table
export interface BMSMachineRow {
  machinesid: number;
  serialnumber: string | null;
  machinesno: string | null;
  machines_machine_name: string | null;
  machines_category: string | null;
  machine_model_name: string | null;
  machinestatus: number | null;
  start_date: Date | null;
  original_installation_date: Date | null;
  machine_contract_no: string | null;
  machine_contract_type: string | null;
  rental_start_date: Date | null;
  rental_end_date: Date | null;
  rental_months_remaining: number | null;
  rental_amount_ex_vat: number | null;
  other_fixed_amount_ex_vat: number | null;
  lift: number | null;
  // vtiger_crmentity fields (from join)
  crmid?: number;
  smownerid?: number;
  createdtime?: Date;
  modifiedtime?: Date;
  label?: string;
  setype?: string;
}

// Raw row from bms_meterreading table
export interface BMSMeterReadingRow {
  meterreadingid: number;
  meterreading_no: string | null;
  asset: number; // machinesid
  reading_date: Date;
  total: number | null;
  a3: number | null;
  black: number | null;
  large: number | null;
  colour: number | null;
  extralarge: number | null;
  for_billing: number | null;
  is_opening_reading: number | null;
  is_closing_reading: number | null;
  is_reported: number | null;
  // vtiger_crmentity fields (from join)
  createdtime?: Date;
}

// BMS connection configuration
export interface BMSConnectionConfig {
  schema: string;
  host: string;
  port: number;
  user: string;
  password: string;
}

// Company database configuration (stored in our system)
export interface CompanyBMSConfig {
  id: string;
  name: string;
  bmsSchema: string;
  bmsHost: string | null;
}

// Sync result tracking
export interface SyncResult {
  companyId: string;
  companyName: string;
  bmsSchema: string;
  machinesProcessed: number;
  readingsProcessed: number;
  ratesProcessed: number;
  errors: string[];
  duration: number;
}

// Full sync summary
export interface FullSyncSummary {
  syncId: string;
  startedAt: Date;
  completedAt: Date | null;
  companiesProcessed: number;
  totalMachines: number;
  totalReadings: number;
  totalRates: number;
  errors: string[];
  companyResults: SyncResult[];
}

// Raw row from bms_machines_fsma_rates table
export interface BMSMachineRateRow {
  machineid: number;
  category: string | null;
  rates_from: Date;
  meters: number | null;
  a4_mono: number | null;
  a3_mono: number | null;
  a4_colour: number | null;
  a3_colour: number | null;
  colour_extra_large: number | null;
  date_saved: Date | null;
  saved_by: number | null;
}
