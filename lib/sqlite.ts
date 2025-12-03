import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

export type MachineRow = {
  machinesid: number | null;
  machinesno: string | null;
  machinename: string | null;
  serialnumber: string | null;
  machines_category: string | null;
  vendorid: number | null;
  machinestatus: string | null;
  machine_make_name: string | null;
  machine_model_name: string | null;
  start_date: string | null;
  tags: string | null;
  contract_number: string | null;
  rental_start_date: string | null;
  rental_contract_months_remaining: number | null;
  rental_end_date: string | null;
  rental_amount_ex_vat: number | null;
  machine_contract_type: string | null;
  other_fixed_amount_ex_vat: number | null;
  meterreadingid: number | null;
  meterreading_no: string | null;
  reading_date: string | null;
  reported: string | null;
  reading_date_time: string | null;
  asset: number | null;
  totalamt: number | null;
  a3: number | null;
  black: number | null;
  large: number | null;
  colour: number | null;
  extralarge: number | null;
  vendorname: string | null;
  user_name: string | null;
  rates_from: string | null;
  meters: number | null;
  a4_mono: number | null;
  a3_mono: number | null;
  a4_colour: number | null;
  a3_colour: number | null;
  colour_extra_large: number | null;
  date_saved: string | null;
  saved_by: string | null;
  Entity: string | null;
  company_machine_id: string | null;
  machine_nr: string | null;
  machine: string | null;
  serial: string | null;
  category: string | null;
  product: string | null;
  company_schema: string | null;
};

let db: Database.Database | null = null;

const DATA_DIR = process.env.MACHINE_DB_DIR
  ? path.resolve(process.env.MACHINE_DB_DIR)
  : path.join(process.cwd(), 'data');
const DB_PATH = process.env.MACHINE_DB_PATH
  ? path.resolve(process.env.MACHINE_DB_PATH)
  : path.join(DATA_DIR, 'runtime.db');

const MACHINE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS machine_data (
  machinesid INTEGER,
  machinesno TEXT,
  machinename TEXT,
  serialnumber TEXT,
  machines_category TEXT,
  vendorid INTEGER,
  machinestatus TEXT,
  machine_make_name TEXT,
  machine_model_name TEXT,
  start_date TEXT,
  tags TEXT,
  contract_number TEXT,
  rental_start_date TEXT,
  rental_contract_months_remaining REAL,
  rental_end_date TEXT,
  rental_amount_ex_vat REAL,
  machine_contract_type TEXT,
  other_fixed_amount_ex_vat REAL,
  meterreadingid INTEGER,
  meterreading_no TEXT,
  reading_date TEXT,
  reported TEXT,
  reading_date_time TEXT,
  asset INTEGER,
  totalamt REAL,
  a3 REAL,
  black REAL,
  large REAL,
  colour REAL,
  extralarge REAL,
  vendorname TEXT,
  user_name TEXT,
  rates_from TEXT,
  meters REAL,
  a4_mono REAL,
  a3_mono REAL,
  a4_colour REAL,
  a3_colour REAL,
  colour_extra_large REAL,
  date_saved TEXT,
  saved_by TEXT,
  Entity TEXT,
  company_machine_id TEXT,
  machine_nr TEXT,
  machine TEXT,
  serial TEXT,
  category TEXT,
  product TEXT,
  company_schema TEXT
);
CREATE INDEX IF NOT EXISTS idx_machine_data_schema ON machine_data(company_schema);
`;

export const getDb = () => {
  if (db) return db;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  db = new Database(DB_PATH);
  db.exec(MACHINE_TABLE_SQL);
  return db;
};

export const resetMachineData = () => {
  const instance = getDb();
  instance.exec('DELETE FROM machine_data;');
};

export const insertMachineRows = (rows: MachineRow[]) => {
  if (!rows.length) return 0;
  const instance = getDb();
  const insert = instance.prepare(
    `INSERT INTO machine_data (
      machinesid, machinesno, machinename, serialnumber, machines_category, vendorid, machinestatus, machine_make_name, machine_model_name,
      start_date, tags, contract_number, rental_start_date, rental_contract_months_remaining, rental_end_date, rental_amount_ex_vat,
      machine_contract_type, other_fixed_amount_ex_vat, meterreadingid, meterreading_no, reading_date, reported, reading_date_time,
      asset, totalamt, a3, black, large, colour, extralarge, vendorname, user_name, rates_from, meters, a4_mono, a3_mono, a4_colour,
      a3_colour, colour_extra_large, date_saved, saved_by, Entity, company_machine_id, machine_nr, machine, serial, category, product, company_schema
    ) VALUES (
      @machinesid, @machinesno, @machinename, @serialnumber, @machines_category, @vendorid, @machinestatus, @machine_make_name, @machine_model_name,
      @start_date, @tags, @contract_number, @rental_start_date, @rental_contract_months_remaining, @rental_end_date, @rental_amount_ex_vat,
      @machine_contract_type, @other_fixed_amount_ex_vat, @meterreadingid, @meterreading_no, @reading_date, @reported, @reading_date_time,
      @asset, @totalamt, @a3, @black, @large, @colour, @extralarge, @vendorname, @user_name, @rates_from, @meters, @a4_mono, @a3_mono, @a4_colour,
      @a3_colour, @colour_extra_large, @date_saved, @saved_by, @Entity, @company_machine_id, @machine_nr, @machine, @serial, @category, @product, @company_schema
    );`
  );
  const txn = instance.transaction((batch: MachineRow[]) => {
    for (const row of batch) {
      insert.run(row);
    }
  });
  txn(rows);
  return rows.length;
};
