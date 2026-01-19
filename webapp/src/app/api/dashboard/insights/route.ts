import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/dashboard/insights
 * Get actionable executive insights: anomalies, alerts, and recommendations
 *
 * Returns:
 * - Aging high performers (machines performing well but getting old)
 * - Underutilized new machines (new machines not getting enough volume)
 * - Contract alerts (expired and expiring)
 * - Store imbalances (stores missing capabilities or under/over capacity)
 * - Lift suggestions (machines that should be moved)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = parseInt(searchParams.get("period") || "90", 10);

    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - period);

    const now = new Date();
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);

    // Define "old" machine threshold (e.g., installed > 5 years ago)
    const oldMachineThreshold = new Date();
    oldMachineThreshold.setFullYear(oldMachineThreshold.getFullYear() - 5);

    // Define "new" machine threshold (e.g., installed < 1 year ago)
    const newMachineThreshold = new Date();
    newMachineThreshold.setFullYear(newMachineThreshold.getFullYear() - 1);

    // Get all active machines with readings and company info
    const machines = await prisma.machine.findMany({
      where: { status: "ACTIVE" },
      include: {
        company: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        readings: {
          where: { readingDate: { gte: periodStart } },
          select: { incrementalTotal: true, incrementalColour: true, incrementalBlack: true },
        },
      },
    });

    // Calculate volume metrics for each machine
    const machineMetrics = machines.map((machine) => {
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

      // Calculate age in months
      const installDate = machine.installDate ? new Date(machine.installDate) : null;
      const ageInMonths = installDate
        ? Math.floor((now.getTime() - installDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
        : null;

      // Calculate monthly average
      const monthlyAverage = Math.round((totalVolume / period) * 30);

      return {
        id: machine.id,
        serialNumber: machine.serialNumber,
        modelName: machine.modelName,
        makeName: machine.makeName,
        company: machine.company,
        category: machine.category,
        installDate: machine.installDate,
        ageInMonths,
        isOld: installDate ? installDate < oldMachineThreshold : false,
        isNew: installDate ? installDate > newMachineThreshold : false,
        contractType: machine.contractType,
        rentalEndDate: machine.rentalEndDate,
        rentalMonthsRemaining: machine.rentalMonthsRemaining,
        currentBalance: machine.currentBalance,
        periodVolume: totalVolume,
        colorVolume,
        blackVolume,
        monthlyAverage,
        readingsCount: machine.readings.length,
      };
    });

    // Calculate model averages for comparison
    const modelAverages = new Map<string, { avg: number; count: number }>();
    machineMetrics.forEach((m) => {
      if (m.modelName) {
        const current = modelAverages.get(m.modelName) || { avg: 0, count: 0 };
        const newTotal = current.avg * current.count + m.periodVolume;
        const newCount = current.count + 1;
        modelAverages.set(m.modelName, { avg: newTotal / newCount, count: newCount });
      }
    });

    // Calculate overall fleet average
    const fleetAvg =
      machineMetrics.length > 0
        ? machineMetrics.reduce((sum, m) => sum + m.periodVolume, 0) / machineMetrics.length
        : 0;

    // 1. AGING HIGH PERFORMERS
    // Machines that are old (>5 years) but performing above average for their model
    const agingHighPerformers = machineMetrics
      .filter((m) => {
        if (!m.isOld || !m.modelName) return false;
        const modelAvg = modelAverages.get(m.modelName);
        if (!modelAvg) return false;
        // Performing at least 20% above model average
        return m.periodVolume > modelAvg.avg * 1.2;
      })
      .sort((a, b) => b.periodVolume - a.periodVolume)
      .slice(0, 10)
      .map((m) => ({
        ...m,
        vsModelAvg: Math.round(
          ((m.periodVolume - (modelAverages.get(m.modelName!)?.avg || 0)) /
            (modelAverages.get(m.modelName!)?.avg || 1)) *
            100
        ),
        recommendation: "Consider upgrading to newer model - high usage on aging equipment",
      }));

    // 2. UNDERUTILIZED NEW MACHINES
    // Machines installed < 1 year ago but performing below fleet average
    const underutilizedNew = machineMetrics
      .filter((m) => {
        if (!m.isNew) return false;
        // Performing below 50% of fleet average
        return m.periodVolume < fleetAvg * 0.5 && m.readingsCount > 0;
      })
      .sort((a, b) => a.periodVolume - b.periodVolume)
      .slice(0, 10)
      .map((m) => ({
        ...m,
        vsFleetAvg: Math.round(((m.periodVolume - fleetAvg) / fleetAvg) * 100),
        recommendation: "New machine underutilized - consider relocating to higher volume store",
      }));

    // 3. CONTRACT ALERTS
    const expiredContracts = await prisma.machine.findMany({
      where: {
        status: "ACTIVE",
        rentalEndDate: { lt: now },
      },
      include: {
        company: { select: { id: true, name: true } },
        category: { select: { name: true } },
      },
      orderBy: { rentalEndDate: "asc" },
      take: 20,
    });

    const expiringContracts = await prisma.machine.findMany({
      where: {
        status: "ACTIVE",
        rentalEndDate: {
          gte: now,
          lt: sixMonthsFromNow,
        },
      },
      include: {
        company: { select: { id: true, name: true } },
        category: { select: { name: true } },
      },
      orderBy: { rentalEndDate: "asc" },
      take: 20,
    });

    const urgentContracts = await prisma.machine.findMany({
      where: {
        status: "ACTIVE",
        rentalEndDate: {
          gte: now,
          lt: threeMonthsFromNow,
        },
      },
      include: {
        company: { select: { id: true, name: true } },
        category: { select: { name: true } },
      },
      orderBy: { rentalEndDate: "asc" },
    });

    // 4. STORE CAPABILITY GAPS
    // Find stores missing certain categories
    const categories = await prisma.category.findMany();
    const companies = await prisma.company.findMany({
      where: { isActive: true },
      include: {
        machines: {
          where: { status: "ACTIVE" },
          select: { categoryId: true },
        },
      },
    });

    const storeCapabilityGaps = companies
      .map((company) => {
        const companyCategories = new Set(
          company.machines.map((m) => m.categoryId).filter(Boolean)
        );
        const missingCategories = categories.filter(
          (cat) => !companyCategories.has(cat.id)
        );
        return {
          companyId: company.id,
          companyName: company.name,
          machineCount: company.machines.length,
          missingCategories: missingCategories.map((c) => c.name),
          hasMissingCapabilities: missingCategories.length > 0,
        };
      })
      .filter((s) => s.hasMissingCapabilities && s.machineCount > 0)
      .sort((a, b) => b.machineCount - a.machineCount);

    // 5. STORE PERFORMANCE COMPARISON
    const storePerformance = companies
      .map((company) => {
        const companyMachines = machineMetrics.filter(
          (m) => m.company.id === company.id
        );
        const totalVolume = companyMachines.reduce(
          (sum, m) => sum + m.periodVolume,
          0
        );
        const avgPerMachine =
          companyMachines.length > 0 ? totalVolume / companyMachines.length : 0;

        return {
          companyId: company.id,
          companyName: company.name,
          machineCount: companyMachines.length,
          totalVolume,
          avgPerMachine: Math.round(avgPerMachine),
          colorVolume: companyMachines.reduce((sum, m) => sum + m.colorVolume, 0),
          blackVolume: companyMachines.reduce((sum, m) => sum + m.blackVolume, 0),
        };
      })
      .filter((s) => s.machineCount > 0)
      .sort((a, b) => b.avgPerMachine - a.avgPerMachine);

    // Calculate store performance percentiles
    const storeAvgVolumes = storePerformance.map((s) => s.avgPerMachine);
    const storeMedian =
      storeAvgVolumes.length > 0
        ? storeAvgVolumes.sort((a, b) => a - b)[Math.floor(storeAvgVolumes.length / 2)]
        : 0;

    const topPerformingStores = storePerformance.slice(0, 5).map((s) => ({
      ...s,
      vsMedian: Math.round(((s.avgPerMachine - storeMedian) / storeMedian) * 100),
    }));

    const underperformingStores = storePerformance
      .filter((s) => s.avgPerMachine < storeMedian * 0.7)
      .sort((a, b) => a.avgPerMachine - b.avgPerMachine)
      .slice(0, 5)
      .map((s) => ({
        ...s,
        vsMedian: Math.round(((s.avgPerMachine - storeMedian) / storeMedian) * 100),
      }));

    // 6. LIFT SUGGESTIONS
    // High volume machines at low-performing stores that could be moved
    // Low volume machines at high-performing stores that could be swapped
    const liftSuggestions: Array<{
      machine: typeof machineMetrics[0];
      currentStore: string;
      suggestedAction: string;
      reason: string;
    }> = [];

    // Find high performers at underperforming stores
    const underperformingStoreIds = new Set(underperformingStores.map((s) => s.companyId));
    const topStoreIds = new Set(topPerformingStores.map((s) => s.companyId));

    machineMetrics
      .filter((m) => underperformingStoreIds.has(m.company.id))
      .filter((m) => m.periodVolume > fleetAvg * 1.5)
      .slice(0, 5)
      .forEach((m) => {
        liftSuggestions.push({
          machine: m,
          currentStore: m.company.name,
          suggestedAction: "Consider relocating to high-traffic store",
          reason: `High performer (${Math.round((m.periodVolume / fleetAvg) * 100)}% of fleet avg) at underperforming store`,
        });
      });

    // Find low performers at top stores (could be replaced with better machines)
    machineMetrics
      .filter((m) => topStoreIds.has(m.company.id))
      .filter((m) => m.periodVolume < fleetAvg * 0.3 && m.readingsCount > 0)
      .slice(0, 5)
      .forEach((m) => {
        liftSuggestions.push({
          machine: m,
          currentStore: m.company.name,
          suggestedAction: "Consider replacing with higher capacity machine",
          reason: `Low performer (${Math.round((m.periodVolume / fleetAvg) * 100)}% of fleet avg) at high-traffic store`,
        });
      });

    // 7. SUMMARY METRICS
    const summary = {
      totalMachines: machines.length,
      totalStores: companies.filter((c) => c.machines.length > 0).length,
      agingHighPerformersCount: agingHighPerformers.length,
      underutilizedNewCount: underutilizedNew.length,
      expiredContractsCount: expiredContracts.length,
      expiringContractsCount: expiringContracts.length,
      urgentContractsCount: urgentContracts.length,
      storesWithGaps: storeCapabilityGaps.length,
      liftSuggestionsCount: liftSuggestions.length,
      fleetAvgVolumePerMachine: Math.round(fleetAvg),
      storeMedianVolumePerMachine: Math.round(storeMedian),
    };

    return NextResponse.json({
      period: {
        days: period,
        start: periodStart.toISOString(),
        end: now.toISOString(),
      },
      summary,
      insights: {
        agingHighPerformers,
        underutilizedNew,
        contractAlerts: {
          expired: expiredContracts.map((m) => ({
            id: m.id,
            serialNumber: m.serialNumber,
            modelName: m.modelName,
            company: m.company,
            category: m.category?.name,
            rentalEndDate: m.rentalEndDate,
            daysOverdue: Math.floor(
              (now.getTime() - (m.rentalEndDate?.getTime() || now.getTime())) /
                (1000 * 60 * 60 * 24)
            ),
          })),
          expiringSoon: expiringContracts.map((m) => ({
            id: m.id,
            serialNumber: m.serialNumber,
            modelName: m.modelName,
            company: m.company,
            category: m.category?.name,
            rentalEndDate: m.rentalEndDate,
            daysUntilExpiry: Math.floor(
              ((m.rentalEndDate?.getTime() || now.getTime()) - now.getTime()) /
                (1000 * 60 * 60 * 24)
            ),
          })),
          urgentCount: urgentContracts.length,
        },
        storeCapabilityGaps,
        storePerformance: {
          topStores: topPerformingStores,
          underperformingStores,
          median: Math.round(storeMedian),
        },
        liftSuggestions,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard insights:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard insights" },
      { status: 500 }
    );
  }
}
