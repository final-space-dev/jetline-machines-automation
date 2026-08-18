import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;

/**
 * Idempotent, additive migration: guarantees the `users.permissions` column
 * exists before any query selects it. Runs `ADD COLUMN IF NOT EXISTS`, so it can
 * NEVER touch existing rows, passwords, or drop anything — it only adds a
 * nullable JSONB column when missing. Memoised so the DDL runs at most once per
 * process. Deliberately used instead of `prisma db push` (which risks resets).
 */
let ensurePermissionsColumnPromise: Promise<void> | null = null;
export function ensureUserPermissionsColumn(): Promise<void> {
  if (!ensurePermissionsColumnPromise) {
    ensurePermissionsColumnPromise = prisma
      .$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "permissions" JSONB`)
      .then(() => undefined)
      .catch((err) => {
        // Reset so a transient failure can be retried on the next call rather
        // than caching a broken state.
        ensurePermissionsColumnPromise = null;
        throw err;
      });
  }
  return ensurePermissionsColumnPromise;
}
