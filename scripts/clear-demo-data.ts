/**
 * Demo seed verisini temizler.
 *
 * Soft-delete: Coffee House, ModaStore, FitLife (Gym) müşterileri ve onların
 * tüm projelerini, faturalarını, sosyal hesaplarını, abonelikleri,
 * ScheduledPost'ları, dosyaları, görevleri "deletedAt" damgasıyla işaretler.
 *
 * UI'da kaybolur ama DB'de saklanır (kasıtlı silme yapılmadığı sürece geri
 * yüklenebilir). Tamamen yok etmek istersek cascading hard-delete yazılabilir.
 *
 * Çalıştır: DATABASE_URL=... DIRECT_URL=... npx tsx scripts/clear-demo-data.ts
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const DEMO_CLIENT_NAMES = ["Coffee House", "ModaStore", "FitLife Gym"];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  try {
    const clients = await prisma.client.findMany({
      where: { name: { in: DEMO_CLIENT_NAMES }, deletedAt: null },
      select: { id: true, name: true },
    });
    if (clients.length === 0) {
      console.log("Silinecek demo müşteri bulunamadı (zaten temiz olabilir).");
      return;
    }
    const clientIds = clients.map((c) => c.id);
    const now = new Date();

    // Önce ilişkili kayıtları soft-delete (deletedAt'i olanlar için)
    const projects = await prisma.project.findMany({
      where: { clientId: { in: clientIds }, deletedAt: null },
      select: { id: true },
    });
    const projectIds = projects.map((p) => p.id);

    const [
      filesUpdated,
      tasksUpdated,
      approvalsCount,
      scheduledPostsCount,
      projectsUpdated,
      invoicesUpdated,
      subscriptionsUpdated,
      socialAccountsCount,
      documentsUpdated,
      clientsUpdated,
    ] = await Promise.all([
      // File deletedAt var
      prisma.file.updateMany({
        where: { projectId: { in: projectIds }, deletedAt: null },
        data: { deletedAt: now },
      }),
      // Task deletedAt yok — direkt sil
      prisma.task.deleteMany({ where: { projectId: { in: projectIds } } }),
      // Approval — direkt sil (deletedAt yok)
      prisma.approval.deleteMany({ where: { projectId: { in: projectIds } } }),
      // ScheduledPost — direkt sil (deletedAt yok, cascade'le de gidebilir)
      prisma.scheduledPost.deleteMany({ where: { projectId: { in: projectIds } } }),
      // Project soft-delete
      prisma.project.updateMany({
        where: { id: { in: projectIds } },
        data: { deletedAt: now },
      }),
      // Invoice
      prisma.invoice.updateMany({
        where: { clientId: { in: clientIds }, deletedAt: null },
        data: { deletedAt: now },
      }),
      // Subscription
      prisma.subscription.updateMany({
        where: { clientId: { in: clientIds }, deletedAt: null },
        data: { deletedAt: now },
      }),
      // SocialAccount — deletedAt yok, hard delete
      prisma.socialAccount.deleteMany({ where: { clientId: { in: clientIds } } }),
      // ClientDocument
      prisma.clientDocument.updateMany({
        where: { clientId: { in: clientIds }, deletedAt: null },
        data: { deletedAt: now },
      }),
      // Client soft-delete
      prisma.client.updateMany({
        where: { id: { in: clientIds } },
        data: { deletedAt: now },
      }),
    ]);

    console.log("Demo veri temizlendi:");
    console.log(`  Clients soft-deleted:        ${clientsUpdated.count} (${clients.map((c) => c.name).join(", ")})`);
    console.log(`  Projects soft-deleted:       ${projectsUpdated.count}`);
    console.log(`  Files soft-deleted:          ${filesUpdated.count}`);
    console.log(`  Tasks deleted:               ${tasksUpdated.count}`);
    console.log(`  Approvals deleted:           ${approvalsCount.count}`);
    console.log(`  ScheduledPosts deleted:      ${scheduledPostsCount.count}`);
    console.log(`  Invoices soft-deleted:       ${invoicesUpdated.count}`);
    console.log(`  Subscriptions soft-deleted:  ${subscriptionsUpdated.count}`);
    console.log(`  SocialAccounts deleted:      ${socialAccountsCount.count}`);
    console.log(`  ClientDocuments soft-deleted:${documentsUpdated.count}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
