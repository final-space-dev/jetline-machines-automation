import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { badRequest, serverError, validateBody } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { requireAdmin, AuthError, type Role } from "@/lib/auth";
import { z } from "zod";

// Minimum password policy for new accounts: 8+ chars with at least one letter and
// one number. Keeps it usable for shop-floor staff without being a nuisance.
const CreateUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("a valid email is required"),
  name: z.string().trim().min(1, "name is required").max(120),
  role: z.enum(["admin", "store_staff"]),
  store: z.string().trim().optional().default(""),
  password: z.string()
    .min(8, "password must be at least 8 characters")
    .max(200)
    .regex(/[A-Za-z]/, "password must contain a letter")
    .regex(/[0-9]/, "password must contain a number"),
}).refine((v) => v.role !== "store_staff" || v.store.length > 0, {
  path: ["store"],
  message: "store is required for store_staff",
});

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

  const parsed = await validateBody(req, CreateUserSchema);
  if (parsed.error) return parsed.error;
  const { email, name, role, store, password } = parsed.data;

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
