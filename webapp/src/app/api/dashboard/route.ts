import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/dashboard
 * Get dashboard summary statistics
 *
 * Query params:
 * - period: Number of days to analyze (default 90)
 * - companyId: Filter by specific company
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = parseInt(searchParams.get("period") || "90", 10);
    const companyIdFilter = searchParams.get("companyId");

    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - period);

    // Build company filter
    const companyFilter = companyIdFilter ? { companyId: companyIdFilter } : {};

    // Get base statistics in parallel
    const [
      totalMachines,
      activeMachines,
      machinesByStatus,
      machinesByCategory,
      companiesCount,
      categoriesCount,
      lastSyncLog,
      recentReadings,
    ] = await Promise.all([
      prisma.machine.count({ where: companyFilter }),
      prisma.machine.count({
        where: { ...companyFilter, status: "ACTIVE" },
      }),
      prisma.machine.groupBy({
        by: ["status"],
        where: companyFilter,
        _count: { status: true },
      }),
      prisma.machine.groupBy({
        by: ["categoryId"],
        where: companyFilter,
        _count: { categoryId: true },
      }),
      prisma.company.count({ where: { isActive: true } }),
      prisma.category.count(),
      prisma.syncLog.findFirst({
        where: { status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
      }),
      prisma.meterReading.findMany({
        where: {
          readingDate: { gte: periodStart },
          machine: companyFilter,
        },
        select: {
          readingDate: true,
          incrementalTotal: true,
          incrementalColour: true,
          incrementalBlack: true,
        },
      }),
    ]);

    // Calculate total balance from all machines
    const machinesWithBalance = await prisma.machine.findMany({
      where: companyFilter,
      select: { currentBalance: true },
    });
    const totalBalance = machinesWithBalance.reduce(
      (sum, m) => sum + m.currentBalance,
      0
    );

    // Calculate volume metrics from readings
    const totalVolumeInPeriod = recentReadings.reduce(
      (sum, r) => sum + (r.incrementalTotal || 0),
      0
    );
    const totalColorVolume = recentReadings.reduce(
      (sum, r) => sum + (r.incrementalColour || 0),
      0
    );
    const totalBlackVolume = recentReadings.reduce(
      (sum, r) => sum + (r.incrementalBlack || 0),
      0
    );

    // Build monthly volume trend
    const monthlyVolumes: Record<string, { total: number; color: number; black: number }> = {};
    recentReadings.forEach((r) => {
      const monthKey = r.readingDate.toISOString().substring(0, 7);
      if (!monthlyVolumes[monthKey]) {
        monthlyVolumes[monthKey] = { total: 0, color: 0, black: 0 };
      }
      monthlyVolumes[monthKey].total += r.incrementalTotal || 0;
      monthlyVolumes[monthKey].color += r.incrementalColour || 0;
      monthlyVolumes[monthKey].black += r.incrementalBlack || 0;
    });

    const volumeByMonth = Object.entries(monthlyVolumes)
      .map(([month, data]) => ({
        month,
        ...data,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Get category names
    const categoryIds = machinesByCategory
      .map((c) => c.categoryId)
      .filter(Boolean) as string[];
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
    });
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    // Get top machines by volume (period)
    const topMachineIds = await prisma.meterReading.groupBy({
      by: ["machineId"],
      where: {
        readingDate: { gte: periodStart },
        machine: companyFilter,
      },
      _sum: { incrementalTotal: true },
      orderBy: { _sum: { incrementalTotal: "desc" } },
      take: 10,
    });

    const topMachines = await prisma.machine.findMany({
      where: { id: { in: topMachineIds.map((m) => m.machineId) } },
      include: {
        company: { select: { name: true } },
        category: { select: { name: true } },
      },
    });

    // Merge with volume data
    const volumeMap = new Map(
      topMachineIds.map((m) => [m.machineId, m._sum.incrementalTotal || 0])
    );
    const topPerformers = topMachines
      .map((m) => ({
        id: m.id,
        serialNumber: m.serialNumber,
        modelName: m.modelName,
        company: m.company.name,
        category: m.category?.name,
        periodVolume: volumeMap.get(m.id) || 0,
        currentBalance: m.currentBalance,
      }))
      .sort((a, b) => b.periodVolume - a.periodVolume);

    // Get model distribution
    const modelDistribution = await prisma.machine.groupBy({
      by: ["modelName"],
      where: { ...companyFilter, modelName: { not: null } },
      _count: { modelName: true },
      _sum: { currentBalance: true },
      orderBy: { _count: { modelName: "desc" } },
      take: 10,
    });

    // Format responses
    const formattedMachinesByStatus = machinesByStatus.map((s) => ({
      status: s.status,
      count: s._count.status,
    }));

    const formattedMachinesByCategory = machinesByCategory.map((c) => ({
      category: c.categoryId
        ? categoryMap.get(c.categoryId) || "Unknown"
        : "Uncategorized",
      count: c._count.categoryId,
    }));

    const formattedModelDistribution = modelDistribution.map((m) => ({
      model: m.modelName || "Unknown",
      count: m._count.modelName,
      totalBalance: m._sum.currentBalance || 0,
    }));

    // Calculate averages
    const avgVolumePerMachine =
      activeMachines > 0 ? Math.round(totalVolumeInPeriod / activeMachines) : 0;
    const dailyAverage = Math.round(totalVolumeInPeriod / period);
    const monthlyAverage = dailyAverage * 30;

    return NextResponse.json({
      summary: {
        totalMachines,
        activeMachines,
        totalBalance,
        totalVolumeInPeriod,
        totalColorVolume,
        totalBlackVolume,
        avgVolumePerMachine,
        dailyAverage,
        monthlyAverage,
        companiesCount,
        categoriesCount,
        colorPercentage:
          totalVolumeInPeriod > 0
            ? Math.round((totalColorVolume / totalVolumeInPeriod) * 100)
            : 0,
      },
      period: {
        days: period,
        start: periodStart.toISOString(),
        end: new Date().toISOString(),
      },
      lastSync: lastSyncLog
        ? {
            completedAt: lastSyncLog.completedAt,
            machinesProcessed: lastSyncLog.machinesProcessed,
            readingsProcessed: lastSyncLog.readingsProcessed,
          }
        : null,
      machinesByStatus: formattedMachinesByStatus,
      machinesByCategory: formattedMachinesByCategory,
      modelDistribution: formattedModelDistribution,
      volumeByMonth,
      topPerformers,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}
