import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { STATUS_LABELS, STATUS_COLORS, PIPELINE_ORDER } from "@/lib/constants";
import { formatDate, cn } from "@/lib/utils";
import {
  Users, FileImage, Clock, TrendingUp, Sparkles, ArrowRight, Receipt,
} from "lucide-react";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { ContentStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

type PipelineCounts = Record<string, number>;

async function loadDashboard() {
  // Bu ay aralığı (yerel saat) — fatura özet kırılımı için.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [clientCount, totalProjects, grouped, recent, invoiceGrouped] = await Promise.all([
    prisma.client.count({ where: { deletedAt: null } }),
    prisma.project.count({ where: { deletedAt: null } }),
    prisma.project.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.project.findMany({
      where: { deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
        client: { select: { name: true } },
      },
    }),
    prisma.invoice.groupBy({
      by: ["status"],
      where: {
        deletedAt: null,
        issueDate: { gte: monthStart, lt: monthEnd },
      },
      _count: { _all: true },
    }),
  ]);

  const pipeline: PipelineCounts = Object.fromEntries(
    PIPELINE_ORDER.map((s) => [s, 0])
  );
  for (const row of grouped) {
    pipeline[row.status] = row._count._all;
  }

  const pendingApprovals =
    (pipeline.INTERNAL_REVIEW ?? 0) + (pipeline.CLIENT_REVIEW ?? 0);
  const liveCount = pipeline.LIVE ?? 0;
  const urgentCount = pipeline.CLIENT_REVIEW ?? 0;

  // Fatura özeti — yapıldı (PAID) / kesildi (SENT+OVERDUE) / bekliyor (DRAFT) / iptal (CANCELLED)
  const invoiceStats = {
    paid: 0,
    sent: 0,
    draft: 0,
    cancelled: 0,
  };
  for (const row of invoiceGrouped) {
    const c = row._count._all;
    if (row.status === "PAID") invoiceStats.paid += c;
    else if (row.status === "SENT" || row.status === "OVERDUE") invoiceStats.sent += c;
    else if (row.status === "DRAFT") invoiceStats.draft += c;
    else if (row.status === "CANCELLED") invoiceStats.cancelled += c;
  }

  return {
    clientCount,
    totalProjects,
    pendingApprovals,
    liveCount,
    urgentCount,
    pipeline,
    recent,
    invoiceStats,
    monthLabel: `${["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"][now.getMonth()]} ${now.getFullYear()}`,
  };
}

export default async function DashboardPage() {
  const session = await auth();
  const userName = session?.user?.name ?? "Ekip";

  const {
    clientCount,
    totalProjects,
    pendingApprovals,
    liveCount,
    urgentCount,
    pipeline,
    recent,
    invoiceStats,
    monthLabel,
  } = await loadDashboard();

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Merhaba, {userName.split(" ")[0]} 👋
          </p>
        </div>
        <Link
          href="/icerikler/yeni"
          className={cn(buttonVariants({ variant: "default" }), "gap-2 bg-primary text-white hover:bg-primary/90")}
        >
          <FileImage className="h-4 w-4" />
          Yeni İçerik
        </Link>
      </div>

      {/* AI Insight kartı */}
      {urgentCount > 0 && (
        <div className="ai-border rounded-xl">
          <div className="rounded-xl bg-card p-4 flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-primary uppercase tracking-wide">AI Öngörü</span>
                <Badge className="text-[10px] bg-primary/10 text-primary border-0 h-4 px-1.5">Yeni</Badge>
              </div>
              <p className="text-sm text-foreground">
                Bu hafta <span className="font-semibold">{urgentCount} içerik</span> müşteri onayı
                bekliyor ve gecikme riski var.{" "}
                <Link href="/icerikler?status=CLIENT_REVIEW" className="text-primary underline-offset-2 hover:underline">
                  Takibe al →
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* KPI Kartları */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Müşteriler",     value: clientCount,      sub: "aktif müşteri",   Icon: Users,      color: "" },
          { label: "Toplam İçerik", value: totalProjects,     sub: "tüm zamanlar",   Icon: FileImage,  color: "" },
          { label: "Onay Bekliyor", value: pendingApprovals,  sub: "iç + müşteri",   Icon: Clock,      color: pendingApprovals > 0 ? "text-amber-600" : "" },
          { label: "Yayında",       value: liveCount,         sub: "aktif içerik",    Icon: TrendingUp, color: liveCount > 0 ? "text-emerald-600" : "" },
        ].map(({ label, value, sub, Icon, color }) => (
          <Card key={label} className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className={cn("text-2xl font-bold", color)}>{value}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bu Ay Ödemeler özet satırı */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            {monthLabel} Ödemeleri
          </CardTitle>
          <Link href="/odemeler" className="text-xs text-primary hover:underline">
            Tümünü gör
          </Link>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Link
              href="/odemeler?status=PAID"
              className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-center hover:bg-emerald-500/15 transition-colors"
            >
              <p className="text-2xl font-bold text-emerald-600">{invoiceStats.paid}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Yapıldı</p>
            </Link>
            <Link
              href="/odemeler?status=SENT"
              className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-center hover:bg-blue-500/15 transition-colors"
            >
              <p className="text-2xl font-bold text-blue-600">{invoiceStats.sent}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Fatura kesildi</p>
            </Link>
            <Link
              href="/odemeler?status=DRAFT"
              className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-center hover:bg-amber-500/15 transition-colors"
            >
              <p className="text-2xl font-bold text-amber-600">{invoiceStats.draft}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Bekliyor</p>
            </Link>
            <Link
              href="/odemeler?status=CANCELLED"
              className="rounded-lg bg-slate-500/10 border border-slate-500/20 p-3 text-center hover:bg-slate-500/15 transition-colors"
            >
              <p className="text-2xl font-bold text-slate-600">{invoiceStats.cancelled}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">İptal</p>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Durumu */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Pipeline Durumu</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 lg:grid-cols-8 gap-3">
            {PIPELINE_ORDER.map((status) => {
              const count = pipeline[status] ?? 0;
              const isHighlight = ["CLIENT_REVIEW", "INTERNAL_REVIEW"].includes(status);
              return (
                <Link
                  key={status}
                  href={`/icerikler?status=${status}`}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-xl text-base font-bold transition-colors",
                    count > 0
                      ? isHighlight
                        ? "bg-amber-100 text-amber-700 group-hover:bg-amber-200"
                        : "bg-primary/10 text-primary group-hover:bg-primary/20"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {count}
                  </div>
                  <span className="text-[10px] text-muted-foreground text-center leading-tight">
                    {STATUS_LABELS[status]}
                  </span>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Son İçerikler */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Son İçerikler</h2>
          <Link href="/icerikler" className="flex items-center gap-1 text-xs text-primary hover:underline underline-offset-2">
            Tümünü gör <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <FileImage className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-3">Henüz içerik yok.</p>
            <Link
              href="/icerikler/yeni"
              className={cn(buttonVariants({ variant: "default" }), "gap-2 bg-primary text-white hover:bg-primary/90")}
            >
              İlk içeriği oluştur
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((p) => {
              const status = p.status as ContentStatus;
              return (
                <Link
                  key={p.id}
                  href={`/icerikler/${p.id}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:bg-muted/40 transition-colors group"
                >
                  <div className={cn(
                    "h-8 w-8 shrink-0 rounded-lg flex items-center justify-center",
                    STATUS_COLORS[status]
                  )}>
                    <FileImage className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                      {p.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{p.client.name}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={cn("text-[10px] border-0 font-medium", STATUS_COLORS[status])}>
                      {STATUS_LABELS[status]}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground hidden lg:block">
                      {formatDate(p.updatedAt)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
