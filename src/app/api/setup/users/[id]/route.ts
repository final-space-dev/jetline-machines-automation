import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma, ensureUserPermissionsColumn } from "@/lib/prisma";
import { badRequest, notFound, serverError } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { requireAdmin, AuthError, type Role } from "@/lib/auth";
import { normalisePermissions } from "@/lib/permissions";

/** Admin gate: returns a 401/403 response if not an admin, else null. */
async function adminGate(): Promise<NextResponse | null> {
  try {
    await requireAdmin();
    return null;
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

const BCRYPT_ROUNDS = 10;
const VALID_ROLES: Role[] = ["admin", "store_staff"];

function isValidRole(role: unknown): role is Role {
  return typeof role === "string" && (VALID_ROLES as string[]).includes(role);
}

function validId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Public shape — NEVER includes the password hash. */
const publicSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  store: true,
  permissions: true,
} as const;

// Update a user. Body: { name?, role?, store?, password? }.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await adminGate();
  if (gate) return gate;
  const timer = routeTimer("PATCH /api/setup/users/[id]");

  const { id: rawId } = await params;
  const id = validId(rawId);
  if (id === null) return badRequest("valid id is required");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("invalid body");

  try {
    await ensureUserPermissionsColumn();
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return notFound("User not found");

    const data: Prisma.UserUpdateInput = {};

    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (!name) return badRequest("name cannot be empty");
      data.name = name;
    }

    // Resolve the effective role + store so we can validate the combination
    // against whichever of the two the caller supplied.
    const effectiveRole: Role =
      body.role !== undefined ? (body.role as Role) : (existing.role as Role);

    if (body.role !== undefined) {
      if (!isValidRole(body.role)) {
        return badRequest("role must be 'admin', 'store_staff' or 'custom'");
      }
      data.role = body.role;
    }

    let effectiveStore: string | null =
      body.store !== undefined
        ? (typeof body.store === "string" && body.store.trim() ? body.store.trim() : null)
        : existing.store;

    if (effectiveRole === "admin" || effectiveRole === "custom") {
      // Admins and custom users are global — never carry a store.
      effectiveStore = null;
    } else if (!effectiveStore) {
      return badRequest("store is required for store_staff");
    }

    // Only write store when role or store was part of the request.
    if (body.role !== undefined || body.store !== undefined) {
      data.store = effectiveStore;
    }

    // Permissions: only custom users carry a grant. Update it when the caller
    // sends `permissions` or when the role changes, so switching away from
    // custom clears the grant (SQL NULL) and switching to custom seeds it.
    if (body.permissions !== undefined || body.role !== undefined) {
      data.permissions =
        effectiveRole === "custom"
          ? (normalisePermissions(
              body.permissions !== undefined ? body.permissions : existing.permissions,
            ) as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull;
    }

    if (typeof body.password === "string" && body.password) {
      data.password = await bcrypt.hash(body.password, BCRYPT_ROUNDS);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: publicSelect,
    });
    timer.done({ id });
    return NextResponse.json({ user });
  } catch (err) {
    timer.error(err);
    return serverError(err, "PATCH /api/setup/users/[id]");
  }
}

// Delete a user. Refuses to delete the last remaining admin.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await adminGate();
  if (gate) return gate;
  const timer = routeTimer("DELETE /api/setup/users/[id]");

  const { id: rawId } = await params;
  const id = validId(rawId);
  if (id === null) return badRequest("valid id is required");

  try {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return notFound("User not found");

    // Guard: never remove the final admin, or the app becomes unmanageable.
    if (existing.role === "admin") {
      const adminCount = await prisma.user.count({ where: { role: "admin" } });
      if (adminCount <= 1) {
        timer.done({ id, blocked: "last_admin" });
        return NextResponse.json(
          { error: "Cannot delete the last remaining admin" },
          { status: 409 }
        );
      }
    }

    await prisma.user.delete({ where: { id } });
    timer.done({ id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    timer.error(err);
    return serverError(err, "DELETE /api/setup/users/[id]");
  }
}
