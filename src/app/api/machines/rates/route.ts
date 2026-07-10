import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/machines/rates
 * Get machine rates with filtering and current rate calculation
 *
 * Query params:
 * - machineId: Filter by specific machine
 * - companyId: Filter by company (gets rates for all machines in company)
 * - current: If "true", only returns the current/latest rate for each machine
 * - includeHistory: If "true", includes full rate history (default: false)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const machineId = searchParams.get("machineId");
    const companyId = searchParams.get("companyId");
    const currentOnly = searchParams.get("current") === "true";
    const includeHistory = searchParams.get("includeHistory") === "true";

    // Build where clause for machines
    const machineWhere: { id?: string; companyId?: string } = {};
    if (machineId) machineWhere.id = machineId;
    if (companyId) machineWhere.companyId = companyId;

    // If getting current rates only, we need to get the latest rate per machine
    if (currentOnly) {
      const machines = await prisma.machine.findMany({
        where: machineWhere,
        select: {
          id: true,
          serialNumber: true,
          modelName: true,
          company: { select: { id: true, name: true } },
          rates: {
            orderBy: { ratesFrom: "desc" },
            take: 1,
          },
        },
      });

      const result = machines
        .filter((m) => m.rates.length > 0)
        .map((m) => ({
          machineId: m.id,
          serialNumber: m.serialNumber,
          modelName: m.modelName,
          company: m.company,
          currentRate: m.rates[0],
        }));

      return NextResponse.json({
        data: result,
        total: result.length,
      });
    }

    // Get all rates (with optional history)
    if (machineId) {
      // Single machine - get all its rates
      const rates = await prisma.machineRate.findMany({
        where: { machineId },
        orderBy: { ratesFrom: "desc" },
        include: {
          machine: {
            select: {
              id: true,
              serialNumber: true,
              modelName: true,
              company: { select: { id: true, name: true } },
            },
          },
        },
      });

      return NextResponse.json({
        data: rates,
        total: rates.length,
      });
    }

    // Multiple machines - get rates with grouping
    const machines = await prisma.machine.findMany({
      where: machineWhere,
      select: {
        id: true,
        serialNumber: true,
        modelName: true,
        company: { select: { id: true, name: true } },
        rates: {
          orderBy: { ratesFrom: "desc" },
          take: includeHistory ? undefined : 1,
        },
      },
    });

    const result = machines
      .filter((m) => m.rates.length > 0)
      .map((m) => ({
        machineId: m.id,
        serialNumber: m.serialNumber,
        modelName: m.modelName,
        company: m.company,
        currentRate: m.rates[0],
        rateHistory: includeHistory ? m.rates : undefined,
        rateCount: m.rates.length,
      }));

    return NextResponse.json({
      data: result,
      total: result.length,
    });
  } catch (error) {
    console.error("Error fetching rates:", error);
    return NextResponse.json(
      { error: "Failed to fetch rates" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/machines/rates/summary
 * Get a summary of rates across all machines
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "summary") {
      // Get rate statistics
      const [totalRates, machinesWithRates, avgRates] = await Promise.all([
        prisma.machineRate.count(),
        prisma.machineRate.groupBy({
          by: ["machineId"],
          _count: true,
        }),
        prisma.machineRate.aggregate({
          _avg: {
            a4Mono: true,
            a3Mono: true,
            a4Colour: true,
            a3Colour: true,
            meters: true,
          },
        }),
      ]);

      return NextResponse.json({
        totalRates,
        machinesWithRates: machinesWithRates.length,
        averageRates: {
          a4Mono: avgRates._avg.a4Mono?.toNumber() || 0,
          a3Mono: avgRates._avg.a3Mono?.toNumber() || 0,
          a4Colour: avgRates._avg.a4Colour?.toNumber() || 0,
          a3Colour: avgRates._avg.a3Colour?.toNumber() || 0,
          meters: avgRates._avg.meters?.toNumber() || 0,
        },
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error processing rates request:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
