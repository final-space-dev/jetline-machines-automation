import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const timestamp = new Date().toISOString();
  const startTime = Date.now();

  const checks: Record<string, { status: string; latency?: number; error?: string; count?: number }> = {};

  // Database check
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = {
      status: "healthy",
      latency: Date.now() - dbStart,
    };
  } catch (error) {
    checks.database = {
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  // Data counts
  try {
    const [machineCount, companyCount, readingCount] = await Promise.all([
      prisma.machine.count(),
      prisma.company.count(),
      prisma.meterReading.count(),
    ]);

    checks.data = {
      status: "healthy",
      count: machineCount + companyCount + readingCount,
    };
    checks.machines = { status: "healthy", count: machineCount };
    checks.companies = { status: "healthy", count: companyCount };
    checks.readings = { status: "healthy", count: readingCount };
  } catch (error) {
    checks.data = {
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  // Memory usage
  const memUsage = process.memoryUsage();
  checks.memory = {
    status: memUsage.heapUsed < 500 * 1024 * 1024 ? "healthy" : "warning",
    count: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
  };

  const overallStatus = Object.values(checks).every(
    (c) => c.status === "healthy" || c.status === "warning"
  )
    ? "healthy"
    : "unhealthy";

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp,
      responseTime: Date.now() - startTime,
      checks,
    },
    { status: overallStatus === "healthy" ? 200 : 503 }
  );
}
