import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/analytics/models
 * Get model-based performance analytics
 * Compares machines of the SAME MODEL against each other
 *
 * Query params:
 * - modelName: Filter by specific model
 * - makeName: Filter by manufacturer
 * - companyId: Filter by company
 * - period: Time period for volume calculation (30, 60, 90, 180, 365 days)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const modelNameFilter = searchParams.get("modelName");
    const makeNameFilter = searchParams.get("makeName");
    const companyIdFilter = searchParams.get("companyId");
    const period = parseInt(searchParams.get("period") || "90", 10);

    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - period);

    // Get all distinct models with their machines
    const modelsQuery = await prisma.machine.groupBy({
      by: ["modelName"],
      where: {
        modelName: modelNameFilter
          ? { contains: modelNameFilter, mode: "insensitive" }
          : { not: null },
        makeName: makeNameFilter
          ? { contains: makeNameFilter, mode: "insensitive" }
          : undefined,
        companyId: companyIdFilter || undefined,
        status: "ACTIVE",
      },
      _count: { id: true },
    });

    const modelAnalytics = [];

    for (const modelGroup of modelsQuery) {
      if (!modelGroup.modelName) continue;

      // Get all machines of this model with their readings
      const machines = await prisma.machine.findMany({
        where: {
          modelName: modelGroup.modelName,
          status: "ACTIVE",
          companyId: companyIdFilter || undefined,
        },
        include: {
          company: {
            select: { id: true, name: true },
          },
          readings: {
            where: {
              readingDate: { gte: periodStart },
            },
            orderBy: { readingDate: "asc" },
          },
        },
      });

      // Calculate per-machine metrics
      const machineMetrics = machines.map((machine) => {
        // Calculate total volume for period using incremental readings
        const totalVolume = machine.readings.reduce((sum, r) => {
          return sum + (r.incrementalTotal || 0);
        }, 0);

        // Calculate daily average
        const daysInPeriod = Math.min(
          period,
          machine.installDate
            ? Math.floor(
                (Date.now() - new Date(machine.installDate).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            : period
        );
        const dailyAverage = daysInPeriod > 0 ? totalVolume / daysInPeriod : 0;
        const monthlyAverage = dailyAverage * 30;

        // Get latest reading
        const latestReading =
          machine.readings.length > 0
            ? machine.readings[machine.readings.length - 1]
            : null;

        return {
          id: machine.id,
          serialNumber: machine.serialNumber,
          company: machine.company,
          currentBalance: machine.currentBalance,
          installDate: machine.installDate,
          totalVolumeInPeriod: totalVolume,
          dailyAverage: Math.round(dailyAverage),
          monthlyAverage: Math.round(monthlyAverage),
          readingsCount: machine.readings.length,
          lastReadingDate: latestReading?.readingDate || machine.lastReadingDate,
          // Color vs black breakdown if available
          colorVolume: machine.readings.reduce(
            (sum, r) => sum + (r.incrementalColour || 0),
            0
          ),
          blackVolume: machine.readings.reduce(
            (sum, r) => sum + (r.incrementalBlack || 0),
            0
          ),
        };
      });

      // Calculate model-level statistics
      const totalVolumes = machineMetrics.map((m) => m.totalVolumeInPeriod);
      const monthlyAverages = machineMetrics.map((m) => m.monthlyAverage);

      const avgVolume =
        totalVolumes.length > 0
          ? totalVolumes.reduce((a, b) => a + b, 0) / totalVolumes.length
          : 0;

      const stdDev = calculateStdDev(totalVolumes);

      // Identify outliers (machines significantly above/below average)
      const outlierThreshold = 1.5; // 1.5 standard deviations
      const highPerformers = machineMetrics.filter(
        (m) => m.totalVolumeInPeriod > avgVolume + stdDev * outlierThreshold
      );
      const lowPerformers = machineMetrics.filter(
        (m) =>
          m.totalVolumeInPeriod < avgVolume - stdDev * outlierThreshold &&
          m.totalVolumeInPeriod > 0
      );

      modelAnalytics.push({
        modelName: modelGroup.modelName,
        makeName: machines[0]?.makeName || null,
        machineCount: machines.length,
        statistics: {
          totalVolume: totalVolumes.reduce((a, b) => a + b, 0),
          averageVolumePerMachine: Math.round(avgVolume),
          averageMonthlyPerMachine:
            monthlyAverages.length > 0
              ? Math.round(
                  monthlyAverages.reduce((a, b) => a + b, 0) /
                    monthlyAverages.length
                )
              : 0,
          minVolume: Math.min(...totalVolumes.filter((v) => v > 0), 0),
          maxVolume: Math.max(...totalVolumes, 0),
          standardDeviation: Math.round(stdDev),
        },
        outliers: {
          highPerformers: highPerformers.length,
          lowPerformers: lowPerformers.length,
        },
        machines: machineMetrics.sort(
          (a, b) => b.totalVolumeInPeriod - a.totalVolumeInPeriod
        ),
      });
    }

    // Sort models by total volume
    modelAnalytics.sort(
      (a, b) => b.statistics.totalVolume - a.statistics.totalVolume
    );

    return NextResponse.json({
      period: {
        days: period,
        start: periodStart.toISOString(),
        end: new Date().toISOString(),
      },
      totalModels: modelAnalytics.length,
      totalMachines: modelAnalytics.reduce((sum, m) => sum + m.machineCount, 0),
      models: modelAnalytics,
    });
  } catch (error) {
    console.error("Error fetching model analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch model analytics" },
      { status: 500 }
    );
  }
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;

  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map((value) => Math.pow(value - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;

  return Math.sqrt(avgSquareDiff);
}
