import { describe, expect, it } from 'vitest';
import { mapMachineRow } from '@/lib/query';

describe('mapMachineRow', () => {
  it('maps nullable and present fields correctly', () => {
    const row: any = {
      machinesid: 1,
      machinesno: 'M-1',
      machinename: 'Machine',
      serialnumber: 'SN-1',
      machines_category: 'Cat',
      vendorid: 2,
      machinestatus: 'Active',
      machine_make_name: 'Make',
      machine_model_name: 'Model',
      start_date: '2024-01-01',
      tags: null,
      contract_number: 'C-1',
      rental_start_date: null,
      rental_contract_months_remaining: null,
      rental_end_date: null,
      rental_amount_ex_vat: 100,
      machine_contract_type: 'Rental',
      other_fixed_amount_ex_vat: null,
      meterreadingid: 9,
      meterreading_no: 'R-9',
      reading_date: '2024-02-02',
      reported: 'Y',
      reading_date_time: new Date('2024-02-02T10:00:00Z'),
      asset: 1,
      totalamt: 200,
      a3: 10,
      black: 20,
      large: 30,
      colour: 40,
      extralarge: 50,
      vendorname: 'Vendor',
      user_name: 'User',
      rates_from: '2024-01-15',
      meters: 99,
      a4_mono: 1,
      a3_mono: 2,
      a4_colour: 3,
      a3_colour: 4,
      colour_extra_large: 5,
      date_saved: '2024-02-03',
      saved_by: 'Admin',
      Entity: 'alpha',
      company_machine_id: 'alpha1',
      machine_nr: 'M-1',
      machine: 'Machine',
      serial: 'SN-1',
      category: 'Cat',
      product: 'Model',
      company_schema: 'alpha'
    };

    const mapped = mapMachineRow(row);
    expect(mapped.machinesid).toBe(1);
    expect(mapped.contract_number).toBe('C-1');
    expect(mapped.rental_start_date).toBeNull();
    expect(mapped.vendorname).toBe('Vendor');
    expect(mapped.company_schema).toBe('alpha');
    expect(mapped.reading_date_time).toBe('2024-02-02T10:00:00.000Z');
  });
});
