import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Xerox Line Description → BMS counter mapping (DEFINITIVE)
const LINE_DESC_TO_BMS: Record<string, string> = {
  "black impressions": "black",
  "black large impressions": "a3",
  "color impressions": "colour",
  "color large impressions": "large",
  "extra long impressions": "extralarge",
  "metera - total sq metres": "total",
  "total impressions": "total",
};


function getBmsCounter(
  lineDescription: string | null,
  printType: string,
  hasBlackCounter: boolean,
): string | null {
  if (lineDescription) {
    const match = LINE_DESC_TO_BMS[lineDescription.toLowerCase()];
    if (match) {
      // B&W machines: "Black Impressions" should use `total` not `black`
      // because B&W machines store everything in `total` and `black` is always 0
      if (match === "black" && !hasBlackCounter) return "total";
      return match;
    }
  }

  // Fallback to printType inference
  const pt = printType.toLowerCase();
  if (pt.includes("a4") && pt.includes("mono")) return hasBlackCounter ? "black" : "total";
  if (pt.includes("a3") && pt.includes("mono")) return "a3";
  if (pt.includes("a4") && (pt.includes("col") || pt.includes("clr"))) return "colour";
  if (pt.includes("a3") && (pt.includes("col") || pt.includes("clr"))) return "large";
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");

    // No month: return available months
    if (!month) {
      const months = await prisma.xeroxBilling.findMany({
        select: { billingMonth: true },
        distinct: ["billingMonth"],
        orderBy: { billingMonth: "desc" },
      });
      return NextResponse.json({ months: months.map((m) => m.billingMonth) });
    }

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid month format" }, { status: 400 });
    }

    // --- Load all data ---

    // Xerox rows for this month
    const xeroxRows = await prisma.xeroxBilling.findMany({
      where: { billingMonth: month },
      orderBy: [{ serialNumber: "asc" }, { printType: "asc" }, { lineIndex: "asc" }],
    });

    // Previous month's reading dates (for opening balance)
    const [prevYear, prevMonthNum] = month.split("-").map(Number);
    const prevDate = new Date(prevYear, prevMonthNum - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

    const prevXeroxRows = await prisma.xeroxBilling.findMany({
      where: { billingMonth: prevMonth, readingDate: { not: null } },
      select: { serialNumber: true, readingDate: true },
      distinct: ["serialNumber"],
    });
    const prevReadingDateBySerial = new Map(
      prevXeroxRows.map((r) => [r.serialNumber, r.readingDate!]),
    );

    // All BMS machines
    const machines = await prisma.machine.findMany({
      include: { company: true, category: true },
    });
    const bmsBySerial = new Map(machines.map((m) => [m.serialNumber, m]));

    // Machine IDs we need readings for
    const machineIds = new Set<string>();
    for (const row of xeroxRows) {
      const bms = bmsBySerial.get(row.serialNumber);
      if (bms) machineIds.add(bms.id);
    }


    // Load readings in window
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

    const readingsByMachine = new Map<string, typeof allReadings>();
    for (const r of allReadings) {
      const arr = readingsByMachine.get(r.machineId) ?? [];
      arr.push(r);
      readingsByMachine.set(r.machineId, arr);
    }

    // Count anomalies per machine in this window (null incrementals)
    const anomalyCountByMachine = new Map<string, number>();
    for (const [machineId, readings] of readingsByMachine.entries()) {
      let count = 0;
      for (const r of readings) {
        if (r.incrementalTotal === null && r.total > 0) count++;
      }
      anomalyCountByMachine.set(machineId, count);
    }

    function findReading(machineId: string, targetDate: Date | null) {
      if (!targetDate) return undefined;
      const readings = readingsByMachine.get(machineId);
      if (!readings || readings.length === 0) return undefined;
      let best: typeof readings[0] | undefined;
      for (const r of readings) {
        if (r.readingDate <= targetDate) best = r;
        else break;
      }
      return best;
    }

    function findPreviousReading(machineId: string, serialNumber: string) {
      const prevReadDate = prevReadingDateBySerial.get(serialNumber);
      if (!prevReadDate) return undefined;
      return findReading(machineId, prevReadDate);
    }

    // --- Build audit rows ---
    interface AuditRow {
      serialNumber: string;
      printType: string;
      lineDescription: string | null;
      lineIndex: number;
      // Matching
      inBms: boolean;
      inXerox: boolean;
      bmsStatus: string | null;
      // Entity comparison
      bmsStore: string | null;
      xeroxEntity: string | null;
      entityMatch: boolean;
      // Model comparison
      bmsModel: string | null;
      xeroxProduct: string | null;
      modelMatch: boolean;
      // Category
      categoryName: string | null;
      companyGroup: string | null;
      // Counter mapping
      chargeItem: string | null;
      bmsCounter: string | null;
      // Volumes
      bmsVolume: number | null;
      xeroxVolume: number | null;
      volumeDiff: number | null;
      // Balances
      bmsBalance: number | null;
      xeroxBalance: number | null;
      balanceDiff: number | null;
      // Charges
      fixedCharges: number;
      volumeCharges: number;
      totalCharges: number;
      xeroxCpc: number | null;
      // Anomalies
      anomalyCount: number;
      // Data quality
      hasReadingDate: boolean;
      hasPreviousMonth: boolean;
    }

    const audit: AuditRow[] = [];
    const processedSerials = new Set<string>();

    // Process Xerox rows
    for (const row of xeroxRows) {
      const serial = row.serialNumber;
      const printType = (row.printType ?? "").trim();
      const isChargeOnly = !printType;

      processedSerials.add(serial);
      const bms = bmsBySerial.get(serial);

      // Skip inactive
      if (bms?.status === "INACTIVE") continue;

      // Volume/counter mapping only for rows with a printType
      let bmsCounter: string | null = null;
      let bmsVol: number | null = null;
      let bmsBal: number | null = null;
      let xeroxVol: number | null = null;
      let xeroxBal: number | null = null;

      if (!isChargeOnly) {
        const reading = bms ? findReading(bms.id, row.readingDate) : undefined;
        const preReading = bms ? findPreviousReading(bms.id, serial) : undefined;

        const hasBlack = (reading?.black ?? 0) > 0 || (preReading?.black ?? 0) > 0;
        bmsCounter = getBmsCounter(row.lineDescription ?? null, printType, hasBlack);

        if (reading && bmsCounter) {
          const counterMap: Record<string, { current: number | null; prev: number | null; incremental: number | null }> = {
            black: { current: reading.black, prev: preReading?.black ?? null, incremental: reading.incrementalBlack },
            a3: { current: reading.a3, prev: preReading?.a3 ?? null, incremental: reading.incrementalA3 },
            colour: { current: reading.colour, prev: preReading?.colour ?? null, incremental: reading.incrementalColour },
            large: { current: reading.large, prev: preReading?.large ?? null, incremental: reading.incrementalLarge },
            extralarge: { current: reading.extraLarge, prev: preReading?.extraLarge ?? null, incremental: reading.incrementalXl },
            total: { current: reading.total, prev: preReading?.total ?? null, incremental: reading.incrementalTotal },
          };
          const c = counterMap[bmsCounter];
          if (c) {
            bmsBal = c.current;
            bmsVol = (c.current != null && c.prev != null) ? c.current - c.prev : c.incremental;
          }
        }

        xeroxVol = row.totalClicks ?? 0;
        xeroxBal = row.currentReading;
      }

      // Entity match: BMS has short names ("Alberton"), Xerox has full legal names
      // ("D & R Print and Copy Solutions CC t/a Jetline Alberton")
      // Check if BMS store name is contained in Xerox entity (case-insensitive)
      const bmsStoreName = bms?.company.name ?? null;
      const xeroxEntity = row.customer ?? null;
      const entityMatch = bmsStoreName != null && xeroxEntity != null
        ? xeroxEntity.toLowerCase().includes(bmsStoreName.toLowerCase().trim())
        : false;

      // Model match
      const bmsModelName = bms?.modelName ?? null;
      const xeroxProduct = row.product ?? null;
      const modelMatch = bmsModelName != null && xeroxProduct != null
        ? bmsModelName.toLowerCase().trim() === xeroxProduct.toLowerCase().trim()
        : false;

      const fixed = Number(row.rental ?? 0) + Number(row.fixedCharge ?? 0) + Number(row.otherCharge ?? 0);
      const volCharges = Number(row.volumeCharges ?? 0);

      audit.push({
        serialNumber: serial,
        printType,
        lineDescription: row.lineDescription ?? null,
        lineIndex: row.lineIndex,
        inBms: !!bms,
        inXerox: true,
        bmsStatus: bms?.status ?? null,
        bmsStore: bmsStoreName,
        xeroxEntity,
        entityMatch: !!bms && entityMatch,
        bmsModel: bmsModelName,
        xeroxProduct,
        modelMatch: !!bms && modelMatch,
        categoryName: bms?.category?.name ?? null,
        companyGroup: bms?.company.companyGroup ?? null,
        chargeItem: row.lineDescription ?? null,
        bmsCounter,
        bmsVolume: bmsVol != null ? Math.round(bmsVol) : null,
        xeroxVolume: xeroxVol != null ? Math.round(xeroxVol) : null,
        volumeDiff: bmsVol != null && xeroxVol != null ? Math.round(bmsVol) - Math.round(xeroxVol) : null,
        bmsBalance: bmsBal != null ? Math.round(bmsBal) : null,
        xeroxBalance: xeroxBal != null ? Math.round(xeroxBal) : null,
        balanceDiff: bmsBal != null && xeroxBal != null ? Math.round(bmsBal) - Math.round(xeroxBal) : null,
        fixedCharges: fixed,
        volumeCharges: volCharges,
        totalCharges: fixed + volCharges,
        xeroxCpc: row.cpc != null ? Number(row.cpc) : null,
        anomalyCount: bms ? (anomalyCountByMachine.get(bms.id) ?? 0) : 0,
        hasReadingDate: !!row.readingDate,
        hasPreviousMonth: prevReadingDateBySerial.has(serial),
      });
    }

    // Sort: unmatched (not in BMS) first, then by store
    audit.sort((a, b) => {
      // Unmatched (not in BMS) first
      if (!a.inBms && b.inBms) return -1;
      if (a.inBms && !b.inBms) return 1;
      // Then by store
      const storeA = a.bmsStore ?? a.xeroxEntity ?? "";
      const storeB = b.bmsStore ?? b.xeroxEntity ?? "";
      if (storeA !== storeB) return storeA.localeCompare(storeB);
      if (a.serialNumber !== b.serialNumber) return a.serialNumber.localeCompare(b.serialNumber);
      if (a.printType !== b.printType) return a.printType.localeCompare(b.printType);
      return a.lineIndex - b.lineIndex;
    });

    // --- Summary stats ---
    const xeroxOnlySerials = new Set<string>();
    const matchedSerials = new Set<string>();
    const entityMismatchSerials = new Set<string>();
    const modelMismatchSerials = new Set<string>();
    const anomalySerials = new Set<string>();
    let totalFixed = 0;
    let totalVolCharges = 0;
    let totalXeroxVol = 0;
    let totalBmsVol = 0;
    let unmappedLines = 0;

    for (const row of audit) {
      if (row.inXerox && !row.inBms) xeroxOnlySerials.add(row.serialNumber);
      if (row.inBms && row.inXerox) matchedSerials.add(row.serialNumber);
      if (row.inBms && row.inXerox && !row.entityMatch) entityMismatchSerials.add(row.serialNumber);
      if (row.inBms && row.inXerox && !row.modelMatch) modelMismatchSerials.add(row.serialNumber);
      if (row.anomalyCount > 0) anomalySerials.add(row.serialNumber);
      totalFixed += row.fixedCharges;
      totalVolCharges += row.volumeCharges;
      totalXeroxVol += row.xeroxVolume ?? 0;
      totalBmsVol += row.bmsVolume ?? 0;
      if (row.inXerox && !row.bmsCounter && row.lineDescription) unmappedLines++;
    }

    const lastSync = await prisma.syncLog.findFirst({
      where: { status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
    });

    return NextResponse.json({
      data: audit,
      summary: {
        totalRows: audit.length,
        matchedSerials: matchedSerials.size,
        xeroxOnlySerials: xeroxOnlySerials.size,
        entityMismatches: entityMismatchSerials.size,
        modelMismatches: modelMismatchSerials.size,
        anomalyMachines: anomalySerials.size,
        unmappedLines,
        totalFixed,
        totalVolCharges,
        totalXeroxVol,
        totalBmsVol,
        volumeDiff: totalBmsVol - totalXeroxVol,
      },
      lastSync: lastSync
        ? {
            completedAt: lastSync.completedAt,
            machinesProcessed: lastSync.machinesProcessed,
            readingsProcessed: lastSync.readingsProcessed,
          }
        : null,
    });
  } catch (error) {
    console.error("Machines Audit API error:", error);
    return NextResponse.json({ error: "Failed to generate audit data" }, { status: 500 });
  }
}
