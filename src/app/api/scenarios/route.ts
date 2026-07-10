import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const scenarios = await prisma.scenario.findMany({
      include: {
        machines: {
          include: {
            machine: {
              include: {
                company: true,
                model: true,
              },
            },
          },
        },
        _count: {
          select: { machines: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(scenarios);
  } catch (error) {
    console.error("Error fetching scenarios:", error);
    return NextResponse.json({ error: "Failed to fetch scenarios" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, moves } = body;

    const scenario = await prisma.scenario.create({
      data: {
        name,
        description,
        status: "DRAFT",
        machines: {
          create: moves.map((move: { machineId: string; fromCompanyId: string; toCompanyId: string; notes?: string }) => ({
            machineId: move.machineId,
            fromCompanyId: move.fromCompanyId,
            toCompanyId: move.toCompanyId,
            notes: move.notes,
          })),
        },
      },
      include: {
        machines: {
          include: {
            machine: {
              include: {
                company: true,
                model: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(scenario, { status: 201 });
  } catch (error) {
    console.error("Error creating scenario:", error);
    return NextResponse.json({ error: "Failed to create scenario" }, { status: 500 });
  }
}
