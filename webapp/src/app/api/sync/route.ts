import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { runFullSync, syncCompanyById, testBMSConnection, createBMSConfig } from "@/lib/bms";

/**
 * POST /api/sync
 * Trigger a data sync from BMS databases
 *
 * Body options:
 * - { type: "full" } - Sync all companies
 * - { type: "company", companyId: "..." } - Sync specific company
 * - { type: "test", bmsSchema: "...", bmsHost?: "..." } - Test BMS connection
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, companyId, bmsSchema, bmsHost } = body;

    // Test connection mode
    if (type === "test") {
      if (!bmsSchema) {
        return NextResponse.json({ error: "bmsSchema is required" }, { status: 400 });
      }

      const config = createBMSConfig(bmsSchema, bmsHost || null);
      const result = await testBMSConnection(config);

      return NextResponse.json({
        success: result.success,
        error: result.error,
        latency: result.latency,
        host: config.host,
        schema: config.schema,
      });
    }

    // Company sync mode
    if (type === "company") {
      if (!companyId) {
        return NextResponse.json({ error: "companyId is required" }, { status: 400 });
      }

      const result = await syncCompanyById(companyId);

      return NextResponse.json({
        success: true,
        result: {
          company: result.companyName,
          machinesProcessed: result.machinesProcessed,
          readingsProcessed: result.readingsProcessed,
          ratesProcessed: result.ratesProcessed,
          errors: result.errors,
          duration: result.duration,
        },
      });
    }

    // Full sync (default)
    const result = await runFullSync();

    return NextResponse.json({
      success: true,
      syncId: result.syncId,
      summary: {
        companiesProcessed: result.companiesProcessed,
        totalMachines: result.totalMachines,
        totalReadings: result.totalReadings,
        totalRates: result.totalRates,
        errors: result.errors,
        startedAt: result.startedAt,
        completedAt: result.completedAt,
      },
      companyResults: result.companyResults.map((r) => ({
        company: r.companyName,
        machines: r.machinesProcessed,
        readings: r.readingsProcessed,
        rates: r.ratesProcessed,
        errors: r.errors.length,
        duration: r.duration,
      })),
    });
  } catch (error) {
    console.error("Sync error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Sync failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sync
 * Get sync history and status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const syncLogs = await prisma.syncLog.findMany({
      orderBy: { startedAt: "desc" },
      take: limit,
    });

    // Get last successful sync stats
    const lastSuccessful = await prisma.syncLog.findFirst({
      where: { status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
    });

    // Get totals
    const [machineCount, readingCount, companyCount] = await Promise.all([
      prisma.machine.count(),
      prisma.meterReading.count(),
      prisma.company.count({ where: { isActive: true } }),
    ]);

    return NextResponse.json({
      history: syncLogs,
      lastSuccessfulSync: lastSuccessful,
      totals: {
        machines: machineCount,
        readings: readingCount,
        companies: companyCount,
      },
    });
  } catch (error) {
    console.error("Error fetching sync logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch sync logs" },
      { status: 500 }
    );
  }
}
