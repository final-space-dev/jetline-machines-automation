import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * GET /api/machines
 * Get machines with filtering, pagination, and sorting
 *
 * Query params:
 * - companyId: Filter by company
 * - categoryId: Filter by category
 * - modelId: Filter by printer model (normalized)
 * - modelName: Filter by model name (raw BMS)
 * - makeName: Filter by make/manufacturer
 * - status: Filter by machine status
 * - search: Search serial number or machine name
 * - page: Page number (default 1)
 * - limit: Items per page (default 50)
 * - sortBy: Field to sort by
 * - sortOrder: asc or desc
 * - includeReadings: Include meter reading history
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Filtering
    const companyId = searchParams.get("companyId");
    const categoryId = searchParams.get("categoryId");
    const modelId = searchParams.get("modelId");
    const modelName = searchParams.get("modelName");
    const makeName = searchParams.get("makeName");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(10000, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const skip = (page - 1) * limit;

    // Sorting
    const sortBy = searchParams.get("sortBy") || "serialNumber";
    const sortOrder = searchParams.get("sortOrder") === "desc" ? "desc" : "asc";

    // Include readings?
    const includeReadings = searchParams.get("includeReadings") === "true";

    // Build where clause
    const where: Prisma.MachineWhereInput = {};
    if (companyId) where.companyId = companyId;
    if (categoryId) where.categoryId = categoryId;
    if (modelId) where.modelId = modelId;
    if (modelName) where.modelName = { contains: modelName, mode: "insensitive" };
    if (makeName) where.makeName = { contains: makeName, mode: "insensitive" };
    if (status) where.status = status as Prisma.EnumMachineStatusFilter;
    if (search) {
      where.OR = [
        { serialNumber: { contains: search, mode: "insensitive" } },
        { machineName: { contains: search, mode: "insensitive" } },
        { bmsMachineNo: { contains: search, mode: "insensitive" } },
      ];
    }

    // Build orderBy
    const orderBy: Prisma.MachineOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    // Execute queries in parallel
    const [machines, total] = await Promise.all([
      prisma.machine.findMany({
        where,
        include: {
          company: {
            select: {
              id: true,
              name: true,
              bmsSchema: true,
              region: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          model: {
            select: {
              id: true,
              name: true,
              makeName: true,
              isColor: true,
              monthlyDutyCycle: true,
            },
          },
          readings: includeReadings
            ? {
                orderBy: { readingDate: "desc" },
                take: 12, // Last 12 readings
              }
            : false,
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.machine.count({ where }),
    ]);

    return NextResponse.json({
      data: machines,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching machines:", error);
    return NextResponse.json(
      { error: "Failed to fetch machines" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/machines
 * Create a new machine (manual entry)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      serialNumber,
      companyId,
      categoryId,
      modelId,
      machineName,
      makeName,
      modelName,
      installDate,
      status,
      contractNumber,
      contractType,
    } = body;

    // Validate required fields
    if (!serialNumber || !companyId) {
      return NextResponse.json(
        { error: "serialNumber and companyId are required" },
        { status: 400 }
      );
    }

    // Check for duplicate serial number
    const existing = await prisma.machine.findUnique({
      where: { serialNumber },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Machine with this serial number already exists" },
        { status: 409 }
      );
    }

    const machine = await prisma.machine.create({
      data: {
        serialNumber,
        companyId,
        categoryId: categoryId || null,
        modelId: modelId || null,
        machineName: machineName || null,
        makeName: makeName || null,
        modelName: modelName || null,
        installDate: installDate ? new Date(installDate) : null,
        status: status || "ACTIVE",
        contractNumber: contractNumber || null,
        contractType: contractType || null,
        currentBalance: 0,
      },
      include: {
        company: true,
        category: true,
        model: true,
      },
    });

    return NextResponse.json(machine, { status: 201 });
  } catch (error) {
    console.error("Error creating machine:", error);
    return NextResponse.json(
      { error: "Failed to create machine" },
      { status: 500 }
    );
  }
}
