import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Update action for a single machine
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { machineId, action, upgradeTo, moveToCompanyId } = body;

    if (!machineId || !action) {
      return NextResponse.json({ error: "machineId and action are required" }, { status: 400 });
    }

    const validActions = ["NONE", "TERMINATE", "TERMINATE_UPGRADE", "STAY", "MOVE"];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: `Invalid action. Must be one of: ${validActions.join(", ")}` }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      action,
      upgradeTo: action === "TERMINATE_UPGRADE" ? (upgradeTo || null) : null,
      moveToCompanyId: action === "MOVE" ? (moveToCompanyId || null) : null,
    };

    const machine = await prisma.machine.update({
      where: { id: machineId },
      data: updateData,
    });

    return NextResponse.json({ success: true, machine });
  } catch (error) {
    console.error("Error updating machine action:", error);
    return NextResponse.json({ error: "Failed to update machine action" }, { status: 500 });
  }
}

// Bulk update actions for multiple machines
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { machineIds, action, upgradeTo, moveToCompanyId } = body;

    if (!Array.isArray(machineIds) || machineIds.length === 0 || !action) {
      return NextResponse.json({ error: "machineIds array and action are required" }, { status: 400 });
    }

    const validActions = ["NONE", "TERMINATE", "TERMINATE_UPGRADE", "STAY", "MOVE"];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: `Invalid action. Must be one of: ${validActions.join(", ")}` }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      action,
      upgradeTo: action === "TERMINATE_UPGRADE" ? (upgradeTo || null) : null,
      moveToCompanyId: action === "MOVE" ? (moveToCompanyId || null) : null,
    };

    const result = await prisma.machine.updateMany({
      where: { id: { in: machineIds } },
      data: updateData,
    });

    return NextResponse.json({ success: true, updated: result.count });
  } catch (error) {
    console.error("Error bulk updating machine actions:", error);
    return NextResponse.json({ error: "Failed to bulk update machine actions" }, { status: 500 });
  }
}
