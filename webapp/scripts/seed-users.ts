/**
 * Phase 09 — Seed the initial admin account.
 *
 * Idempotent: upserts by email. Safe to run repeatedly.
 *
 * Run:
 *   cd webapp
 *   npx tsx scripts/seed-users.ts
 *
 * Env (optional):
 *   SEED_ADMIN_EMAIL     default: admin@jetline.local
 *   SEED_ADMIN_PASSWORD  default: ChangeMe123!  (CHANGE ON FIRST LOGIN)
 *   SEED_ADMIN_NAME      default: Administrator
 *
 * On production, run after `prisma db push` has created the `users` table:
 *   ssh finalspace@172.20.246.163 \
 *     "cd ~/finalspace/jetline-machines && SEED_ADMIN_PASSWORD='<strong>' npx tsx scripts/seed-users.ts"
 */

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@jetline.local")
    .trim()
    .toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";
  const name = process.env.SEED_ADMIN_NAME || "Administrator";

  const hash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    // Do not clobber an existing admin's password on re-run; only ensure role.
    update: { role: "admin" },
    create: {
      email,
      password: hash,
      name,
      role: "admin",
      store: null,
    },
  });

  console.log(`Admin ready: ${user.email} (id=${user.id}, role=${user.role})`);
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log(
      "WARNING: used default password 'ChangeMe123!'. Set SEED_ADMIN_PASSWORD and change it.",
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
