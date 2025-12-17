import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/analytics/companies
 * Get company-level performance analytics
 * Compares stores/entities against each other
 *
 * Query params:
 * - companyId: Filter by specific company (returns detailed breakdown)
 * - categoryId: Filter by category
 * - modelName: Filter by model
 * - period: Time period for volume calculation (30, 60, 90, 180, 365 days)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const companyIdFilter = searchParams.get("companyId");
    const categoryIdFilter = searchParams.get("categoryId");
    const modelNameFilter = searchParams.get("modelName");
    const period = parseInt(searchParams.get("period") || "90", 10);

    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - period);

    // If specific company requested, return detailed breakdown
    if (companyIdFilter) {
      return getCompanyDetails(
        companyIdFilter,
        periodStart,
        period,
        categoryIdFilter,
        modelNameFilter
      );
    }

    // Get all companies with their machine metrics
    const companies = await prisma.company.findMany({
      where: { isActive: true },
      include: {
        machines: {
          where: {
            status: "ACTIVE",
            categoryId: categoryIdFilter || undefined,
            modelName: modelNameFilter
              ? { contains: modelNameFilter, mode: "insensitive" }
              : undefined,
          },
          include: {
            category: { select: { name: true } },
            readings: {
              where: { readingDate: { gte: periodStart } },
              select: {
                incrementalTotal: true,
                incrementalColour: true,
                incrementalBlack: true,
                readingDate: true,
              },
            },
          },
        },
      },
    });

    const companyAnalytics = companies.map((company) => {
      // Calculate totals across all machines
      let totalVolume = 0;
      let totalColorVolume = 0;
      let totalBlackVolume = 0;
      let totalCurrentBalance = 0;

      // Category breakdown
      const categoryBreakdown: Record<
        string,
        { count: number; volume: number }
      > = {};

      // Model breakdown
      const modelBreakdown: Record<string, { count: number; volume: number }> =
        {};

      company.machines.forEach((machine) => {
        const machineVolume = machine.readings.reduce(
          (sum, r) => sum + (r.incrementalTotal || 0),
          0
        );
        const colorVol = machine.readings.reduce(
          (sum, r) => sum + (r.incrementalColour || 0),
          0
        );
        const blackVol = machine.readings.reduce(
          (sum, r) => sum + (r.incrementalBlack || 0),
          0
        );

        totalVolume += machineVolume;
        totalColorVolume += colorVol;
        totalBlackVolume += blackVol;
        totalCurrentBalance += machine.currentBalance;

        // Category breakdown
        const catName = machine.category?.name || "Uncategorized";
        if (!categoryBreakdown[catName]) {
          categoryBreakdown[catName] = { count: 0, volume: 0 };
        }
        categoryBreakdown[catName].count++;
        categoryBreakdown[catName].volume += machineVolume;

        // Model breakdown
        const modelName = machine.modelName || "Unknown";
        if (!modelBreakdown[modelName]) {
          modelBreakdown[modelName] = { count: 0, volume: 0 };
        }
        modelBreakdown[modelName].count++;
        modelBreakdown[modelName].volume += machineVolume;
      });

      const machineCount = company.machines.length;
      const avgVolumePerMachine =
        machineCount > 0 ? Math.round(totalVolume / machineCount) : 0;
      const dailyAverage = Math.round(totalVolume / period);
      const monthlyAverage = dailyAverage * 30;

      return {
        id: company.id,
        name: company.name,
        bmsSchema: company.bmsSchema,
        region: company.region,
        machineCount,
        statistics: {
          totalVolume,
          totalColorVolume,
          totalBlackVolume,
          totalCurrentBalance,
          avgVolumePerMachine,
          dailyAverage,
          monthlyAverage,
          colorPercentage:
            totalVolume > 0
              ? Math.round((totalColorVolume / totalVolume) * 100)
              : 0,
        },
        categoryBreakdown: Object.entries(categoryBreakdown)
          .map(([name, data]) => ({
            category: name,
            ...data,
          }))
          .sort((a, b) => b.volume - a.volume),
        topModels: Object.entries(modelBreakdown)
          .map(([name, data]) => ({
            model: name,
            ...data,
          }))
          .sort((a, b) => b.volume - a.volume)
          .slice(0, 5),
      };
    });

    // Sort by total volume
    companyAnalytics.sort(
      (a, b) => b.statistics.totalVolume - a.statistics.totalVolume
    );

    // Calculate fleet-wide statistics
    const fleetStats = {
      totalCompanies: companyAnalytics.length,
      totalMachines: companyAnalytics.reduce((sum, c) => sum + c.machineCount, 0),
      totalVolume: companyAnalytics.reduce(
        (sum, c) => sum + c.statistics.totalVolume,
        0
      ),
      avgVolumePerCompany:
        companyAnalytics.length > 0
          ? Math.round(
              companyAnalytics.reduce(
                (sum, c) => sum + c.statistics.totalVolume,
                0
              ) / companyAnalytics.length
            )
          : 0,
    };

    return NextResponse.json({
      period: {
        days: period,
        start: periodStart.toISOString(),
        end: new Date().toISOString(),
      },
      fleetStatistics: fleetStats,
      companies: companyAnalytics,
    });
  } catch (error) {
    console.error("Error fetching company analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch company analytics" },
      { status: 500 }
    );
  }
}

/**
 * Get detailed analytics for a specific company
 */
async function getCompanyDetails(
  companyId: string,
  periodStart: Date,
  period: number,
  categoryIdFilter: string | null,
  modelNameFilter: string | null
) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      machines: {
        where: {
          status: "ACTIVE",
          categoryId: categoryIdFilter || undefined,
          modelName: modelNameFilter
            ? { contains: modelNameFilter, mode: "insensitive" }
            : undefined,
        },
        include: {
          category: { select: { id: true, name: true } },
          readings: {
            where: { readingDate: { gte: periodStart } },
            orderBy: { readingDate: "asc" },
          },
        },
        orderBy: { currentBalance: "desc" },
      },
    },
  });

  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  // Build daily volume trend
  const dailyVolumes: Record<string, number> = {};
  const monthlyVolumes: Record<string, number> = {};

  company.machines.forEach((machine) => {
    machine.readings.forEach((reading) => {
      const day = reading.readingDate.toISOString().split("T")[0];
      const month = day.substring(0, 7);

      dailyVolumes[day] = (dailyVolumes[day] || 0) + (reading.incrementalTotal || 0);
      monthlyVolumes[month] =
        (monthlyVolumes[month] || 0) + (reading.incrementalTotal || 0);
    });
  });

  // Machine-level breakdown
  const machineDetails = company.machines.map((machine) => {
    const totalVolume = machine.readings.reduce(
      (sum, r) => sum + (r.incrementalTotal || 0),
      0
    );
    const colorVolume = machine.readings.reduce(
      (sum, r) => sum + (r.incrementalColour || 0),
      0
    );
    const blackVolume = machine.readings.reduce(
      (sum, r) => sum + (r.incrementalBlack || 0),
      0
    );

    return {
      id: machine.id,
      serialNumber: machine.serialNumber,
      modelName: machine.modelName,
      makeName: machine.makeName,
      category: machine.category?.name,
      currentBalance: machine.currentBalance,
      installDate: machine.installDate,
      contractType: machine.contractType,
      isLifted: machine.isLifted,
      periodVolume: totalVolume,
      colorVolume,
      blackVolume,
      dailyAverage: Math.round(totalVolume / period),
      monthlyAverage: Math.round((totalVolume / period) * 30),
      readingsCount: machine.readings.length,
    };
  });

  // Category summary
  const categoryMap = new Map<string, { count: number; volume: number }>();
  machineDetails.forEach((m) => {
    const cat = m.category || "Uncategorized";
    const existing = categoryMap.get(cat) || { count: 0, volume: 0 };
    categoryMap.set(cat, {
      count: existing.count + 1,
      volume: existing.volume + m.periodVolume,
    });
  });

  // Model summary
  const modelMap = new Map<string, { count: number; volume: number }>();
  machineDetails.forEach((m) => {
    const model = m.modelName || "Unknown";
    const existing = modelMap.get(model) || { count: 0, volume: 0 };
    modelMap.set(model, {
      count: existing.count + 1,
      volume: existing.volume + m.periodVolume,
    });
  });

  const totalVolume = machineDetails.reduce((sum, m) => sum + m.periodVolume, 0);
  const totalColor = machineDetails.reduce((sum, m) => sum + m.colorVolume, 0);
  const totalBlack = machineDetails.reduce((sum, m) => sum + m.blackVolume, 0);

  return NextResponse.json({
    company: {
      id: company.id,
      name: company.name,
      bmsSchema: company.bmsSchema,
      region: company.region,
    },
    period: {
      days: period,
      start: periodStart.toISOString(),
      end: new Date().toISOString(),
    },
    statistics: {
      machineCount: company.machines.length,
      totalVolume,
      totalColorVolume: totalColor,
      totalBlackVolume: totalBlack,
      avgVolumePerMachine:
        company.machines.length > 0
          ? Math.round(totalVolume / company.machines.length)
          : 0,
      dailyAverage: Math.round(totalVolume / period),
      monthlyAverage: Math.round((totalVolume / period) * 30),
      colorPercentage:
        totalVolume > 0 ? Math.round((totalColor / totalVolume) * 100) : 0,
    },
    trends: {
      daily: Object.entries(dailyVolumes)
        .map(([date, volume]) => ({ date, volume }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      monthly: Object.entries(monthlyVolumes)
        .map(([month, volume]) => ({ month, volume }))
        .sort((a, b) => a.month.localeCompare(b.month)),
    },
    categoryBreakdown: Array.from(categoryMap.entries())
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.volume - a.volume),
    modelBreakdown: Array.from(modelMap.entries())
      .map(([model, data]) => ({ model, ...data }))
      .sort((a, b) => b.volume - a.volume),
    machines: machineDetails,
  });
}
