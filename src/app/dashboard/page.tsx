import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { STATUS_LABELS, STATUS_COLORS, PIPELINE_ORDER } from "@/lib/constants";
import { formatDate, cn } from "@/lib/utils";
import {
  Users, FileImage, Clock, TrendingUp, Sparkles, ArrowRight,
} from "lucide-react";
import Link from "next/link";

// Demo verisi — DB bağlantısı hazır olunca auth + prisma ile değiştirilecek
const DEMO = {
  user: { name: "Ahmet Yılmaz", role: "ADMIN" },
  clientCount: 8,
  totalProjects: 34,
  pendingApprovals: 5,
  liveCount: 3,
  urgentCount: 5,
  pipeline: {
    PLANNED: 4, SHOOTING: 2, EDITING: 6,
    INTERNAL_REVIEW: 3, CLIENT_REVIEW: 5,
    APPROVED: 7, LIVE: 3, PUBLISHED: 4,
  },
  recent: [
    { id: "1", title: "Mayıs Kampanya Reels", status: "CLIENT_REVIEW",  updatedAt: new Date(), client: { name: "Coffee House" } },
    { id: "2", title: "Ürün Tanıtım Videosu", status: "EDITING",        updatedAt: new Date(Date.now() - 86400000), client: { name: "ModaStore" } },
    { id: "3", title: "Camera Story Seti", status: "INTERNAL_REVIEW",updatedAt: new Date(Date.now() - 172800000), client: { name: "FitLife Gym" } },
    { id: "4", title: "Bayram Özel İçerik",   status: "APPROVED",       updatedAt: new Date(Date.now() - 259200000), client: { name: "Teknosa" } },
    { id: "5", title: "Marka Kimliği Posteri", status: "SHOOTING",      updatedAt: new Date(Date.now() - 345600000), client: { name: "Coffee House" } },
    { id: "6", title: "Haftalık Feed Görseli", status: "LIVE",          updatedAt: new Date(Date.now() - 432000000), client: { name: "ModaStore" } },
  ],
};

export default function DashboardPage() {
  const { user, clientCount, totalProjects, pendingApprovals, liveCount, urgentCount, pipeline, recent } = DEMO;

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Merhaba, {user.name.split(" ")[0]} 👋
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

      {/* KPI Kartları */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Müşteriler",     value: clientCount,      sub: "aktif müşteri",   Icon: Users,      color: "" },
          { label: "Toplam İçerik", value: totalProjects,     sub: "tüm zamanlar",   Icon: FileImage,  color: "" },
          { label: "Onay Bekliyor", value: pendingApprovals,  sub: "iç + müşteri",   Icon: Clock,      color: pendingApprovals > 0 ? "text-amber-600" : "" },
          { label: "Yayında",       value: liveCount,         sub: "bu hafta",        Icon: TrendingUp, color: "text-emerald-600" },
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

      {/* Pipeline Durumu */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Pipeline Durumu</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 lg:grid-cols-8 gap-3">
            {PIPELINE_ORDER.map((status) => {
              const count = pipeline[status as keyof typeof pipeline] ?? 0;
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
        <div className="space-y-2">
          {recent.map((p) => (
            <Link
              key={p.id}
              href={`/icerikler/${p.id}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:bg-muted/40 transition-colors group"
            >
              <div className={cn(
                "h-8 w-8 shrink-0 rounded-lg flex items-center justify-center",
                STATUS_COLORS[p.status]
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
                <Badge className={cn("text-[10px] border-0 font-medium", STATUS_COLORS[p.status])}>
                  {STATUS_LABELS[p.status]}
                </Badge>
                <span className="text-[10px] text-muted-foreground hidden lg:block">
                  {formatDate(p.updatedAt)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
