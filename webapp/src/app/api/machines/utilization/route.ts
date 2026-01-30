import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { calculateCostFromIncrementals } from "@/lib/cost";

// Default duty cycles by category (monthly prints)
const DUTY_CYCLES: Record<string, number> = {
  "Colour": 8000,
  "Black and White": 15000,
  "Office Machine": 5000,
  "Plan": 3000,
  "default": 10000,
};

interface MachineUtilization {
  machineId: string;
  serialNumber: string;
  modelName: string | null;
  categoryName: string | null;
  companyId: string;
  companyName: string;
  currentBalance: number;

  // Utilization metrics
  avgMonthlyVolume: number;
  volumeMtd: number;
  volume3m: number;
  volume6m: number;
  volume12m: number;
  dutyCycle: number;
  utilizationPercent: number;
  utilizationStatus: "critical" | "low" | "optimal" | "high" | "overworked";

  // Trend
  volumeTrend: number; // percentage change
  trendDirection: "up" | "down" | "stable";

  // Contract
  contractEndDate: Date | null;
  contractMonthsRemaining: number | null;
  rentalAmount: number | null;
  contractType: string | null;

  // Health
  daysSinceLastReading: number | null;
  machineAgeMonths: number | null;
  isLifted: boolean;

  // FSMA Lease Cost (calculated from volume × rates)
  monthlyCost: number;         // Total monthly cost in ZAR (what we pay FSMA)
  monoCost: number;            // Mono component
  colourCost: number;          // Colour component
  hasRates: boolean;           // Whether this machine has rate data

  // Insights
  liftScore: number; // 0-100, higher = better lift candidate
  insights: string[];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const months = parseInt(searchParams.get("months") || "6", 10);

    // Always fetch at least 12 months to compute volume3m, volume6m, volume12m
    const fetchMonths = Math.max(months, 12);

    // Get all active machines with their readings and current rates
    const machines = await prisma.machine.findMany({
      where: {
        status: "ACTIVE",
        ...(companyId && { companyId }),
      },
      include: {
        company: true,
        category: true,
        model: {
          select: { isColor: true },
        },
        readings: {
          where: {
            readingDate: {
              gte: new Date(Date.now() - fetchMonths * 30 * 24 * 60 * 60 * 1000),
            },
          },
          orderBy: { readingDate: "asc" },
          select: {
            readingDate: true,
            total: true,
            incrementalTotal: true,
            incrementalBlack: true,
            incrementalColour: true,
            incrementalA3: true,
            incrementalXl: true,
          },
        },
        rates: {
          orderBy: { ratesFrom: "desc" },
          take: 1, // Get current rate
        },
      },
    });

    const now = new Date();
    const utilizationData: MachineUtilization[] = machines.map((machine) => {
      const readings = machine.readings;
      const categoryName = machine.category?.name || "default";
      const dutyCycle = DUTY_CYCLES[categoryName] || DUTY_CYCLES.default;
      const currentRate = machine.rates[0] || null;
      const isColorMachine = machine.model?.isColor ?? (categoryName === "Colour");

      // Calculate monthly volumes and incremental breakdowns
      const monthlyVolumes: number[] = [];
      const readingsByMonth = new Map<string, number>();
      const monthlyIncrementals = new Map<string, { black: number; colour: number; a3: number; xl: number }>();

      readings.forEach((r) => {
        const monthKey = `${r.readingDate.getFullYear()}-${r.readingDate.getMonth()}`;

        if (r.incrementalTotal && r.incrementalTotal > 0) {
          readingsByMonth.set(
            monthKey,
            (readingsByMonth.get(monthKey) || 0) + r.incrementalTotal
          );
        }

        // Track incremental breakdown for revenue calculation
        const existing = monthlyIncrementals.get(monthKey) || { black: 0, colour: 0, a3: 0, xl: 0 };
        monthlyIncrementals.set(monthKey, {
          black: existing.black + (r.incrementalBlack || 0),
          colour: existing.colour + (r.incrementalColour || 0),
          a3: existing.a3 + (r.incrementalA3 || 0),
          xl: existing.xl + (r.incrementalXl || 0),
        });
      });

      readingsByMonth.forEach((volume) => monthlyVolumes.push(volume));

      // Calculate total volumes for 3m, 6m, 12m windows
      // readingsByMonth keys are "YYYY-M", compute cutoff month keys
      const nowDate = new Date();
      const getMonthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
      const monthKeysInWindow = (windowMonths: number): Set<string> => {
        const keys = new Set<string>();
        for (let i = 0; i < windowMonths; i++) {
          const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1);
          keys.add(getMonthKey(d));
        }
        return keys;
      };
      const sum3mKeys = monthKeysInWindow(3);
      const sum6mKeys = monthKeysInWindow(6);
      const sum12mKeys = monthKeysInWindow(12);

      const currentMonthKey = getMonthKey(nowDate);
      let volumeMtd = 0, volume3m = 0, volume6m = 0, volume12m = 0;
      readingsByMonth.forEach((volume, key) => {
        if (key === currentMonthKey) volumeMtd += volume;
        if (sum3mKeys.has(key)) volume3m += volume;
        if (sum6mKeys.has(key)) volume6m += volume;
        if (sum12mKeys.has(key)) volume12m += volume;
      });

      // Calculate average monthly volume
      const avgMonthlyVolume =
        monthlyVolumes.length > 0
          ? Math.round(monthlyVolumes.reduce((a, b) => a + b, 0) / monthlyVolumes.length)
          : 0;

      // Calculate average monthly FSMA lease cost from volume × rates
      let monthlyCost = 0;
      let monoCost = 0;
      let colourCost = 0;
      const hasRates = currentRate !== null;

      if (hasRates && monthlyIncrementals.size > 0) {
        // Calculate average monthly incrementals
        let totalBlack = 0, totalColour = 0, totalA3 = 0, totalXl = 0;
        monthlyIncrementals.forEach((inc) => {
          totalBlack += inc.black;
          totalColour += inc.colour;
          totalA3 += inc.a3;
          totalXl += inc.xl;
        });
        const monthCount = monthlyIncrementals.size;
        const avgBlack = totalBlack / monthCount;
        const avgColour = totalColour / monthCount;
        const avgA3 = totalA3 / monthCount;
        const avgXl = totalXl / monthCount;

        // Calculate cost using rates
        const cost = calculateCostFromIncrementals(
          avgBlack,
          avgColour,
          avgA3,
          avgXl,
          {
            id: currentRate.id,
            machineId: currentRate.machineId,
            bmsMachinesId: currentRate.bmsMachinesId,
            category: currentRate.category,
            ratesFrom: currentRate.ratesFrom,
            meters: currentRate.meters ? Number(currentRate.meters) : null,
            a4Mono: currentRate.a4Mono ? Number(currentRate.a4Mono) : null,
            a3Mono: currentRate.a3Mono ? Number(currentRate.a3Mono) : null,
            a4Colour: currentRate.a4Colour ? Number(currentRate.a4Colour) : null,
            a3Colour: currentRate.a3Colour ? Number(currentRate.a3Colour) : null,
            colourExtraLarge: currentRate.colourExtraLarge ? Number(currentRate.colourExtraLarge) : null,
            dateSaved: currentRate.dateSaved,
            savedBy: currentRate.savedBy,
          },
          isColorMachine
        );
        monthlyCost = cost.totalCost;
        monoCost = cost.monoCost + cost.a3MonoCost;
        colourCost = cost.colourCost + cost.a3ColourCost + cost.xlCost;
      }

      // Calculate utilization percentage
      const utilizationPercent = dutyCycle > 0 ? Math.round((avgMonthlyVolume / dutyCycle) * 100) : 0;

      // Determine utilization status
      let utilizationStatus: MachineUtilization["utilizationStatus"];
      if (utilizationPercent < 20) utilizationStatus = "critical";
      else if (utilizationPercent < 40) utilizationStatus = "low";
      else if (utilizationPercent <= 80) utilizationStatus = "optimal";
      else if (utilizationPercent <= 100) utilizationStatus = "high";
      else utilizationStatus = "overworked";

      // Calculate trend (compare last 2 months vs previous 2 months)
      let volumeTrend = 0;
      let trendDirection: MachineUtilization["trendDirection"] = "stable";
      if (monthlyVolumes.length >= 4) {
        const recent = monthlyVolumes.slice(-2).reduce((a, b) => a + b, 0) / 2;
        const previous = monthlyVolumes.slice(-4, -2).reduce((a, b) => a + b, 0) / 2;
        if (previous > 0) {
          volumeTrend = Math.round(((recent - previous) / previous) * 100);
          trendDirection = volumeTrend > 5 ? "up" : volumeTrend < -5 ? "down" : "stable";
        }
      }

      // Contract info
      const contractMonthsRemaining = machine.rentalMonthsRemaining;
      const rentalAmount = machine.rentalAmountExVat
        ? parseFloat(machine.rentalAmountExVat.toString())
        : null;

      // Health metrics
      const lastReading = readings[readings.length - 1];
      const daysSinceLastReading = lastReading
        ? Math.floor((now.getTime() - lastReading.readingDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const machineAgeMonths = machine.installDate
        ? Math.floor((now.getTime() - machine.installDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
        : null;

      // Calculate lift score (higher = better candidate for lifting)
      let liftScore = 50; // Start neutral
      const insights: string[] = [];

      // Utilization factors
      if (utilizationPercent < 20) {
        liftScore += 30;
        insights.push(`Critical underutilization (${utilizationPercent}%) - strong lift candidate`);
      } else if (utilizationPercent < 40) {
        liftScore += 20;
        insights.push(`Low utilization (${utilizationPercent}%) - consider relocating`);
      } else if (utilizationPercent > 100) {
        liftScore -= 20;
        insights.push(`Overworked (${utilizationPercent}%) - needs support or replacement`);
      }

      // Trend factors
      if (trendDirection === "down" && volumeTrend < -20) {
        liftScore += 15;
        insights.push(`Volume declining ${Math.abs(volumeTrend)}% - may need relocation`);
      } else if (trendDirection === "up" && volumeTrend > 20) {
        liftScore -= 10;
        insights.push(`Volume growing ${volumeTrend}% - high demand location`);
      }

      // Contract factors
      if (contractMonthsRemaining !== null) {
        if (contractMonthsRemaining <= 3) {
          liftScore -= 25;
          insights.push(`Contract ends in ${contractMonthsRemaining} months - avoid moving`);
        } else if (contractMonthsRemaining <= 6) {
          liftScore -= 10;
          insights.push(`Contract ends in ${contractMonthsRemaining} months - consider timing`);
        }
      }

      // Health factors
      if (daysSinceLastReading !== null && daysSinceLastReading > 60) {
        liftScore += 10;
        insights.push(`No readings for ${daysSinceLastReading} days - may be inactive`);
      }

      if (machineAgeMonths !== null && machineAgeMonths > 60) {
        liftScore += 5;
        insights.push(`Machine is ${Math.floor(machineAgeMonths / 12)} years old`);
      }

      // Already lifted
      if (machine.isLifted) {
        liftScore = 0;
        insights.unshift("Already marked for lift in BMS");
      }

      // Clamp score
      liftScore = Math.max(0, Math.min(100, liftScore));

      return {
        machineId: machine.id,
        serialNumber: machine.serialNumber,
        modelName: machine.modelName,
        categoryName: machine.category?.name || null,
        companyId: machine.companyId,
        companyName: machine.company.name,
        currentBalance: machine.currentBalance,
        avgMonthlyVolume,
        volumeMtd,
        volume3m,
        volume6m,
        volume12m,
        dutyCycle,
        utilizationPercent,
        utilizationStatus,
        volumeTrend,
        trendDirection,
        contractEndDate: machine.rentalEndDate,
        contractMonthsRemaining,
        rentalAmount,
        contractType: machine.contractType,
        daysSinceLastReading,
        machineAgeMonths,
        isLifted: machine.isLifted,
        monthlyCost,
        monoCost,
        colourCost,
        hasRates,
        liftScore,
        insights,
      };
    });

    // Sort by lift score (best candidates first)
    utilizationData.sort((a, b) => b.liftScore - a.liftScore);

    // Calculate cost totals
    const totalMonthlyCost = utilizationData.reduce((sum, m) => sum + m.monthlyCost, 0);
    const totalMonoCost = utilizationData.reduce((sum, m) => sum + m.monoCost, 0);
    const totalColourCost = utilizationData.reduce((sum, m) => sum + m.colourCost, 0);
    const machinesWithRates = utilizationData.filter((m) => m.hasRates).length;

    return NextResponse.json({
      machines: utilizationData,
      summary: {
        total: utilizationData.length,
        critical: utilizationData.filter((m) => m.utilizationStatus === "critical").length,
        low: utilizationData.filter((m) => m.utilizationStatus === "low").length,
        optimal: utilizationData.filter((m) => m.utilizationStatus === "optimal").length,
        high: utilizationData.filter((m) => m.utilizationStatus === "high").length,
        overworked: utilizationData.filter((m) => m.utilizationStatus === "overworked").length,
        liftCandidates: utilizationData.filter((m) => m.liftScore >= 70).length,
        // FSMA Lease Cost summary
        totalMonthlyCost,
        totalMonoCost,
        totalColourCost,
        machinesWithRates,
        avgCostPerMachine: machinesWithRates > 0 ? totalMonthlyCost / machinesWithRates : 0,
      },
    });
  } catch (error) {
    console.error("Error fetching utilization data:", error);
    return NextResponse.json(
      { error: "Failed to fetch utilization data" },
      { status: 500 }
    );
  }
}
