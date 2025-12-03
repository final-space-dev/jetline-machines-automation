import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getDb, insertMachineRows, resetMachineData, type MachineRow } from '@/lib/sqlite';

const sampleRow = (schema: string, id: number): MachineRow => ({
  machinesid: id,
  machinesno: `M-${id}`,
  machinename: `Machine ${id}`,
  serialnumber: `SN-${id}`,
  machines_category: 'Test',
  vendorid: 1,
  machinestatus: 'Active',
  machine_make_name: 'Make',
  machine_model_name: 'Model',
  start_date: '2024-01-01',
  tags: null,
  contract_number: null,
  rental_start_date: null,
  rental_contract_months_remaining: null,
  rental_end_date: null,
  rental_amount_ex_vat: null,
  machine_contract_type: null,
  other_fixed_amount_ex_vat: null,
  meterreadingid: null,
  meterreading_no: null,
  reading_date: null,
  reported: null,
  reading_date_time: new Date('2024-02-02T10:00:00Z').toISOString(),
  asset: null,
  totalamt: null,
  a3: null,
  black: null,
  large: null,
  colour: null,
  extralarge: null,
  vendorname: 'Vendor',
  user_name: 'User Test',
  rates_from: null,
  meters: null,
  a4_mono: null,
  a3_mono: null,
  a4_colour: null,
  a3_colour: null,
  colour_extra_large: null,
  date_saved: null,
  saved_by: null,
  Entity: schema,
  company_machine_id: `${schema}-${id}`,
  machine_nr: `NR-${id}`,
  machine: `Machine ${id}`,
  serial: `SN-${id}`,
  category: 'Test',
  product: 'Product',
  company_schema: schema
});

describe('sqlite integration', () => {
  const originalCwd = process.cwd();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'machine-test-'));

  beforeAll(() => {
    process.chdir(tmpDir);
    process.env.MACHINE_DB_DIR = tmpDir;
  });

  afterAll(() => {
    process.chdir(originalCwd);
    delete process.env.MACHINE_DB_DIR;
    delete process.env.MACHINE_DB_PATH;
    const dbPath = path.join(tmpDir, 'runtime.db');
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates table, truncates, and inserts rows', () => {
    resetMachineData();
    const inserted = insertMachineRows([sampleRow('alpha', 1), sampleRow('beta', 2)]);
    expect(inserted).toBe(2);

    const db = getDb();
    const count = db.prepare('SELECT COUNT(*) as c FROM machine_data;').get() as { c: number };
    expect(count.c).toBe(2);

    const bySchema = db
      .prepare('SELECT COUNT(*) as c FROM machine_data WHERE company_schema = ?;')
      .get('alpha') as { c: number };
    expect(bySchema.c).toBe(1);
  });
});
