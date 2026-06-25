import { NextRequest, NextResponse } from "next/server";
import { xeroxPool } from "@/lib/xerox-pool";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const client = await xeroxPool.connect();
  try {
    const result = await client.query<{
      printer_id: number;
      serial_number: string;
      model: string;
      store: string | null;
      company_group: string | null;
      printer_type: string | null;
      reporting_enabled: boolean | null;
      latest_reading_date: string | null;
    }>(
      `SELECT DISTINCT ON (pd.serial_number)
        pd.printer_id,
        pd.serial_number,
        pd.model,
        psm.store,
        psm.company_group,
        psm.printer_type,
        psm.reporting_enabled,
        MAX(mr.report_date) OVER (PARTITION BY pd.printer_id)::text AS latest_reading_date
      FROM xerox.printer_dimensions pd
      LEFT JOIN xerox.printer_store_map psm ON psm.serial_number = pd.serial_number
      LEFT JOIN xerox.meter_readings_normalised mr ON mr.printer_id = pd.printer_id
      WHERE pd.manufacturer = 'Xerox'
      ORDER BY pd.serial_number, (
        SELECT MAX(r2.report_date) FROM xerox.meter_readings_normalised r2
        WHERE r2.printer_id = pd.printer_id
      ) DESC NULLS LAST`
    );

    // BMS machines for cross-reference
    const bmsRows = await prisma.machine.findMany({
      select: {
        serialNumber: true,
        bmsStatus: true,
        modelName: true,
        company: { select: { name: true } },
      },
    });

    // Normalise for lookup: trim + uppercase (skip rows with null serialNumber)
    const bmsMap = new Map(
      bmsRows
        .filter((m) => m.serialNumber != null)
        .map((m) => [
          m.serialNumber.trim().toUpperCase(),
          {
            bmsStatus: m.bmsStatus,   // 1=active, 0=inactive
            modelName: m.modelName,
            companyName: m.company?.name ?? null,
          },
        ])
    );

    // Merge BMS data onto each Xerox machine
    const machines = result.rows.map((m) => {
      const key = (m.serial_number ?? "").trim().toUpperCase();
      const bms = bmsMap.get(key) ?? null;
      return {
        ...m,
        bms_found: bms !== null,
        bms_active: bms ? bms.bmsStatus === 1 : null,
        bms_company: bms?.companyName ?? null,
      };
    });

    // BMS companies for the mapping dropdowns
    const companies = await prisma.company.findMany({
      where: { isActive: true },
      select: { id: true, name: true, companyGroup: true },
      orderBy: { name: "asc" },
    });

    const groups = Array.from(
      new Set(companies.map((c) => c.companyGroup).filter(Boolean))
    ).sort() as string[];

    return NextResponse.json({
      machines,
      companies: companies.map((c) => ({ id: c.id, name: c.name, group: c.companyGroup })),
      groups,
    });
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
    reporting_enabled?: boolean;
  };

  const { serial_number, store, company_group, printer_type, reporting_enabled } = body;
  if (!serial_number) {
    return NextResponse.json({ error: "serial_number required" }, { status: 400 });
  }

  const client = await xeroxPool.connect();
  try {
    await client.query(
      `INSERT INTO xerox.printer_store_map (serial_number, store, company_group, printer_type, reporting_enabled, updated_at)
       VALUES ($1, $2, $3, $4, COALESCE($5, true), NOW())
       ON CONFLICT (serial_number) DO UPDATE SET
         store             = COALESCE($2, xerox.printer_store_map.store),
         company_group     = COALESCE($3, xerox.printer_store_map.company_group),
         printer_type      = COALESCE($4, xerox.printer_store_map.printer_type),
         reporting_enabled = COALESCE($5, xerox.printer_store_map.reporting_enabled),
         updated_at        = NOW()`,
      [
        serial_number,
        store ?? null,
        company_group ?? null,
        printer_type ?? null,
        reporting_enabled ?? null,
      ]
    );

    return NextResponse.json({ success: true });
  } finally {
    client.release();
  }
}
