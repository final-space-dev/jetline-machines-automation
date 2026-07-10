import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface XeroxRow {
  serial_number: string;
  billing_month: string;
  line_description: string;
  volume_charges: number | null;
  cpc: number | null;
  total_clicks: number | null;
  current_reading: number | null;
  customer: string | null;
  product: string | null;
  contract_start_date: string | null;
}

interface BmsRow {
  serial_number: string;
  store: string;
  company_group: string | null;
  category_name: string | null;
  install_date: string | null;
}

// Volume charge items we care about
const VOLUME_CHARGE_ITEMS = [
  "Black Impressions",
  "Black Large Impressions",
  "Color Impressions",
  "Color Large Impressions",
  "Extra Long Impressions",
  "Total Impressions",
];

// Which consolidated type each charge item belongs to
// "base" = the A4-equivalent base meter (volume IS the A4-equiv clicks)
// "surcharge" = stacks on top (A3, Extra Long) — volume is surcharge clicks only
type MeterRole = "base" | "surcharge";

interface ChargeItemMeta {
  consolidated: "Colour" | "Mono";
  role: MeterRole;
}

const CHARGE_ITEM_META: Record<string, ChargeItemMeta> = {
  "Color Impressions":       { consolidated: "Colour", role: "base" },
  "Color Large Impressions": { consolidated: "Colour", role: "surcharge" },
  "Extra Long Impressions":  { consolidated: "Colour", role: "surcharge" },
  "Black Impressions":       { consolidated: "Mono",   role: "base" },
  "Black Large Impressions": { consolidated: "Mono",   role: "surcharge" },
  "Total Impressions":       { consolidated: "Mono",   role: "base" },
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthsParam = searchParams.get("months"); // comma-separated: "2024-11,2024-12"

    const monthRows = await prisma.$queryRaw<{ billing_month: string }[]>`
      SELECT DISTINCT billing_month
      FROM xerox_billings
      ORDER BY billing_month DESC
    `;
    const allMonths = monthRows.map((r) => r.billing_month);

    if (allMonths.length === 0) {
      return NextResponse.json({ data: [], months: [], allMonths: [], monthCount: 0 });
    }

    // If specific months requested, use those; otherwise default to latest 3
    const reportMonths = monthsParam
      ? monthsParam.split(",").filter((m) => allMonths.includes(m))
      : allMonths.slice(0, 3);
    const monthCount = reportMonths.length;

    if (monthCount === 0) {
      return NextResponse.json({ data: [], months: [], allMonths, monthCount: 0 });
    }

    // Only fetch volume rows (Meter Tier lines)
    const xeroxRows = await prisma.$queryRaw<XeroxRow[]>`
      SELECT
        serial_number,
        billing_month,
        line_description,
        volume_charges::float8 AS volume_charges,
        cpc::float8 AS cpc,
        total_clicks,
        current_reading,
        customer,
        product,
        to_char(contract_start_date, 'YYYY-MM-DD') AS contract_start_date
      FROM xerox_billings
      WHERE billing_month = ANY(${reportMonths})
        AND line_description = ANY(${VOLUME_CHARGE_ITEMS})
      ORDER BY serial_number, billing_month
    `;

    const bmsRows = await prisma.$queryRaw<BmsRow[]>`
      SELECT
        m.serial_number,
        c.name AS store,
        c.company_group,
        cat.name AS category_name,
        to_char(m.install_date, 'YYYY-MM-DD') AS install_date
      FROM machines m
      JOIN companies c ON m.company_id = c.id
      LEFT JOIN categories cat ON m.category_id = cat.id
      WHERE m.status = 'ACTIVE'
    `;

    const bmsMap = new Map<string, BmsRow>();
    for (const row of bmsRows) {
      bmsMap.set(row.serial_number, row);
    }

    // Per serial + consolidated type, track per-month data
    // We need per-month granularity to compute A4-equiv vol and effective CPC correctly
    interface MonthMeterData {
      baseVolume: number;      // A4-equiv clicks from base meter
      baseCost: number;        // cost from base meter
      surchargeVolume: number; // surcharge clicks (A3 + XL)
      surchargeCost: number;   // cost from surcharge meters
      lastBaseReading: number | null;
    }

    // Key: "serial|Colour" or "serial|Mono"
    const consolidatedAggs = new Map<string, {
      months: Map<string, MonthMeterData>;
    }>();

    // Track customer/product/contractStartDate per serial
    const serialInfo = new Map<string, { customer: string; product: string; contractStartDate: string | null }>();

    for (const row of xeroxRows) {
      const ld = row.line_description;
      const meta = CHARGE_ITEM_META[ld];
      if (!meta) continue;

      // Track serial info
      let info = serialInfo.get(row.serial_number);
      if (!info) {
        info = { customer: row.customer ?? "", product: row.product ?? "", contractStartDate: null };
        serialInfo.set(row.serial_number, info);
      }
      if (row.customer) info.customer = row.customer;
      if (row.product) info.product = row.product;
      if (row.contract_start_date) info.contractStartDate = row.contract_start_date;

      const aggKey = `${row.serial_number}|${meta.consolidated}`;
      let agg = consolidatedAggs.get(aggKey);
      if (!agg) {
        agg = { months: new Map() };
        consolidatedAggs.set(aggKey, agg);
      }

      let md = agg.months.get(row.billing_month);
      if (!md) {
        md = { baseVolume: 0, baseCost: 0, surchargeVolume: 0, surchargeCost: 0, lastBaseReading: null };
        agg.months.set(row.billing_month, md);
      }

      const clicks = row.total_clicks ?? 0;
      const cost = row.volume_charges ?? 0;

      if (meta.role === "base") {
        md.baseVolume += clicks;
        md.baseCost += cost;
        // Track last base reading (for the A4-equiv meter balance)
        if (row.current_reading != null) {
          md.lastBaseReading = row.current_reading;
        }
      } else {
        md.surchargeVolume += clicks;
        md.surchargeCost += cost;
      }
    }

    // Build output — one row per serial + consolidated type
    interface OutputRow {
      group: string;
      store: string;
      serial: string;
      customer: string;
      product: string;
      category: string;
      installDate: string;
      type: string;
      a4EquivVol: number | null;   // avg monthly A4-equivalent volume (base meter)
      effectiveCpc: number | null;  // total cost / total base volume
      avgCost: number | null;       // avg monthly total cost (base + surcharge)
      lastRdg: number | null;       // last base meter reading
    }

    const data: OutputRow[] = [];

    for (const [key, agg] of consolidatedAggs.entries()) {
      const [serial, type] = key.split("|");
      const bms = bmsMap.get(serial);

      // Skip serials not in BMS (active machines only)
      if (!bms) continue;

      const info = serialInfo.get(serial);

      let totalBaseVol = 0;
      let totalCost = 0;
      let monthsWithBaseVol = 0;
      let lastBaseReading: number | null = null;

      // Process months in order
      const sortedMonths = Array.from(agg.months.entries()).sort((a, b) => a[0].localeCompare(b[0]));

      for (const [, md] of sortedMonths) {
        if (md.baseVolume > 0) {
          totalBaseVol += md.baseVolume;
          monthsWithBaseVol += 1;
        }
        totalCost += md.baseCost + md.surchargeCost;
        if (md.lastBaseReading != null) {
          lastBaseReading = md.lastBaseReading;
        }
      }

      // Skip if no meaningful data
      if (monthsWithBaseVol === 0 && totalCost === 0 && lastBaseReading == null) continue;

      // Effective CPC = total cost (base + surcharge) / total base volume
      const effectiveCpc = totalBaseVol > 0
        ? Math.round((totalCost / totalBaseVol) * 1000000) / 1000000
        : null;

      data.push({
        group: bms.company_group ?? "",
        store: bms.store ?? "",
        serial,
        customer: info?.customer ?? "",
        product: info?.product ?? "",
        category: bms.category_name ?? "",
        installDate: bms.install_date ?? info?.contractStartDate ?? "",
        type,
        a4EquivVol: monthsWithBaseVol > 0
          ? Math.round(totalBaseVol / monthsWithBaseVol)
          : null,
        effectiveCpc,
        avgCost: monthsWithBaseVol > 0
          ? Math.round(totalCost * 100 / monthsWithBaseVol) / 100
          : null,
        lastRdg: lastBaseReading,
      });
    }

    data.sort((a, b) =>
      (a.group || "").localeCompare(b.group || "") ||
      (a.store || "").localeCompare(b.store || "") ||
      a.serial.localeCompare(b.serial) ||
      a.type.localeCompare(b.type),
    );

    return NextResponse.json({
      data,
      months: reportMonths,
      allMonths,
      monthCount,
      rowCount: data.length,
    });
  } catch (error) {
    console.error("3-Month Report API error:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
