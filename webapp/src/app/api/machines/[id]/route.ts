import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const machine = await prisma.machine.findUnique({
      where: { id },
      include: {
        company: true,
        category: true,
      },
    });

    if (!machine) {
      return NextResponse.json({ error: "Machine not found" }, { status: 404 });
    }

    return NextResponse.json(machine);
  } catch (error) {
    console.error("Error fetching machine:", error);
    return NextResponse.json(
      { error: "Failed to fetch machine" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const machine = await prisma.machine.update({
      where: { id },
      data: {
        companyId: body.companyId,
        status: body.status,
        isLifted: body.companyId ? true : undefined,
      },
      include: {
        company: true,
        category: true,
      },
    });

    return NextResponse.json(machine);
  } catch (error) {
    console.error("Error updating machine:", error);
    return NextResponse.json(
      { error: "Failed to update machine" },
      { status: 500 }
    );
  }
}
