import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const months = searchParams.get("months") || "12";

    // Calculate date range
    let startDate: Date | null = null;
    if (months !== "all") {
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - parseInt(months, 10));
    }

    // Get all readings for the machine in the period
    const readings = await prisma.meterReading.findMany({
      where: {
        machineId: id,
        ...(startDate && { readingDate: { gte: startDate } }),
      },
      orderBy: {
        readingDate: "asc",
      },
      select: {
        readingDate: true,
        total: true,
        colour: true,
        black: true,
        incrementalTotal: true,
        incrementalColour: true,
        incrementalBlack: true,
      },
    });

    // Group readings by month and aggregate
    const monthlyMap = new Map<string, {
      endBalance: number;
      volume: number;
      colorVolume: number;
      blackVolume: number;
      lastDate: Date;
    }>();

    for (const reading of readings) {
      const date = new Date(reading.readingDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      const existing = monthlyMap.get(monthKey);
      if (existing) {
        // Update end balance if this reading is later
        if (date > existing.lastDate) {
          existing.endBalance = reading.total || 0;
          existing.lastDate = date;
        }
        // Sum incremental volumes
        existing.volume += reading.incrementalTotal || 0;
        existing.colorVolume += reading.incrementalColour || 0;
        existing.blackVolume += reading.incrementalBlack || 0;
      } else {
        monthlyMap.set(monthKey, {
          endBalance: reading.total || 0,
          volume: reading.incrementalTotal || 0,
          colorVolume: reading.incrementalColour || 0,
          blackVolume: reading.incrementalBlack || 0,
          lastDate: date,
        });
      }
    }

    // Convert to array and sort descending (newest first)
    const sortedMonths = Array.from(monthlyMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]));

    // Format monthly data with change calculations
    const monthly = sortedMonths.map(([monthKey, data], index) => {
      const [year, month] = monthKey.split("-");
      const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });

      // Get previous month's volume for change calculation
      const prevMonthData = index < sortedMonths.length - 1 ? sortedMonths[index + 1][1] : null;
      const prevVolume = prevMonthData?.volume ?? null;
      const change = prevVolume !== null && prevVolume > 0
        ? ((data.volume - prevVolume) / prevVolume) * 100
        : null;

      return {
        month: monthName,
        endBalance: data.endBalance,
        volume: data.volume,
        colorVolume: data.colorVolume,
        blackVolume: data.blackVolume,
        prevVolume,
        change,
      };
    });

    return NextResponse.json({ monthly });
  } catch (error) {
    console.error("Error fetching readings:", error);
    return NextResponse.json(
      { error: "Failed to fetch readings" },
      { status: 500 }
    );
  }
}
