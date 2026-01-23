import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    // Quick database ping
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: "healthy",
      timestamp,
    });
  } catch {
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp,
        error: "Database connection failed",
      },
      { status: 503 }
    );
  }
}
