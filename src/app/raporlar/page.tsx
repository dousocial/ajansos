"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, Camera, Globe2,
  Users, FileImage, CheckCircle2, Clock,
  BarChart3, Sparkles,
} from "lucide-react";

const DEMO_KPI = [
  { label: "Toplam İçerik", value: 0, change: 0, unit: "" },
  { label: "Yayınlanan", value: 0, change: 0, unit: "" },
  { label: "Onay Süresi Ort.", value: "—", change: 0, unit: " gün" },
  { label: "Müşteri Memnuniyeti", value: "—", change: 0, unit: "%" },
];

const DEMO_CLIENT_PERF: {
  name: string; score: number; published: number; pending: number; onTime: number;
}[] = [];

const DEMO_PLATFORM_DATA: {
  platform: string; posts: number; reach: string; engagement: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any; color: string;
}[] = [];

const DEMO_MONTHLY = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const CURRENT_MONTH = new Date().getMonth();
const MONTHS_SHORT = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${(value / max) * 100}%`, background: color }}
      />
    </div>
  );
}

export default function RaporlarPage() {
  const maxBarVal = Math.max(...DEMO_MONTHLY, 1);

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
        {DEMO_KPI.map(({ label, value, change, unit }) => {
          const positive = change > 0;
          const neutral = change === 0;
          return (
            <Card key={label} className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className="text-2xl font-bold">
                {value}{unit}
              </p>
              <div className={cn(
                "flex items-center gap-1 text-[11px] font-medium mt-1",
                neutral ? "text-muted-foreground" : positive ? "text-emerald-600" : "text-destructive"
              )}>
                {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {positive ? "+" : ""}{change}{unit} geçen ay
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Aylık bar chart */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-4">Aylık Yayın Sayısı</h3>
          <div className="flex items-end gap-1.5 h-32">
            {DEMO_MONTHLY.map((val, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "w-full rounded-t-sm transition-all duration-700",
                    i === CURRENT_MONTH ? "bg-primary" : "bg-muted-foreground/20"
                  )}
                  style={{ height: `${(val / maxBarVal) * 100}%` }}
                />
                <span className={cn(
                  "text-[9px] font-medium",
                  i === CURRENT_MONTH ? "text-primary" : "text-muted-foreground"
                )}>
                  {MONTHS_SHORT[i]}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Platform dağılımı */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-4">Platform Performansı</h3>
          {DEMO_PLATFORM_DATA.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
              Henüz veri yok
            </div>
          ) : (
            <div className="space-y-3">
              {DEMO_PLATFORM_DATA.map(({ platform, posts, reach, engagement, icon: Icon, color }) => (
                <div key={platform} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 rounded-md flex items-center justify-center" style={{ background: color + "22" }}>
                        <Icon className="h-3 w-3" style={{ color }} />
                      </div>
                      <span className="font-medium">{platform}</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span>{posts} post</span>
                      <span>{reach} erişim</span>
                      <span className="font-semibold text-foreground">{engagement}</span>
                    </div>
                  </div>
                  <MiniBar value={posts} max={24} color={color} />
                </div>
              ))}
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
          {DEMO_CLIENT_PERF.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">Henüz müşteri verisi yok</p>
          )}
          {DEMO_CLIENT_PERF.map((c) => {
            const scoreColor = c.score >= 80 ? "#10b981" : c.score >= 60 ? "#f59e0b" : "#ef4444";
            return (
              <div
                key={c.name}
                className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-2 items-center py-2 border-b border-border/50 last:border-0 text-sm hover:bg-muted/30 rounded px-1 -mx-1 transition-colors"
              >
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
                <div className="text-center text-xs font-medium">
                  <span className={cn(c.onTime >= 90 ? "text-emerald-600" : c.onTime >= 70 ? "text-amber-600" : "text-destructive")}>
                    %{c.onTime}
                  </span>
                </div>
              </div>
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
              Henüz yeterli veri yok. Müşteri ve içerik ekledikçe AI analizleri burada görünecek.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
