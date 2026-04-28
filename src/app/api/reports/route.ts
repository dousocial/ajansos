import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/reports
// Toplu analitik — dashboard sonrasında ikinci seviye özet
// CLIENT kullanıcıya kapalı (kendi portali yeterli bilgi veriyor).
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Bu sayfa ekip kullanıcılarına açıktır" }, { status: 403 });
  }

  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOfYearWindow = new Date(now.getFullYear(), now.getMonth() - 11, 1); // son 12 ay

  // ─── KPI sayaçları ──────────────────────────────────────────────────────────
  const [
    totalContent,
    contentThisMonth,
    contentLastMonth,
    publishedTotal,
    publishedThisMonth,
    publishedLastMonth,
    clientApprovedApprovals,
    clientCountsByStatus,
  ] = await Promise.all([
    prisma.project.count({ where: { deletedAt: null } }),
    prisma.project.count({
      where: { deletedAt: null, createdAt: { gte: startOfThisMonth } },
    }),
    prisma.project.count({
      where: {
        deletedAt: null,
        createdAt: { gte: startOfLastMonth, lt: startOfThisMonth },
      },
    }),
    prisma.project.count({
      where: { deletedAt: null, status: { in: ["LIVE", "PUBLISHED"] } },
    }),
    prisma.project.count({
      where: {
        deletedAt: null,
        status: { in: ["LIVE", "PUBLISHED"] },
        publishedAt: { gte: startOfThisMonth },
      },
    }),
    prisma.project.count({
      where: {
        deletedAt: null,
        status: { in: ["LIVE", "PUBLISHED"] },
        publishedAt: { gte: startOfLastMonth, lt: startOfThisMonth },
      },
    }),
    // Onay süresi: client APPROVED approval kaydı + projenin createdAt'i
    prisma.approval.findMany({
      where: { type: "CLIENT", status: "APPROVED" },
      select: {
        createdAt: true,
        project: { select: { createdAt: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200, // son 200 onay üzerinden ortalama
    }),
    prisma.client.count({ where: { deletedAt: null } }),
  ]);

  // Ortalama onay süresi (gün)
  let avgApprovalDays: number | null = null;
  if (clientApprovedApprovals.length > 0) {
    const totalMs = clientApprovedApprovals.reduce((acc, a) => {
      return acc + (a.createdAt.getTime() - a.project.createdAt.getTime());
    }, 0);
    avgApprovalDays = +(totalMs / clientApprovedApprovals.length / 86400000).toFixed(1);
  }

  // ─── Aylık seri (son 12 ay, publishedAt bazlı) ─────────────────────────────
  const monthlyPublishedRaw = await prisma.project.findMany({
    where: {
      deletedAt: null,
      status: { in: ["LIVE", "PUBLISHED"] },
      publishedAt: { gte: startOfYearWindow },
    },
    select: { publishedAt: true },
  });

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(startOfYearWindow.getFullYear(), startOfYearWindow.getMonth() + i, 1);
    return { year: d.getFullYear(), month: d.getMonth(), count: 0 };
  });
  for (const p of monthlyPublishedRaw) {
    if (!p.publishedAt) continue;
    const y = p.publishedAt.getFullYear();
    const m = p.publishedAt.getMonth();
    const bucket = months.find((b) => b.year === y && b.month === m);
    if (bucket) bucket.count += 1;
  }

  // ─── Platform dağılımı ─────────────────────────────────────────────────────
  const platformGroups = await prisma.scheduledPost.groupBy({
    by: ["platform"],
    _count: { _all: true },
  });

  // Platform başına on-time ratio: publishedAt ile scheduledAt farkı <= 1 saat
  const publishedPosts = await prisma.scheduledPost.findMany({
    where: { status: "published", publishedAt: { not: null } },
    select: { platform: true, scheduledAt: true, publishedAt: true },
  });

  type PlatformStat = {
    platform: string;
    total: number;
    published: number;
    onTime: number;
  };
  const byPlatform = new Map<string, PlatformStat>();
  for (const g of platformGroups) {
    byPlatform.set(g.platform, {
      platform: g.platform,
      total: g._count._all,
      published: 0,
      onTime: 0,
    });
  }
  for (const p of publishedPosts) {
    if (!p.publishedAt) continue;
    const s = byPlatform.get(p.platform);
    if (!s) continue;
    s.published += 1;
    const diffMs = Math.abs(p.publishedAt.getTime() - p.scheduledAt.getTime());
    if (diffMs <= 60 * 60 * 1000) s.onTime += 1;
  }
  const platforms = Array.from(byPlatform.values()).sort((a, b) => b.total - a.total);

  // ─── Müşteri performansı ──────────────────────────────────────────────────
  const clients = await prisma.client.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      healthScore: true,
      projects: {
        where: { deletedAt: null },
        select: {
          status: true,
          scheduledPosts: {
            where: { status: "published", publishedAt: { not: null } },
            select: { scheduledAt: true, publishedAt: true },
          },
        },
      },
    },
  });

  const clientPerf = clients
    .map((c) => {
      let published = 0;
      let pending = 0;
      let onTimeHits = 0;
      let scheduledCompleted = 0;
      for (const p of c.projects) {
        if (p.status === "LIVE" || p.status === "PUBLISHED") published += 1;
        if (p.status === "CLIENT_REVIEW" || p.status === "INTERNAL_REVIEW") pending += 1;
        for (const sp of p.scheduledPosts) {
          if (!sp.publishedAt) continue;
          scheduledCompleted += 1;
          const diff = Math.abs(sp.publishedAt.getTime() - sp.scheduledAt.getTime());
          if (diff <= 60 * 60 * 1000) onTimeHits += 1;
        }
      }
      const onTimeRatio =
        scheduledCompleted > 0
          ? Math.round((onTimeHits / scheduledCompleted) * 100)
          : null;
      return {
        id: c.id,
        name: c.name,
        score: c.healthScore,
        published,
        pending,
        onTime: onTimeRatio,
      };
    })
    // En çok yayınlayandan az olana
    .sort((a, b) => b.published - a.published || b.score - a.score);

  // ─── Değişim oranları ──────────────────────────────────────────────────────
  const contentChange = contentThisMonth - contentLastMonth;
  const publishedChange = publishedThisMonth - publishedLastMonth;

  return NextResponse.json({
    data: {
      kpi: {
        totalContent,
        contentChange,
        publishedTotal,
        publishedChange,
        avgApprovalDays,
        clientCount: clientCountsByStatus,
      },
      monthly: months, // son 12 ay
      platforms,        // platform başına total, published, onTime sayıları
      clients: clientPerf,
    },
  });
}
