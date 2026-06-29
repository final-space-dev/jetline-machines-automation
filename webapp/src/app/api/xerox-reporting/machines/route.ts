import { NextRequest, NextResponse } from "next/server";
import { xeroxPool } from "@/lib/xerox-pool";
import { bmsPool } from "@/lib/bms-pool";

export async function GET() {
  const xeroxClient = await xeroxPool.connect();
  const bmsClient = await bmsPool.connect();
  try {
    const result = await xeroxClient.query<{
      printer_id: number;
      serial_number: string;
      model: string;
      store: string | null;
      company_group: string | null;
      printer_type: string | null;
      model_name: string | null;
      reporting_enabled: boolean | null;
      latest_reading_date: string | null;
      last_seen: string | null;
    }>(
      `SELECT DISTINCT ON (pd.serial_number)
        pd.printer_id,
        pd.serial_number,
        pd.model,
        psm.store,
        psm.company_group,
        psm.printer_type,
        psm.model_name,
        psm.reporting_enabled,
        pd.last_seen::text AS last_seen,
        MAX(mr.report_date) OVER (PARTITION BY pd.printer_id)::text AS latest_reading_date
      FROM xerox.printer_dimensions pd
      LEFT JOIN xerox.printer_store_map psm ON psm.serial_number = pd.serial_number
      LEFT JOIN xerox.meter_readings_normalised mr ON mr.printer_id = pd.printer_id
      WHERE pd.manufacturer = 'Xerox' AND pd.serial_number IS NOT NULL
      ORDER BY pd.serial_number, (
        SELECT MAX(r2.report_date) FROM xerox.meter_readings_normalised r2
        WHERE r2.printer_id = pd.printer_id
      ) DESC NULLS LAST`
    );

    // BMS machines from Dagster ETL
    const bmsResult = await bmsClient.query<{
      serial_number: string;
      model_name: string | null;
      bms_site_name: string | null;
      company_id: string;
    }>(`SELECT serial_number, model_name, bms_site_name, company_id FROM machines.machines`);

    const bmsMap = new Map(
      bmsResult.rows.map((m) => [
        m.serial_number.trim().toUpperCase(),
        { modelName: m.model_name, siteName: m.bms_site_name, companyId: m.company_id },
      ])
    );

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const machines = result.rows.map((m) => {
      const key = (m.serial_number ?? "").trim().toUpperCase();
      const bms = bmsMap.get(key) ?? null;
      const lastSeenDate = m.last_seen ? new Date(m.last_seen) : null;
      const xeroxStatus = lastSeenDate && lastSeenDate >= sevenDaysAgo ? "Present" : "Missing";
      return {
        ...m,
        bms_found: bms !== null,
        bms_active: bms !== null,
        bms_company: bms?.siteName ?? null,
        xerox_status: xeroxStatus,
      };
    });

    // Groups from mapped machines in store map
    const groupsResult = await xeroxClient.query<{ company_group: string }>(
      `SELECT DISTINCT company_group FROM xerox.printer_store_map WHERE company_group IS NOT NULL ORDER BY company_group`
    );
    const groups = groupsResult.rows.map((r) => r.company_group);

    return NextResponse.json({ machines, companies: [], groups });
  } finally {
    xeroxClient.release();
    bmsClient.release();
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    rows: Array<{
      serial: string;
      model_name: string | null;
      store: string | null;
      group: string | null;
      type: string | null;
      reporting: boolean;
    }>;
  };

  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json({ error: "rows array required" }, { status: 400 });
  }

  const client = await xeroxPool.connect();
  try {
    await client.query(`
      ALTER TABLE xerox.printer_store_map
      ADD COLUMN IF NOT EXISTS model_name text
    `);

    let upserted = 0;
    for (const row of body.rows) {
      await client.query(
        `INSERT INTO xerox.printer_store_map
           (serial_number, store, company_group, printer_type, model_name, reporting_enabled, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (serial_number) DO UPDATE SET
           store             = COALESCE($2, xerox.printer_store_map.store),
           company_group     = COALESCE($3, xerox.printer_store_map.company_group),
           printer_type      = COALESCE($4, xerox.printer_store_map.printer_type),
           model_name        = COALESCE($5, xerox.printer_store_map.model_name),
           reporting_enabled = $6,
           updated_at        = NOW()`,
        [row.serial, row.store ?? null, row.group ?? null, row.type ?? null, row.model_name ?? null, row.reporting]
      );
      upserted++;
    }

    return NextResponse.json({ upserted });
  } finally {
    client.release();
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json() as {
    serial_number: string;
    store?: string | null;
    company_group?: string | null;
    printer_type?: string | null;
    model_name?: string | null;
    reporting_enabled?: boolean;
  };

  const { serial_number, store, company_group, printer_type, model_name, reporting_enabled } = body;
  if (!serial_number) {
    return NextResponse.json({ error: "serial_number required" }, { status: 400 });
  }

  const client = await xeroxPool.connect();
  try {
    await client.query(
      `INSERT INTO xerox.printer_store_map
         (serial_number, store, company_group, printer_type, model_name, reporting_enabled, updated_at)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, true), NOW())
       ON CONFLICT (serial_number) DO UPDATE SET
         store             = COALESCE($2, xerox.printer_store_map.store),
         company_group     = COALESCE($3, xerox.printer_store_map.company_group),
         printer_type      = COALESCE($4, xerox.printer_store_map.printer_type),
         model_name        = COALESCE($5, xerox.printer_store_map.model_name),
         reporting_enabled = COALESCE($6, xerox.printer_store_map.reporting_enabled),
         updated_at        = NOW()`,
      [
        serial_number,
        store ?? null,
        company_group ?? null,
        printer_type ?? null,
        model_name ?? null,
        reporting_enabled ?? null,
      ]
    );

    return NextResponse.json({ success: true });
  } finally {
    client.release();
  }
}
