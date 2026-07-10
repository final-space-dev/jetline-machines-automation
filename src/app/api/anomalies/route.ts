import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ABS_THRESHOLD = 7_500;  // Movement > 7,500 in a single day
const PCT_THRESHOLD = 0.25;   // Movement > 25% of balance

function isAnomalousMovement(increment: number, balance: number): boolean {
  const abs = Math.abs(increment);
  if (abs > ABS_THRESHOLD) return true;
  if (balance > 0 && abs / balance > PCT_THRESHOLD) return true;
  return false;
}

// Shared detection logic — works on any set of readings per machine
function detectForMachine(
  allReadings: { id: string; bmsMeterReadingId: number | null; readingDate: Date; total: number; incrementalTotal: number | null; isAnomaly: boolean }[],
  filterStart?: Date,
) {
  interface AnomalyReading {
    id: string;
    bmsMeterReadingId: number | null;
    readingDate: string;
    total: number;
    dailyIncrement: number | null;
    incrementalTotal: number | null;
    isDetected: boolean;
    isTagged: boolean;
    reason: "backwards" | "spike" | null;
    pctOfBalance: number | null;
  }

  const anomalyReadings: AnomalyReading[] = [];
  let totalAffected = 0;

  for (let i = 0; i < allReadings.length; i++) {
    const r = allReadings[i];
    if (filterStart && r.readingDate < filterStart) continue;

    const prev = i > 0 ? allReadings[i - 1] : null;
    const increment = prev ? r.total - prev.total : null;

    let isDetected = false;
    let reason: AnomalyReading["reason"] = null;
    let pctOfBalance: number | null = null;

    if (increment != null && isAnomalousMovement(increment, r.total)) {
      isDetected = true;
      reason = increment < 0 ? "backwards" : "spike";
      const abs = Math.abs(increment);
      pctOfBalance = r.total > 0 ? (increment < 0 ? -abs / r.total : abs / r.total) : null;
      totalAffected += abs;
    }

    if (isDetected || r.isAnomaly) {
      if (pctOfBalance == null && increment != null && r.total > 0) {
        pctOfBalance = Math.abs(increment) / r.total;
      }
      anomalyReadings.push({
        id: r.id,
        bmsMeterReadingId: r.bmsMeterReadingId,
        readingDate: r.readingDate.toISOString().split("T")[0],
        total: r.total,
        dailyIncrement: increment,
        incrementalTotal: r.incrementalTotal,
        isDetected,
        isTagged: r.isAnomaly,
        reason,
        pctOfBalance,
      });
    }
  }

  return { anomalyReadings, totalAffected };
}

// --- GET: Detect anomalies ---

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");

    // No month param: return available months
    if (!month) {
      const result = await prisma.$queryRaw<{ month: string }[]>`
        SELECT DISTINCT TO_CHAR(reading_date, 'YYYY-MM') as month
        FROM meter_readings
        ORDER BY month DESC
        LIMIT 36
      `;
      return NextResponse.json({ months: ["all", ...result.map((r) => r.month)] });
    }

    if (month !== "all" && !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid month format" }, { status: 400 });
    }

    const isAll = month === "all";
    let monthStart: Date | undefined;
    let monthEnd: Date | undefined;

    if (!isAll) {
      const [year, mon] = month.split("-").map(Number);
      monthStart = new Date(year, mon - 1, 1);
      monthEnd = new Date(year, mon, 1);
    }

    const machines = await prisma.machine.findMany({
      where: { status: "ACTIVE" },
      include: {
        company: { select: { name: true, companyGroup: true } },
        category: { select: { name: true } },
      },
    });

    const machineIds = machines.map((m) => m.id);

    const readings = await prisma.meterReading.findMany({
      where: {
        machineId: { in: machineIds },
        ...(monthEnd ? { readingDate: { lt: monthEnd } } : {}),
      },
      select: {
        id: true,
        machineId: true,
        bmsMeterReadingId: true,
        readingDate: true,
        total: true,
        incrementalTotal: true,
        isAnomaly: true,
      },
      orderBy: [{ machineId: "asc" }, { readingDate: "asc" }, { bmsMeterReadingId: "asc" }],
    });

    const readingsByMachine = new Map<string, typeof readings>();
    for (const r of readings) {
      const arr = readingsByMachine.get(r.machineId) ?? [];
      arr.push(r);
      readingsByMachine.set(r.machineId, arr);
    }

    const machineMap = new Map(machines.map((m) => [m.id, m]));

    interface MachineAnomaly {
      machineId: string;
      serialNumber: string;
      store: string;
      companyGroup: string | null;
      model: string | null;
      category: string | null;
      anomalyCount: number;
      taggedCount: number;
      totalVolumeAffected: number;
      readings: ReturnType<typeof detectForMachine>["anomalyReadings"];
    }

    const results: MachineAnomaly[] = [];

    for (const [machineId, allReadings] of readingsByMachine) {
      const machine = machineMap.get(machineId);
      if (!machine) continue;

      if (monthStart) {
        const hasCurrentMonth = allReadings.some((r) => r.readingDate >= monthStart);
        if (!hasCurrentMonth) continue;
      }

      const { anomalyReadings, totalAffected } = detectForMachine(allReadings, monthStart);
      if (anomalyReadings.length === 0) continue;

      results.push({
        machineId,
        serialNumber: machine.serialNumber,
        store: machine.company.name,
        companyGroup: machine.company.companyGroup,
        model: machine.modelName,
        category: machine.category?.name ?? null,
        anomalyCount: anomalyReadings.filter((r) => r.isDetected).length,
        taggedCount: anomalyReadings.filter((r) => r.isTagged).length,
        totalVolumeAffected: Math.round(totalAffected),
        readings: anomalyReadings,
      });
    }

    results.sort((a, b) => b.totalVolumeAffected - a.totalVolumeAffected);

    return NextResponse.json({
      data: results,
      summary: {
        totalMachines: results.length,
        totalAnomalies: results.reduce((s, r) => s + r.anomalyCount, 0),
        totalTagged: results.reduce((s, r) => s + r.taggedCount, 0),
        totalVolumeAffected: results.reduce((s, r) => s + r.totalVolumeAffected, 0),
      },
    });
  } catch (error) {
    console.error("Anomalies API error:", error);
    return NextResponse.json({ error: "Failed to detect anomalies" }, { status: 500 });
  }
}

// --- POST: Tag, untag, or tag-all-detected ---

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids, action } = body as { ids?: string[]; action: "tag" | "untag" | "tag-all-detected" };

    if (action === "tag-all-detected") {
      // Run detection across ALL readings for ALL active machines, tag every detected anomaly
      const machines = await prisma.machine.findMany({
        where: { status: "ACTIVE" },
        select: { id: true },
      });
      const machineIds = machines.map((m) => m.id);

      const readings = await prisma.meterReading.findMany({
        where: { machineId: { in: machineIds } },
        select: {
          id: true,
          machineId: true,
          bmsMeterReadingId: true,
          readingDate: true,
          total: true,
          incrementalTotal: true,
          isAnomaly: true,
        },
        orderBy: [{ machineId: "asc" }, { readingDate: "asc" }, { bmsMeterReadingId: "asc" }],
      });

      const readingsByMachine = new Map<string, typeof readings>();
      for (const r of readings) {
        const arr = readingsByMachine.get(r.machineId) ?? [];
        arr.push(r);
        readingsByMachine.set(r.machineId, arr);
      }

      const idsToTag: string[] = [];
      for (const [, machineReadings] of readingsByMachine) {
        const { anomalyReadings } = detectForMachine(machineReadings);
        for (const ar of anomalyReadings) {
          if (ar.isDetected && !ar.isTagged) {
            idsToTag.push(ar.id);
          }
        }
      }

      if (idsToTag.length === 0) {
        return NextResponse.json({ updated: 0, action, message: "No new anomalies detected to tag." });
      }

      // Batch update in chunks of 1000
      let totalUpdated = 0;
      for (let i = 0; i < idsToTag.length; i += 1000) {
        const chunk = idsToTag.slice(i, i + 1000);
        const result = await prisma.meterReading.updateMany({
          where: { id: { in: chunk } },
          data: { isAnomaly: true },
        });
        totalUpdated += result.count;
      }

      return NextResponse.json({
        updated: totalUpdated,
        action,
        message: `Tagged ${totalUpdated} anomalous readings across all months. Performance will skip their movement.`,
      });
    }

    // Regular tag/untag by IDs
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array required" }, { status: 400 });
    }
    if (action !== "tag" && action !== "untag") {
      return NextResponse.json({ error: "action must be 'tag', 'untag', or 'tag-all-detected'" }, { status: 400 });
    }

    let totalUpdated = 0;
    for (let i = 0; i < ids.length; i += 1000) {
      const chunk = ids.slice(i, i + 1000);
      const result = await prisma.meterReading.updateMany({
        where: { id: { in: chunk } },
        data: { isAnomaly: action === "tag" },
      });
      totalUpdated += result.count;
    }

    return NextResponse.json({
      updated: totalUpdated,
      action,
      message: `${action === "tag" ? "Tagged" : "Untagged"} ${totalUpdated} readings. Performance will skip their movement.`,
    });
  } catch (error) {
    console.error("Tag anomaly error:", error);
    return NextResponse.json({ error: "Failed to update readings" }, { status: 500 });
  }
}
