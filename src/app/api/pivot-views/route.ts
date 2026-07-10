import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const views = await prisma.pivotView.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(views);
}

export async function POST(request: NextRequest) {
  const { name, pivotState } = await request.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const view = await prisma.pivotView.create({
    data: { name: name.trim(), pivotState },
  });
  return NextResponse.json(view);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  await prisma.pivotView.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
