import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        _count: {
          select: { machines: true },
        },
      },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    return NextResponse.json(company);
  } catch (error) {
    console.error("Error fetching company:", error);
    return NextResponse.json({ error: "Failed to fetch company" }, { status: 500 });
  }
}
