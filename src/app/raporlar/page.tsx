"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FinancialSection } from "@/components/reports/financial-section";
import {
  TrendingUp, TrendingDown, Camera, Globe2,
  CheckCircle2, Loader2, Sparkles, Minus,
  TrendingUp as TikTokIcon, Briefcase, PlaySquare, Globe,
} from "lucide-react";

interface KPI {
  totalContent: number;
  contentChange: number;
  publishedTotal: number;
  publishedChange: number;
  avgApprovalDays: number | null;
  clientCount: number;
}

interface MonthBucket {
  year: number;
  month: number;
  count: number;
}

interface PlatformStat {
  platform: string;
  total: number;
  published: number;
  onTime: number;
}

interface ClientPerf {
  id: string;
  name: string;
  score: number;
  published: number;
  pending: number;
  onTime: number | null;
}

interface ReportData {
  kpi: KPI;
  monthly: MonthBucket[];
  platforms: PlatformStat[];
  clients: ClientPerf[];
}

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  INSTAGRAM: Camera,
  FACEBOOK: Globe2,
  TIKTOK: TikTokIcon,
  LINKEDIN: Briefcase,
  YOUTUBE: PlaySquare,
};
const PLATFORM_COLORS: Record<string, string> = {
  INSTAGRAM: "#E1306C",
  FACEBOOK: "#1877F2",
  TIKTOK: "#000000",
  LINKEDIN: "#0A66C2",
  YOUTUBE: "#FF0000",
};

const MONTHS_SHORT = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, background: color }}
      />
    </div>
  );
}

function ChangeIndicator({ value, unit = "" }: { value: number; unit?: string }) {
  if (value === 0) {
    return (
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
        <Minus className="h-3 w-3" /> Değişim yok
      </span>
    );
  }
  const positive = value > 0;
  return (
    <span
      className={cn(
        "flex items-center gap-1 text-[11px] font-medium",
        positive ? "text-emerald-600" : "text-destructive"
      )}
    >
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {positive ? "+" : ""}{value}{unit} geçen ay
    </span>
  );
}

export default function RaporlarPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/reports", { cache: "no-store" });
      if (!res.ok) throw new Error("Rapor yüklenemedi");
      const json = (await res.json()) as { data: ReportData };
      setData(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Raporlar yükleniyor…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-10 max-w-xl">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive font-medium">{error ?? "Veri yok"}</p>
        </div>
      </div>
    );
  }

  const { kpi, monthly, platforms, clients } = data;
  const maxBarVal = Math.max(...monthly.map((m) => m.count), 1);
  const maxPlatform = Math.max(...platforms.map((p) => p.total), 1);
  const now = new Date();
  const currentMonthIdx = monthly.findIndex(
    (m) => m.year === now.getFullYear() && m.month === now.getMonth()
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Raporlar</h1>
          <p className="text-sm text-muted-foreground">Performans özeti</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-primary font-medium ai-border rounded-lg px-3 py-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          AI Analiz Aktif
        </div>
      </div>

      {/* KPI Kartları */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-1">Toplam İçerik</p>
          <p className="text-2xl font-bold">{kpi.totalContent}</p>
          <div className="mt-1">
            <ChangeIndicator value={kpi.contentChange} />
          </div>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-1">Yayınlanan</p>
          <p className="text-2xl font-bold">{kpi.publishedTotal}</p>
          <div className="mt-1">
            <ChangeIndicator value={kpi.publishedChange} />
          </div>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-1">Onay Süresi Ort.</p>
          <p className="text-2xl font-bold">
            {kpi.avgApprovalDays !== null ? `${kpi.avgApprovalDays} gün` : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">Son 200 onay üzerinden</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-1">Aktif Müşteri</p>
          <p className="text-2xl font-bold">{kpi.clientCount}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Silinmemiş toplam</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Aylık bar chart */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-4">Aylık Yayın Sayısı (son 12 ay)</h3>
          <div className="flex items-end gap-1.5 h-32">
            {monthly.map((bucket, i) => {
              const isCurrent = i === currentMonthIdx;
              return (
                <div key={`${bucket.year}-${bucket.month}`} className="flex-1 flex flex-col items-center gap-1">
                  <div className="relative w-full h-full flex items-end">
                    <div
                      className={cn(
                        "w-full rounded-t-sm transition-all duration-700",
                        isCurrent ? "bg-primary" : "bg-muted-foreground/20"
                      )}
                      style={{ height: `${(bucket.count / maxBarVal) * 100}%`, minHeight: bucket.count > 0 ? "3px" : "0" }}
                      title={`${bucket.count} yayın`}
                    />
                  </div>
                  <span className={cn(
                    "text-[9px] font-medium",
                    isCurrent ? "text-primary" : "text-muted-foreground"
                  )}>
                    {MONTHS_SHORT[bucket.month]}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Platform dağılımı */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-4">Platform Performansı</h3>
          {platforms.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
              Henüz veri yok
            </div>
          ) : (
            <div className="space-y-3">
              {platforms.map((p) => {
                const Icon = PLATFORM_ICONS[p.platform] ?? Globe;
                const color = PLATFORM_COLORS[p.platform] ?? "#64748b";
                const onTimePct = p.published > 0 ? Math.round((p.onTime / p.published) * 100) : null;
                return (
                  <div key={p.platform} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-md flex items-center justify-center" style={{ background: color + "22" }}>
                          <Icon className="h-3 w-3" style={{ color }} />
                        </div>
                        <span className="font-medium">{p.platform}</span>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span>{p.total} planlandı</span>
                        <span>{p.published} yayınlandı</span>
                        {onTimePct !== null && (
                          <span className="font-semibold text-foreground">
                            %{onTimePct} zamanında
                          </span>
                        )}
                      </div>
                    </div>
                    <MiniBar value={p.total} max={maxPlatform} color={color} />
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Müşteri performans tablosu */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-4">Müşteri Performans Tablosu</h3>
        <div className="space-y-1">
          <div className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-2 text-[11px] font-semibold text-muted-foreground pb-2 border-b border-border">
            <span>Müşteri</span>
            <span className="text-center">Sağlık</span>
            <span className="text-center">Yayın</span>
            <span className="text-center">Bekleyen</span>
            <span className="text-center">Zamanında</span>
          </div>
          {clients.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">Henüz müşteri verisi yok</p>
          )}
          {clients.map((c) => {
            const scoreColor = c.score >= 80 ? "#10b981" : c.score >= 60 ? "#f59e0b" : "#ef4444";
            const onTimeColor =
              c.onTime === null ? "text-muted-foreground"
              : c.onTime >= 90 ? "text-emerald-600"
              : c.onTime >= 70 ? "text-amber-600"
              : "text-destructive";
            return (
              <Link key={c.id} href={`/musteriler/${c.id}`}>
                <div className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-2 items-center py-2 border-b border-border/50 last:border-0 text-sm hover:bg-muted/30 rounded px-1 -mx-1 transition-colors cursor-pointer">
                  <span className="font-medium text-sm">{c.name}</span>
                  <div className="text-center">
                    <span className="font-bold text-xs" style={{ color: scoreColor }}>{c.score}</span>
                  </div>
                  <div className="text-center text-xs text-muted-foreground">{c.published}</div>
                  <div className="text-center">
                    {c.pending > 0 ? (
                      <Badge className="text-[10px] h-4 px-1.5 bg-amber-100 text-amber-700 border-0">
                        {c.pending}
                      </Badge>
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mx-auto" />
                    )}
                  </div>
                  <div className={cn("text-center text-xs font-medium", onTimeColor)}>
                    {c.onTime === null ? "—" : `%${c.onTime}`}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </Card>

      {/* AI İnsight */}
      <Card className="p-4 ai-border">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg bg-[oklch(0.55_0.18_295)]/10 flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-[oklch(0.55_0.18_295)]" />
          </div>
          <div>
            <p className="text-sm font-semibold mb-1">AI Analiz Özeti</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {kpi.totalContent === 0
                ? "Henüz yeterli veri yok. Müşteri ve içerik ekledikçe AI analizleri burada görünecek."
                : `Son 12 ayda ${monthly.reduce((s, m) => s + m.count, 0)} yayın yapıldı. ${
                    kpi.publishedChange > 0
                      ? `Geçen aya göre ${kpi.publishedChange} fazla yayın güzel bir ivme.`
                      : kpi.publishedChange < 0
                        ? `Geçen aya göre ${Math.abs(kpi.publishedChange)} daha az yayın var — pipeline kontrol edilmeli.`
                        : "Yayın ritminiz geçen ayla aynı seviyede."
                  }`}
            </p>
          </div>
        </div>
      </Card>

      {/* Finansal Özet — sadece ADMIN görür, /api/reports/financial 403 dönerse gizlenir */}
      <FinancialSection />
    </div>
  );
}
