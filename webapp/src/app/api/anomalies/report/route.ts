import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ABS_THRESHOLD = 7_500;
const PCT_THRESHOLD = 0.25;

export async function GET() {
  try {
    const startDate = new Date("2024-01-01");

    const readings = await prisma.meterReading.findMany({
      where: {
        readingDate: { gte: startDate },
        machine: { status: "ACTIVE" },
      },
      select: {
        id: true,
        bmsMeterReadingId: true,
        machineId: true,
        readingDate: true,
        total: true,
        a3: true,
        black: true,
        colour: true,
        large: true,
        extraLarge: true,
        incrementalTotal: true,
        machine: {
          select: {
            serialNumber: true,
            company: { select: { name: true, bmsSchema: true } },
          },
        },
      },
      orderBy: [{ machine: { company: { name: "asc" } } }, { machine: { serialNumber: "asc" } }, { readingDate: "asc" }],
    });

    // We need the previous reading per machine to compute movement on the first
    // reading in the window. Fetch one reading before startDate per machine.
    const machineIds = [...new Set(readings.map((r) => r.machineId))];
    const prevReadings = await prisma.meterReading.findMany({
      where: {
        machineId: { in: machineIds },
        readingDate: { lt: startDate },
      },
      select: {
        machineId: true,
        total: true,
        readingDate: true,
      },
      orderBy: { readingDate: "desc" },
    });

    // Keep only the most recent pre-window reading per machine
    const prevTotalByMachine = new Map<string, number>();
    for (const r of prevReadings) {
      if (!prevTotalByMachine.has(r.machineId)) {
        prevTotalByMachine.set(r.machineId, r.total);
      }
    }

    interface ReportRow {
      readingId: string;
      bmsMeterReadingId: number | null;
      serial: string;
      company: string;
      bmsSchema: string;
      readingDate: string;
      total: number;
      a3: number | null;
      black: number | null;
      colour: number | null;
      large: number | null;
      extraLarge: number | null;
      movement: number | null;
      movementPct: string | null;
      anomaly: string;
    }

    const rows: ReportRow[] = [];

    for (const r of readings) {
      const prevTotal = prevTotalByMachine.get(r.machineId);
      const movement = prevTotal != null ? r.total - prevTotal : null;
      prevTotalByMachine.set(r.machineId, r.total);

      let anomaly = "";
      if (movement != null) {
        const abs = Math.abs(movement);
        if (abs > ABS_THRESHOLD || (r.total > 0 && abs / r.total > PCT_THRESHOLD)) {
          anomaly = movement < 0 ? "BACKWARDS" : "SPIKE";
        }
      }

      const movementPct =
        movement != null && r.total > 0
          ? (((movement < 0 ? -1 : 1) * Math.abs(movement)) / r.total * 100).toFixed(1) + "%"
          : null;

      rows.push({
        readingId: r.id,
        bmsMeterReadingId: r.bmsMeterReadingId,
        serial: r.machine.serialNumber,
        company: r.machine.company.name,
        bmsSchema: r.machine.company.bmsSchema,
        readingDate: new Date(r.readingDate).toISOString().split("T")[0],
        total: r.total,
        a3: r.a3,
        black: r.black,
        colour: r.colour,
        large: r.large,
        extraLarge: r.extraLarge,
        movement,
        movementPct,
        anomaly,
      });
    }

    return NextResponse.json({ data: rows, count: rows.length });
  } catch (error) {
    console.error("Anomaly report error:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
