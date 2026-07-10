import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface BmsMachine {
  serial_number: string;
  store: string;
  company_group: string | null;
  category_name: string | null;
  model_name: string | null;
  install_date: string | null;
  status: string;
}

interface XeroxSerial {
  serial_number: string;
  customer: string | null;
  product: string | null;
  total_billed: number;
  latest_month: string;
  contract_start_date: string | null;
}

export async function GET() {
  try {
    // Get latest billing months available
    const monthRows = await prisma.$queryRaw<{ billing_month: string }[]>`
      SELECT DISTINCT billing_month
      FROM xerox_billings
      ORDER BY billing_month DESC
    `;
    const allMonths = monthRows.map((r) => r.billing_month);
    const reportMonths = allMonths.slice(0, 3);

    if (reportMonths.length === 0) {
      return NextResponse.json({ data: [], months: [] });
    }

    // All active BMS machines
    const bmsMachines = await prisma.$queryRaw<BmsMachine[]>`
      SELECT
        m.serial_number,
        c.name AS store,
        c.company_group,
        cat.name AS category_name,
        m.model_name,
        to_char(m.install_date, 'YYYY-MM-DD') AS install_date,
        m.status::text AS status
      FROM machines m
      JOIN companies c ON m.company_id = c.id
      LEFT JOIN categories cat ON m.category_id = cat.id
      WHERE m.status = 'ACTIVE'
    `;

    const bmsMap = new Map<string, BmsMachine>();
    for (const m of bmsMachines) {
      bmsMap.set(m.serial_number, m);
    }

    // All Xerox serials with actual billing (total_charges > 0) in recent months
    const xeroxSerials = await prisma.$queryRaw<XeroxSerial[]>`
      SELECT
        serial_number,
        MAX(customer) AS customer,
        MAX(product) AS product,
        SUM(COALESCE(total_charges::float8, 0)) AS total_billed,
        MAX(billing_month) AS latest_month,
        MAX(to_char(contract_start_date, 'YYYY-MM-DD')) AS contract_start_date
      FROM xerox_billings
      WHERE billing_month = ANY(${reportMonths})
      GROUP BY serial_number
      HAVING SUM(COALESCE(total_charges::float8, 0)) > 0
    `;

    const xeroxMap = new Map<string, XeroxSerial>();
    for (const x of xeroxSerials) {
      xeroxMap.set(x.serial_number, x);
    }

    // Build output
    interface OutputRow {
      serial: string;
      source: "BMS Only" | "Xerox Only" | "Both";
      store: string;
      group: string;
      category: string;
      model: string;
      installDate: string;
      customer: string;
      product: string;
      totalBilled: number | null;
      latestMonth: string;
    }

    const data: OutputRow[] = [];

    // BMS machines — check if in Xerox
    for (const [serial, bms] of bmsMap.entries()) {
      const xerox = xeroxMap.get(serial);
      data.push({
        serial,
        source: xerox ? "Both" : "BMS Only",
        store: bms.store,
        group: bms.company_group ?? "",
        category: bms.category_name ?? "",
        model: bms.model_name ?? "",
        installDate: bms.install_date ?? xerox?.contract_start_date ?? "",
        customer: xerox?.customer ?? "",
        product: xerox?.product ?? "",
        totalBilled: xerox?.total_billed ?? null,
        latestMonth: xerox?.latest_month ?? "",
      });
    }

    // Xerox-only serials (not in BMS active)
    for (const [serial, xerox] of xeroxMap.entries()) {
      if (bmsMap.has(serial)) continue;
      data.push({
        serial,
        source: "Xerox Only",
        store: "",
        group: "",
        category: "",
        model: "",
        installDate: xerox.contract_start_date ?? "",
        customer: xerox.customer ?? "",
        product: xerox.product ?? "",
        totalBilled: xerox.total_billed,
        latestMonth: xerox.latest_month,
      });
    }

    data.sort((a, b) => {
      // Xerox Only first, then BMS Only, then Both
      const order = { "Xerox Only": 0, "BMS Only": 1, "Both": 2 };
      return (order[a.source] - order[b.source]) || a.serial.localeCompare(b.serial);
    });

    const counts = {
      bmsOnly: data.filter((r) => r.source === "BMS Only").length,
      xeroxOnly: data.filter((r) => r.source === "Xerox Only").length,
      both: data.filter((r) => r.source === "Both").length,
    };

    return NextResponse.json({
      data,
      months: reportMonths,
      counts,
    });
  } catch (error) {
    console.error("Existence Recon API error:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
