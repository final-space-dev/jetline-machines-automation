import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser, requireCapability, AuthError } from "@/lib/auth";

export async function GET() {
  // Any signed-in user may read the connection list (Config dropdowns need it).
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  try {
    const companies = await prisma.company.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { machines: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(companies);
  } catch (error) {
    console.error("Error fetching companies:", error);
    return NextResponse.json({ error: "Failed to fetch companies" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Creating a BMS connection is an admin action.
  try {
    await requireCapability("config:stores");
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  try {
    const body = await request.json();
    const { name, bmsSchema, region, bmsHost, companyGroup } = body;

    const company = await prisma.company.create({
      data: {
        name,
        bmsSchema,
        region,
        bmsHost: bmsHost ?? null,
        companyGroup: companyGroup ?? null,
      },
    });

    return NextResponse.json(company, { status: 201 });
  } catch (error) {
    console.error("Error creating company:", error);
    return NextResponse.json({ error: "Failed to create company" }, { status: 500 });
  }
}
