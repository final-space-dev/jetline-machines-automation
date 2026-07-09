import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serverError } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { requireUser, AuthError, type SessionUser } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

/**
 * PATCH /api/notifications/read-all
 * Marks every unread notification in the caller's audience as read.
 */
export async function PATCH() {
  let user: SessionUser;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const timer = routeTimer("PATCH /api/notifications/read-all");
  try {
    const where: Prisma.NotificationWhereInput =
      user.role === "admin"
        ? { read: false }
        : { read: false, OR: [{ store: null }, { store: user.store ?? " " }] };

    const result = await prisma.notification.updateMany({ where, data: { read: true } });

    timer.done({ updated: result.count });
    return NextResponse.json({ updated: result.count });
  } catch (err) {
    timer.error(err);
    return serverError(err, "PATCH /api/notifications/read-all");
  }
}
