import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const machine = await prisma.machine.findUnique({
      where: { id },
      select: { serialNumber: true },
    });

    if (!machine) {
      return NextResponse.json({ error: "Machine not found" }, { status: 404 });
    }

    const billings = await prisma.xeroxBilling.findMany({
      where: { serialNumber: machine.serialNumber },
      orderBy: { billingMonth: "desc" },
    });

    // Aggregate by billing month
    const monthlyMap = new Map<
      string,
      {
        billingMonth: string;
        rental: number;
        fixedCharge: number;
        volumeCharges: number;
        otherCharge: number;
        totalCharges: number;
        totalClicks: number;
        a4Mono: number;
        a3Mono: number;
        a4Color: number;
        a3Color: number;
        product: string | null;
      }
    >();

    for (const b of billings) {
      const existing = monthlyMap.get(b.billingMonth) ?? {
        billingMonth: b.billingMonth,
        rental: 0,
        fixedCharge: 0,
        volumeCharges: 0,
        otherCharge: 0,
        totalCharges: 0,
        totalClicks: 0,
        a4Mono: 0,
        a3Mono: 0,
        a4Color: 0,
        a3Color: 0,
        product: null,
      };

      existing.rental += Number(b.rental ?? 0);
      existing.fixedCharge += Number(b.fixedCharge ?? 0);
      existing.volumeCharges += Number(b.volumeCharges ?? 0);
      existing.otherCharge += Number(b.otherCharge ?? 0);
      existing.totalCharges += Number(b.totalCharges ?? 0);
      existing.totalClicks += b.totalClicks ?? 0;
      existing.a4Mono += b.volumeA4Mono ?? 0;
      existing.a3Mono += b.volumeA3Mono ?? 0;
      existing.a4Color += b.volumeA4Color ?? 0;
      existing.a3Color += b.volumeA3Color ?? 0;
      if (b.product) existing.product = b.product;

      monthlyMap.set(b.billingMonth, existing);
    }

    return NextResponse.json({
      serialNumber: machine.serialNumber,
      months: Array.from(monthlyMap.values()),
    });
  } catch (error) {
    console.error("Billing API error:", error);
    return NextResponse.json({ error: "Failed to fetch billing data" }, { status: 500 });
  }
}
