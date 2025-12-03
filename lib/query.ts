import type { RowDataPacket } from 'mysql2';
import type { MachineRow } from './sqlite';

const asValue = (value: unknown) => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value ?? null;
};

export const MACHINE_QUERY = `
SELECT
ma.machinesid,
ma.machinesno,
ma.machinename,
ma.serialnumber,
ma.machines_category,
ma.vendorid,
ma.machinestatus,
ma.machine_make_name,
ma.machine_model_name,
ma.start_date,
ma.tags,
ma.contract_number,
ma.rental_start_date,
ma.rental_contract_months_remaining,
ma.rental_end_date,
ma.rental_amount_ex_vat,
ma.machine_contract_type,
ma.other_fixed_amount_ex_vat,
mrd.meterreadingid,
mrd.meterreading_no,
mrd.reading_date,
mrd.reported,
crme.createdtime as reading_date_time,
mrd.asset,
mrd.total as totalamt,
mrd.a3,
mrd.black,
mrd.large,
mrd.colour,
mrd.extralarge,
ven.vendorname,
CONCAT(usr.first_name,' ',usr.last_name) as user_name,
rate.rates_from,
rate.meters,
rate.a4_mono,
rate.a3_mono,
rate.a4_colour,
rate.a3_colour,
rate.colour_extra_large,
rate.date_saved,
rate.saved_by,
? as Entity,
CONCAT(?, ma.machinesid) as company_machine_id,
ma.machinesno   as machine_nr,
ma.machinename  as machine,
ma.serialnumber as serial,
ma.machines_category as category,
ma.machine_model_name as product,
? as company_schema
FROM bms_machines ma
LEFT JOIN vtiger_crmentity crm on crm.crmid = ma.machinesid
LEFT JOIN (
  SELECT fsma1.*
  FROM bms_machines_fsma_rates fsma1
  LEFT JOIN bms_machines_fsma_rates fsma2
    ON fsma1.machineid = fsma2.machineid AND fsma1.date_saved < fsma2.date_saved
  WHERE fsma2.machineid IS NULL
) AS rate on rate.machineid = ma.machinesid
LEFT JOIN vtiger_vendor ven on ven.vendorid = ma.vendorid
LEFT JOIN vtiger_users usr on crm.smownerid = usr.id
LEFT JOIN bms_meterreading mrd on mrd.asset = ma.machinesid
LEFT JOIN vtiger_crmentity crme on crme.crmid = mrd.meterreadingid
WHERE crm.deleted <> 1
ORDER BY reading_date DESC;
`;

export const mapMachineRow = (row: RowDataPacket): MachineRow => ({
  machinesid: asValue(row.machinesid) as number | null,
  machinesno: asValue(row.machinesno) as string | null,
  machinename: asValue(row.machinename) as string | null,
  serialnumber: asValue(row.serialnumber) as string | null,
  machines_category: asValue(row.machines_category) as string | null,
  vendorid: asValue(row.vendorid) as number | null,
  machinestatus: asValue(row.machinestatus) as string | null,
  machine_make_name: asValue(row.machine_make_name) as string | null,
  machine_model_name: asValue(row.machine_model_name) as string | null,
  start_date: asValue(row.start_date) as string | null,
  tags: asValue(row.tags) as string | null,
  contract_number: asValue(row.contract_number) as string | null,
  rental_start_date: asValue(row.rental_start_date) as string | null,
  rental_contract_months_remaining: asValue(row.rental_contract_months_remaining) as number | null,
  rental_end_date: asValue(row.rental_end_date) as string | null,
  rental_amount_ex_vat: asValue(row.rental_amount_ex_vat) as number | null,
  machine_contract_type: asValue(row.machine_contract_type) as string | null,
  other_fixed_amount_ex_vat: asValue(row.other_fixed_amount_ex_vat) as number | null,
  meterreadingid: asValue(row.meterreadingid) as number | null,
  meterreading_no: asValue(row.meterreading_no) as string | null,
  reading_date: asValue(row.reading_date) as string | null,
  reported: asValue(row.reported) as string | null,
  reading_date_time: asValue(row.reading_date_time) as string | null,
  asset: asValue(row.asset) as number | null,
  totalamt: asValue(row.totalamt) as number | null,
  a3: asValue(row.a3) as number | null,
  black: asValue(row.black) as number | null,
  large: asValue(row.large) as number | null,
  colour: asValue(row.colour) as number | null,
  extralarge: asValue(row.extralarge) as number | null,
  vendorname: asValue(row.vendorname) as string | null,
  user_name: asValue(row.user_name) as string | null,
  rates_from: asValue(row.rates_from) as string | null,
  meters: asValue(row.meters) as number | null,
  a4_mono: asValue(row.a4_mono) as number | null,
  a3_mono: asValue(row.a3_mono) as number | null,
  a4_colour: asValue(row.a4_colour) as number | null,
  a3_colour: asValue(row.a3_colour) as number | null,
  colour_extra_large: asValue(row.colour_extra_large) as number | null,
  date_saved: asValue(row.date_saved) as string | null,
  saved_by: asValue(row.saved_by) as string | null,
  Entity: asValue(row.Entity) as string | null,
  company_machine_id: asValue(row.company_machine_id) as string | null,
  machine_nr: asValue(row.machine_nr) as string | null,
  machine: asValue(row.machine) as string | null,
  serial: asValue(row.serial) as string | null,
  category: asValue(row.category) as string | null,
  product: asValue(row.product) as string | null,
  company_schema: asValue(row.company_schema) as string | null
});
