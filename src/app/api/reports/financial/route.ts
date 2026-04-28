import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/reports/financial — ADMIN için finansal özet.
 *
 * Döndüğü alanlar:
 *  - mrr: aktif aylık abonelik tutarları toplamı (KDV hariç)
 *  - arr: aktif aylık×12 + 3aylık×4 + yıllık×1 (yıllık yinelenen gelir)
 *  - openTotal / overdueTotal: açık/gecikmiş faturalar toplamı (KDV dahil)
 *  - monthly: son 12 ay için ay başına tahsil edilen / kesilen tutar
 *  - topClients: en yüksek tahsil edilen 5 müşteri
 *
 * Para birimi karışımı: MVP'de tüm hesaplar currency'den bağımsız toplamlanır —
 * yani 100 USD + 1000 TRY = 1100 gösterilir. Gerçek FX dönüşümü yoksa kabul
 * edilebilir (çoğu ajans sadece TRY kullanır). Çok para birimli çalışılıyorsa
 * ileride FX servisi eklenmeli.
 */
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Sadece ADMIN görebilir" }, { status: 403 });
  }

  const now = new Date();
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  const [activeSubs, openInvoices, overdueInvoices, recentInvoices, paidInvoices] = await Promise.all([
    prisma.subscription.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      select: { amount: true, interval: true, currency: true },
    }),
    prisma.invoice.findMany({
      where: { status: { in: ["SENT", "OVERDUE"] }, deletedAt: null },
      select: { totalAmount: true },
    }),
    prisma.invoice.findMany({
      where: { status: "OVERDUE", deletedAt: null },
      select: { totalAmount: true },
    }),
    // Son 12 ay için paid + issued
    prisma.invoice.findMany({
      where: {
        deletedAt: null,
        OR: [{ issueDate: { gte: twelveMonthsAgo } }, { paidAt: { gte: twelveMonthsAgo } }],
      },
      select: {
        totalAmount: true,
        issueDate: true,
        paidAt: true,
        status: true,
        clientId: true,
      },
    }),
    // Top 5 müşteri için tahsil edilen
    prisma.invoice.groupBy({
      by: ["clientId"],
      where: { status: "PAID", deletedAt: null },
      _sum: { totalAmount: true },
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 5,
    }),
  ]);

  // MRR — monthly abonelikler
  const mrr = activeSubs
    .filter((s) => s.interval === "MONTHLY")
    .reduce((sum, s) => sum + Number(s.amount), 0);

  // ARR — yıllık yinelenen gelir (aylık×12 + 3aylık×4 + yıllık×1)
  const arr = activeSubs.reduce((sum, s) => {
    const multiplier = s.interval === "MONTHLY" ? 12 : s.interval === "QUARTERLY" ? 4 : 1;
    return sum + Number(s.amount) * multiplier;
  }, 0);

  const openTotal = openInvoices.reduce((s, i) => s + Number(i.totalAmount), 0);
  const overdueTotal = overdueInvoices.reduce((s, i) => s + Number(i.totalAmount), 0);

  // Son 12 ay bucket'ları
  const buckets: Record<string, { collected: number; issued: number }> = {};
  for (let i = 0; i < 12; i++) {
    const d = new Date(twelveMonthsAgo);
    d.setMonth(d.getMonth() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets[key] = { collected: 0, issued: 0 };
  }

  for (const inv of recentInvoices) {
    const issued = inv.issueDate;
    if (issued >= twelveMonthsAgo) {
      const k = `${issued.getFullYear()}-${String(issued.getMonth() + 1).padStart(2, "0")}`;
      if (buckets[k]) buckets[k].issued += Number(inv.totalAmount);
    }
    if (inv.paidAt && inv.paidAt >= twelveMonthsAgo) {
      const k = `${inv.paidAt.getFullYear()}-${String(inv.paidAt.getMonth() + 1).padStart(2, "0")}`;
      if (buckets[k]) buckets[k].collected += Number(inv.totalAmount);
    }
  }

  const monthly = Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => {
      const [y, m] = key.split("-");
      return {
        year: parseInt(y, 10),
        month: parseInt(m, 10),
        collected: Math.round(val.collected * 100) / 100,
        issued: Math.round(val.issued * 100) / 100,
      };
    });

  // Top müşteri adlarını ekle
  const topClientIds = paidInvoices.map((p) => p.clientId);
  const topClients = topClientIds.length
    ? await prisma.client.findMany({
        where: { id: { in: topClientIds } },
        select: { id: true, name: true },
      })
    : [];
  const clientMap = Object.fromEntries(topClients.map((c) => [c.id, c.name]));
  const topClientsList = paidInvoices.map((p) => ({
    clientId: p.clientId,
    name: clientMap[p.clientId] ?? "—",
    total: Math.round(Number(p._sum.totalAmount ?? 0) * 100) / 100,
  }));

  return NextResponse.json({
    mrr: Math.round(mrr * 100) / 100,
    arr: Math.round(arr * 100) / 100,
    openTotal: Math.round(openTotal * 100) / 100,
    overdueTotal: Math.round(overdueTotal * 100) / 100,
    activeSubCount: activeSubs.length,
    monthly,
    topClients: topClientsList,
  });
}
