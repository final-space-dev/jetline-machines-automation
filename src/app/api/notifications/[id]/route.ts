import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notFound, serverError } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { requireUser, AuthError, type SessionUser } from "@/lib/auth";

function validId(id: string): boolean {
  return /^\d+$/.test(id) && parseInt(id, 10) > 0;
}

/**
 * PATCH /api/notifications/[id]
 * Marks a single notification read. Store staff may only mark notifications
 * inside their own audience (global or their store).
 */
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let user: SessionUser;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const { id } = await params;
  if (!validId(id)) return notFound();

  const timer = routeTimer(`PATCH /api/notifications/${id}`);
  try {
    const notif = await prisma.notification.findUnique({ where: { id: Number(id) } });
    if (!notif) return notFound();

    // Store staff may only touch global notifications or their own store's.
    if (user.role !== "admin" && notif.store !== null && notif.store !== user.store) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await prisma.notification.update({
      where: { id: Number(id) },
      data: { read: true },
    });

    timer.done({ id });
    return NextResponse.json({ notification: updated });
  } catch (err) {
    timer.error(err);
    return serverError(err, `PATCH /api/notifications/${id}`);
  }
}
