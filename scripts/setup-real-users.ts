/**
 * Production'da gerçek kullanıcıları kurar.
 *
 * Eski seed kullanıcılarını (admin@ajans.com, ayse@ajans.com, selin@coffeehouse.com)
 * soft-delete eder, ardından 4 gerçek kullanıcıyı upsert eder.
 *
 * Çalıştır: npx tsx scripts/setup-real-users.ts
 *   (DATABASE_URL ve DIRECT_URL env'leri gerekli)
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  try {
    const seedEmails = [
      "admin@ajans.com",
      "ayse@ajans.com",
      "selin@coffeehouse.com",
    ];
    const removed = await prisma.user.updateMany({
      where: { email: { in: seedEmails }, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    console.log(`Eski seed kullanıcıları soft-delete edildi: ${removed.count}`);

    const users = [
      {
        email: "admin@dousocial.com",
        password: "dou123",
        name: "Admin",
        role: "ADMIN" as const,
      },
      {
        email: "miray@dousocial.com",
        password: "miray123",
        name: "Miray",
        role: "ADMIN" as const,
      },
      {
        email: "fuat@dousocial.com",
        password: "fuat123",
        name: "Fuat",
        role: "TEAM" as const,
      },
      {
        email: "seyma@dousocial.com",
        password: "seyma123",
        name: "Şeyma",
        role: "TEAM" as const,
      },
    ];

    for (const u of users) {
      const passwordHash = await bcrypt.hash(u.password, 12);
      await prisma.user.upsert({
        where: { email: u.email },
        update: {
          name: u.name,
          passwordHash,
          role: u.role,
          deletedAt: null,
        },
        create: {
          email: u.email,
          name: u.name,
          passwordHash,
          role: u.role,
        },
      });
      console.log(`  ✓ ${u.email.padEnd(28)} ${u.role.padEnd(6)} ${u.name}`);
    }

    console.log("\nKurulum tamam. Giriş için:");
    for (const u of users) {
      console.log(`  ${u.email}  →  ${u.password}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
