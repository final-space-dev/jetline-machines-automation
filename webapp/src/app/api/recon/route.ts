import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");

    // No month param: return available billing months
    if (!month) {
      const months = await prisma.xeroxBilling.findMany({
        select: { billingMonth: true },
        distinct: ["billingMonth"],
        orderBy: { billingMonth: "desc" },
      });
      return NextResponse.json({ months: months.map((m) => m.billingMonth) });
    }

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid month format, use YYYY-MM" }, { status: 400 });
    }

    // --- Xerox side: all rows for this billing month ---
    const xeroxRows = await prisma.xeroxBilling.findMany({
      where: { billingMonth: month },
      orderBy: [{ serialNumber: "asc" }, { printType: "asc" }, { lineIndex: "asc" }],
    });

    // --- Find the previous billing month's reading dates per serial ---
    // The previous month's readingDate IS the opening balance date for this month.
    // e.g. Jan 2026 billing: closing read = Feb 3, opening read = Jan 3 (Dec 2025's readingDate)
    const [prevYear, prevMonthNum] = month.split("-").map(Number);
    const prevDate = new Date(prevYear, prevMonthNum - 2, 1); // month - 1 in 0-indexed
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

    const prevXeroxRows = await prisma.xeroxBilling.findMany({
      where: { billingMonth: prevMonth, readingDate: { not: null } },
      select: { serialNumber: true, readingDate: true },
      distinct: ["serialNumber"],
    });
    const prevReadingDateBySerial = new Map(
      prevXeroxRows.map((r) => [r.serialNumber, r.readingDate!]),
    );

    // --- BMS side: machines ---
    const machines = await prisma.machine.findMany({
      include: { company: true, category: true },
    });
    const bmsBySerial = new Map(machines.map((m) => [m.serialNumber, m]));

    // Collect all unique machineIds we'll need readings for
    const machineIds = new Set<string>();
    for (const row of xeroxRows) {
      const bms = bmsBySerial.get(row.serialNumber);
      if (bms) machineIds.add(bms.id);
    }

    // Load ALL readings for relevant machines in a wide window around the billing month
    // so we can match to exact Xerox reading dates
    const windowStart = new Date(`${month}-01`);
    windowStart.setMonth(windowStart.getMonth() - 2);
    const windowEnd = new Date(`${month}-01`);
    windowEnd.setMonth(windowEnd.getMonth() + 2);

    const allReadings = await prisma.meterReading.findMany({
      where: {
        machineId: { in: Array.from(machineIds) },
        readingDate: { gte: windowStart, lt: windowEnd },
      },
      orderBy: { readingDate: "asc" },
    });

    // Group readings by machineId, sorted by date ascending
    const readingsByMachine = new Map<string, typeof allReadings>();
    for (const r of allReadings) {
      const arr = readingsByMachine.get(r.machineId) ?? [];
      arr.push(r);
      readingsByMachine.set(r.machineId, arr);
    }

    // Find BMS reading on or closest before a given date
    function findReading(machineId: string, targetDate: Date | null) {
      if (!targetDate) return undefined;
      const readings = readingsByMachine.get(machineId);
      if (!readings || readings.length === 0) return undefined;

      // Find reading on exact date or closest before
      let best: typeof readings[0] | undefined;
      for (const r of readings) {
        if (r.readingDate <= targetDate) {
          best = r;
        } else {
          break; // sorted asc, so we've passed the target
        }
      }
      return best;
    }

    // Find the opening BMS reading using the PREVIOUS month's Xerox readingDate.
    // Xerox reading dates define the period boundaries:
    //   Dec billing readingDate = Jan 3 (opening for Jan billing)
    //   Jan billing readingDate = Feb 3 (closing for Jan billing)
    // So volume = BMS on Feb 3 minus BMS on Jan 3.
    function findPreviousReading(machineId: string, serialNumber: string) {
      const prevReadDate = prevReadingDateBySerial.get(serialNumber);
      if (!prevReadDate) return undefined;
      return findReading(machineId, prevReadDate);
    }

    // Map Xerox Line Description to BMS counter fields.
    // This is the DEFINITIVE mapping — match on lineDescription, not printType.
    //
    // Xerox Line Description → BMS counter:
    //   "Black Impressions"       → black
    //   "Black Large Impressions" → a3
    //   "Color Impressions"       → colour
    //   "Color Large Impressions" → large
    //   "Extra Long Impressions"  → extralarge
    //   "MeterA - Total Sq Metres"→ total
    //   "Total Impressions"       → total
    const LINE_DESC_TO_BMS: Record<string, string> = {
      "black impressions": "black",
      "black large impressions": "a3",
      "color impressions": "colour",
      "color large impressions": "large",
      "extra long impressions": "extralarge",
      "metera - total sq metres": "total",
      "total impressions": "total",
    };

    function getBmsForType(
      lineDescription: string | null,
      printType: string,
      reading: typeof allReadings[0] | undefined,
      preReading: typeof allReadings[0] | undefined,
    ): { volume: number | null; balance: number | null; counterName: string | null } {
      if (!reading) return { volume: null, balance: null, counterName: null };

      // Determine BMS counter from lineDescription (preferred) or fall back to printType
      let bmsCounter: string | null = null;

      if (lineDescription) {
        bmsCounter = LINE_DESC_TO_BMS[lineDescription.toLowerCase()] ?? null;
        // B&W machines: "Black Impressions" should use `total` not `black`
        // because B&W machines store everything in `total` and `black` is always 0
        if (bmsCounter === "black") {
          const usesBlack = (reading.black ?? 0) > 0 || (preReading?.black ?? 0) > 0;
          if (!usesBlack) bmsCounter = "total";
        }
      }

      // Fallback: if no lineDescription (old data), infer from printType
      if (!bmsCounter && printType) {
        const pt = printType.toLowerCase();
        if (pt.includes("a4") && pt.includes("mono")) {
          // Use black if the machine has black counter, otherwise total
          const usesBlack = (reading.black ?? 0) > 0 || (preReading?.black ?? 0) > 0;
          bmsCounter = usesBlack ? "black" : "total";
        } else if (pt.includes("a3") && pt.includes("mono")) {
          bmsCounter = "a3";
        } else if (pt.includes("a4") && (pt.includes("col") || pt.includes("clr"))) {
          bmsCounter = "colour";
        } else if (pt.includes("a3") && (pt.includes("col") || pt.includes("clr"))) {
          bmsCounter = "large";
        }
      }

      if (!bmsCounter) return { volume: null, balance: null, counterName: null };

      // Read the appropriate counter
      const counterMap: Record<string, { current: number | null; prev: number | null; incremental: number | null }> = {
        black: { current: reading.black, prev: preReading?.black ?? null, incremental: reading.incrementalBlack },
        a3: { current: reading.a3, prev: preReading?.a3 ?? null, incremental: reading.incrementalA3 },
        colour: { current: reading.colour, prev: preReading?.colour ?? null, incremental: reading.incrementalColour },
        large: { current: reading.large, prev: preReading?.large ?? null, incremental: reading.incrementalLarge },
        extralarge: { current: reading.extraLarge, prev: preReading?.extraLarge ?? null, incremental: reading.incrementalXl },
        total: { current: reading.total, prev: preReading?.total ?? null, incremental: reading.incrementalTotal },
      };

      const c = counterMap[bmsCounter];
      if (!c) return { volume: null, balance: null, counterName: null };

      const volume = (c.current != null && c.prev != null)
        ? c.current - c.prev
        : c.incremental;

      return { volume, balance: c.current, counterName: bmsCounter };
    }

    // --- Build flat recon rows ---
    interface ReconRow {
      serialNumber: string;
      printType: string;
      lineDescription: string | null;
      lineIndex: number;
      bmsStore: string | null;
      xeroxStore: string | null;
      companyGroup: string | null;
      modelName: string | null;
      categoryName: string | null;
      bmsVolume: number | null;
      xeroxVolume: number;
      volumeDiff: number | null;
      bmsBalance: number | null;
      xeroxBalance: number | null;
      balanceDiff: number | null;
      fixedCharges: number;
      volumeCharges: number;
      xeroxCpc: number | null;
      matched: boolean;
      bmsStatus: string | null;
    }

    const recon: ReconRow[] = [];
    const uniqueSerials = new Set<string>();
    const inactiveSerials = new Set<string>();

    for (const row of xeroxRows) {
      const serial = row.serialNumber;
      const printType = (row.printType ?? "").trim();
      if (!printType) continue; // skip charge-only header rows

      const bms = bmsBySerial.get(serial);

      // Track inactive serials but exclude them from recon
      if (bms?.status === "INACTIVE") {
        inactiveSerials.add(serial);
        continue;
      }

      uniqueSerials.add(serial);

      // Closing BMS reading: use this month's Xerox readingDate
      // Opening BMS reading: use PREVIOUS month's Xerox readingDate (the prior period's closing date)
      const reading = bms ? findReading(bms.id, row.readingDate) : undefined;
      const preReading = bms ? findPreviousReading(bms.id, serial) : undefined;

      const xeroxBalance = row.currentReading;

      const { volume: bmsVol, balance: bmsBalance } = bms
        ? getBmsForType(row.lineDescription ?? null, printType, reading, preReading)
        : { volume: null, balance: null };

      const xeroxVol = row.totalClicks ?? 0;

      recon.push({
        serialNumber: serial,
        printType,
        lineDescription: row.lineDescription ?? null,
        lineIndex: row.lineIndex,
        bmsStore: bms?.company.name ?? null,
        xeroxStore: row.customer,
        companyGroup: bms?.company.companyGroup ?? null,
        modelName: bms?.modelName ?? row.product,
        categoryName: bms?.category?.name ?? null,
        bmsVolume: bmsVol != null ? Math.round(bmsVol) : null,
        xeroxVolume: Math.round(xeroxVol),
        volumeDiff: bmsVol != null ? Math.round(bmsVol) - Math.round(xeroxVol) : null,
        bmsBalance: bmsBalance != null ? Math.round(bmsBalance) : null,
        xeroxBalance: xeroxBalance != null ? Math.round(xeroxBalance) : null,
        balanceDiff: bmsBalance != null && xeroxBalance != null ? Math.round(bmsBalance) - Math.round(xeroxBalance) : null,
        fixedCharges: Number(row.rental ?? 0) + Number(row.fixedCharge ?? 0) + Number(row.otherCharge ?? 0),
        volumeCharges: Number(row.volumeCharges ?? 0),
        xeroxCpc: row.cpc != null ? Number(row.cpc) : null,
        matched: !!bms,
        bmsStatus: bms?.status ?? null,
      });
    }

    // Sort: unmatched first, then by store, serial, print type, lineIndex
    recon.sort((a, b) => {
      if (!a.matched && b.matched) return -1;
      if (a.matched && !b.matched) return 1;
      const storeA = a.bmsStore ?? a.xeroxStore ?? "";
      const storeB = b.bmsStore ?? b.xeroxStore ?? "";
      if (storeA !== storeB) return storeA.localeCompare(storeB);
      if (a.serialNumber !== b.serialNumber) return a.serialNumber.localeCompare(b.serialNumber);
      if (a.printType !== b.printType) return a.printType.localeCompare(b.printType);
      return a.lineIndex - b.lineIndex;
    });

    // Summary
    const matchedSerials = new Set(recon.filter((r) => r.matched).map((r) => r.serialNumber));

    const lastSync = await prisma.syncLog.findFirst({
      where: { status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
    });

    const startDate = new Date(`${month}-01`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    return NextResponse.json({
      data: recon,
      summary: {
        totalSerials: uniqueSerials.size,
        totalRows: recon.length,
        matched: matchedSerials.size,
        unmatched: uniqueSerials.size - matchedSerials.size,
        inactive: inactiveSerials.size,
        totalFixedCharges: recon.reduce((s, r) => s + r.fixedCharges, 0),
        totalVolumeCharges: recon.reduce((s, r) => s + r.volumeCharges, 0),
      },
      lastSync: lastSync
        ? {
            completedAt: lastSync.completedAt,
            machinesProcessed: lastSync.machinesProcessed,
            readingsProcessed: lastSync.readingsProcessed,
          }
        : null,
      dateRange: {
        start: startDate.toISOString().split("T")[0],
        end: endDate.toISOString().split("T")[0],
      },
    });
  } catch (error) {
    console.error("Recon API error:", error);
    return NextResponse.json({ error: "Failed to generate recon data" }, { status: 500 });
  }
}
