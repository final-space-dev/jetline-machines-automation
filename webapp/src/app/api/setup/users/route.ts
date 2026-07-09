import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { badRequest, serverError } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { requireAdmin, AuthError, type Role } from "@/lib/auth";

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

/** Public shape — NEVER includes the password hash. */
const publicSelect = { id: true, email: true, name: true, role: true, store: true } as const;

// List all users (id, email, name, role, store). Password is never returned.
export async function GET() {
  const gate = await adminGate();
  if (gate) return gate;
  const timer = routeTimer("GET /api/setup/users");
  try {
    const rows = await prisma.user.findMany({
      select: publicSelect,
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });
    timer.done({ total: rows.length });
    return NextResponse.json({ rows });
  } catch (err) {
    timer.error(err);
    return serverError(err, "GET /api/setup/users");
  }
}

// Create a user. Body: { email, name, role, store, password }.
export async function POST(req: NextRequest) {
  const gate = await adminGate();
  if (gate) return gate;
  const timer = routeTimer("POST /api/setup/users");

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const role = body?.role;
  const store = typeof body?.store === "string" ? body.store.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email) return badRequest("email is required");
  if (!name) return badRequest("name is required");
  if (!password) return badRequest("password is required");
  if (!isValidRole(role)) return badRequest("role must be 'admin' or 'store_staff'");
  if (role === "store_staff" && !store) return badRequest("store is required for store_staff");

  try {
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        email,
        name,
        role,
        // Only store_staff carry a store; admins are global.
        store: role === "store_staff" ? store : null,
        password: hash,
      },
      select: publicSelect,
    });
    timer.done({ id: user.id, email });
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    // P2002 = unique constraint violation (duplicate email).
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      timer.done({ email, duplicate: true });
      return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 });
    }
    timer.error(err);
    return serverError(err, "POST /api/setup/users");
  }
}
