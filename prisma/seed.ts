import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    console.log("Seeding database...");

    // ─── Kullanıcılar ───────────────────────────────────────────────────────────

    const adminHash = await bcrypt.hash("admin123", 12);
    const teamHash = await bcrypt.hash("team123", 12);
    const clientHash = await bcrypt.hash("client123", 12);

    const admin = await prisma.user.upsert({
      where: { email: "admin@ajans.com" },
      update: {},
      create: {
        name: "Admin User",
        email: "admin@ajans.com",
        passwordHash: adminHash,
        role: "ADMIN",
      },
    });

    const teamUser = await prisma.user.upsert({
      where: { email: "ayse@ajans.com" },
      update: {},
      create: {
        name: "Ayşe Yılmaz",
        email: "ayse@ajans.com",
        passwordHash: teamHash,
        role: "TEAM",
      },
    });

    const clientUser = await prisma.user.upsert({
      where: { email: "selin@coffeehouse.com" },
      update: {},
      create: {
        name: "Selin Kaya",
        email: "selin@coffeehouse.com",
        passwordHash: clientHash,
        role: "CLIENT",
      },
    });

    console.log("✓ Users created:", admin.email, teamUser.email, clientUser.email);

    // ─── Müşteriler ─────────────────────────────────────────────────────────────

    const coffeeHouse = await prisma.client.upsert({
      where: { slug: "coffee-house" },
      update: {},
      create: {
        name: "Coffee House",
        slug: "coffee-house",
        industry: "F&B",
        contactName: "Selin Kaya",
        contactEmail: "selin@coffeehouse.com",
        healthScore: 92,
      },
    });

    const modaStore = await prisma.client.upsert({
      where: { slug: "modasTore" },
      update: {},
      create: {
        name: "ModaStore",
        slug: "modasTore",
        industry: "E-Ticaret",
        contactName: "Burak Demir",
        contactEmail: "burak@modasTore.com",
        healthScore: 78,
      },
    });

    const fitLife = await prisma.client.upsert({
      where: { slug: "fitlife-gym" },
      update: {},
      create: {
        name: "FitLife Gym",
        slug: "fitlife-gym",
        industry: "Spor & Sağlık",
        contactName: "Ayşe Öztürk",
        contactEmail: "ayse@fitlife.com",
        healthScore: 55,
      },
    });

    console.log("✓ Clients created:", coffeeHouse.name, modaStore.name, fitLife.name);

    // ─── Projeler ───────────────────────────────────────────────────────────────

    const clients = [coffeeHouse, modaStore, fitLife];

    for (const client of clients) {
      await prisma.project.create({
        data: {
          clientId: client.id,
          title: "Mayıs Sosyal Medya Paketi",
          status: "CLIENT_REVIEW",
          platforms: ["INSTAGRAM"],
          postType: "IMAGE",
        },
      });

      await prisma.project.create({
        data: {
          clientId: client.id,
          title: "Haftalık Reels",
          status: "EDITING",
          platforms: ["INSTAGRAM"],
          postType: "REEL",
        },
      });
    }

    console.log("✓ Projects created: 2 per client (6 total)");
    console.log("Seeding complete.");
  } finally {
    await pool.end();
  }
}

main().catch(console.error).finally(() => process.exit(0));
