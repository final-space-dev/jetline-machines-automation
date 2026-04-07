import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const COUNTER_LABELS: Record<string, string> = {
  black: "A4 Mono",
  a3: "A3 Mono",
  colour: "A4 Color",
  large: "A3 Color",
  extralarge: "Extra Long",
  total: "A4 Mono",
};

const BMS_TO_XEROX_LINE_DESC: Record<string, string> = {
  black: "Black Impressions",
  a3: "Black Large Impressions",
  colour: "Color Impressions",
  large: "Color Large Impressions",
  extralarge: "Extra Long Impressions",
  total: "Total Impressions",
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface RawReading {
  reading_date: Date;
  serial_number: string;
  store: string;
  company_group: string | null;
  region: string | null;
  category: string | null;
  model_name: string | null;
  make_name: string | null;
  install_date: Date | null;
  total: number;
  a3: number | null;
  black: number | null;
  large: number | null;
  colour: number | null;
  extra_large: number | null;
  incremental_total: number | null;
  incremental_a3: number | null;
  incremental_black: number | null;
  incremental_large: number | null;
  incremental_colour: number | null;
  incremental_xl: number | null;
}

interface CpcRow {
  serial_number: string;
  line_description: string;
  cpc: number;
}

async function fetchPerformanceData(validYears: number[]) {
  const minYear = Math.min(...validYears);
  const maxYear = Math.max(...validYears);
  const startDate = new Date(`${minYear}-01-01`);
  const endDate = new Date(`${maxYear + 1}-01-01`);

  const readings = await prisma.$queryRaw<RawReading[]>`
    SELECT
      mr.reading_date,
      m.serial_number,
      c.name AS store,
      c.company_group,
      c.region,
      cat.name AS category,
      m.model_name,
      m.make_name,
      m.install_date,
      mr.total,
      mr.a3,
      mr.black,
      mr.large,
      mr.colour,
      mr.extra_large,
      mr.incremental_total,
      mr.incremental_a3,
      mr.incremental_black,
      mr.incremental_large,
      mr.incremental_colour,
      mr.incremental_xl
    FROM meter_readings mr
    JOIN machines m ON mr.machine_id = m.id
    JOIN companies c ON m.company_id = c.id
    LEFT JOIN categories cat ON m.category_id = cat.id
    WHERE mr.reading_date >= ${startDate}
      AND mr.reading_date < ${endDate}
      AND m.status = 'ACTIVE'
    ORDER BY m.serial_number, mr.reading_date
  `;

  // Fetch latest CPC per serial + line description (flat dimension, not monthly)
  const cpcRows = await prisma.$queryRaw<CpcRow[]>`
    SELECT DISTINCT ON (serial_number, line_description)
      serial_number,
      line_description,
      cpc::float8 AS cpc
    FROM xerox_billings
    WHERE cpc IS NOT NULL
      AND line_description IS NOT NULL
    ORDER BY serial_number, line_description, billing_month DESC
  `;

  const cpcMap = new Map<string, number>();
  for (const row of cpcRows) {
    cpcMap.set(`${row.serial_number}|${row.line_description.toLowerCase()}`, row.cpc);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any[] = [];

  for (const r of readings) {
    const rDate = new Date(r.reading_date);
    const readingYear = rDate.getFullYear().toString();
    const readingMonthIdx = rDate.getMonth();
    const readingMonth = `${readingYear}-${String(readingMonthIdx + 1).padStart(2, "0")}`;

    const installDate = r.install_date
      ? new Date(r.install_date).toISOString().split("T")[0]
      : "—";

    const base = {
      store: r.store,
      group: r.company_group ?? "—",
      region: r.region ?? "—",
      category: r.category ?? "—",
      model: r.model_name ?? "—",
      make: r.make_name ?? "—",
      serial: r.serial_number,
      installDate,
      year: readingYear,
      monthName: MONTH_NAMES[readingMonthIdx],
      month: readingMonth,
      readingDate: rDate.toISOString().split("T")[0],
    };

    const usesBlack = (r.black ?? 0) > 0;
    const monoCounter = usesBlack
      ? { key: "black", volume: r.incremental_black, balance: r.black }
      : { key: "total", volume: r.incremental_total, balance: r.total };

    const counters: { key: string; volume: number | null; balance: number | null }[] = [
      monoCounter,
      { key: "a3", volume: r.incremental_a3, balance: r.a3 },
      { key: "colour", volume: r.incremental_colour, balance: r.colour },
      { key: "large", volume: r.incremental_large, balance: r.large },
      { key: "extralarge", volume: r.incremental_xl, balance: r.extra_large },
    ];

    for (const c of counters) {
      if (c.volume == null && c.balance == null) continue;
      if (c.volume === 0 && (c.balance ?? 0) === 0) continue;

      const xeroxLineDesc = BMS_TO_XEROX_LINE_DESC[c.key];
      const cpcKey = xeroxLineDesc ? `${r.serial_number}|${xeroxLineDesc.toLowerCase()}` : null;
      const cpc = cpcKey ? (cpcMap.get(cpcKey) ?? null) : null;
      const volume = c.volume ?? 0;
      const cost = cpc != null ? Math.round(volume * cpc * 100) / 100 : 0;

      const rowBase = {
        ...base,
        printType: COUNTER_LABELS[c.key] ?? c.key,
        cpc: cpc ?? 0,
      };

      // Melt into measure/value rows so user can pivot multiple measures at once
      data.push({ ...rowBase, measure: "Volume", value: volume });
      data.push({ ...rowBase, measure: "Balance", value: c.balance ?? 0 });
      data.push({ ...rowBase, measure: "Cost", value: cost });
    }
  }

  return data;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");

    const yearRows = await prisma.$queryRaw<{ yr: number }[]>`
      SELECT DISTINCT EXTRACT(YEAR FROM reading_date)::int AS yr
      FROM meter_readings
      WHERE reading_date >= '2010-01-01'
      ORDER BY yr DESC
    `;
    const allYears = yearRows.map((r) => String(r.yr));

    let targetYears: number[];

    if (year) {
      const yearList = year.split(",").map((y) => y.trim());
      for (const y of yearList) {
        if (!/^\d{4}$/.test(y)) {
          return NextResponse.json({ error: `Invalid year format: ${y}, use YYYY` }, { status: 400 });
        }
      }
      targetYears = yearList.map(Number).filter((y) => y >= 2010);
    } else {
      targetYears = allYears.slice(0, 3).map(Number);
    }

    if (targetYears.length === 0) {
      return NextResponse.json({ data: [], years: allYears, rowCount: 0 });
    }

    const data = await fetchPerformanceData(targetYears);

    return NextResponse.json({
      data,
      years: allYears,
      rowCount: data.length,
    });
  } catch (error) {
    console.error("Performance API error:", error);
    return NextResponse.json({ error: "Failed to fetch performance data" }, { status: 500 });
  }
}
