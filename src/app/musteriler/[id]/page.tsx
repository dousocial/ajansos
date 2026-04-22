"use client";

import { use } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatDate } from "@/lib/utils";
import { STATUS_LABELS, STATUS_COLORS, PIPELINE_ORDER } from "@/lib/constants";
import {
  ArrowLeft, Plus, Camera, Globe2, Globe,
  TrendingUp, Users, Mail, Phone, Calendar,
  CheckCircle2, Clock, AlertCircle, FileImage,
  Edit2, ExternalLink, Briefcase,
} from "lucide-react";

const DEMO_CLIENTS: Record<string, {
  id: string; name: string; industry: string; contactName: string;
  contactEmail: string; contactPhone: string; healthScore: number;
  platforms: string[]; brandVoice: string; revisionQuota: number;
  createdAt: string;
}> = {};

const DEMO_PROJECTS: {
  id: string; title: string; status: string; publishAt: string; platform: string;
}[] = [];

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  INSTAGRAM: Camera,
  FACEBOOK: Globe2,
  TIKTOK: TrendingUp,
  LINKEDIN: Briefcase,
  YOUTUBE: Globe,
};

const PLATFORM_LABELS: Record<string, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  TIKTOK: "TikTok",
  LINKEDIN: "LinkedIn",
  YOUTUBE: "YouTube",
};

function HealthRing({ score }: { score: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <svg width="68" height="68" viewBox="0 0 68 68">
      <circle cx="34" cy="34" r={r} fill="none" stroke="var(--border)" strokeWidth="4" />
      <circle
        cx="34" cy="34" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 34 34)"
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
      <text x="34" y="39" textAnchor="middle" fontSize="16" fontWeight="800" fill={color}>
        {score}
      </text>
    </svg>
  );
}

function StatusDot({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "#94a3b8";
  return <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: color }} />;
}

export default function MusteriDetayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const client = DEMO_CLIENTS[id];

  if (!client) {
    return (
      <div className="space-y-5">
        <Link href="/musteriler" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5 -ml-2")}>
          <ArrowLeft className="h-3.5 w-3.5" /> Müşteriler
        </Link>
        <Card className="p-10 text-center text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
          <p className="font-medium">Müşteri bulunamadı</p>
          <p className="text-xs mt-1">Bu ID&apos;ye ait bir müşteri kaydı yok.</p>
        </Card>
      </div>
    );
  }

  const activeProjects = DEMO_PROJECTS.filter((p) =>
    !["PUBLISHED", "LIVE"].includes(p.status)
  );
  const pastProjects = DEMO_PROJECTS.filter((p) =>
    ["PUBLISHED", "LIVE"].includes(p.status)
  );

  const pipelineCounts = PIPELINE_ORDER.reduce<Record<string, number>>((acc, s) => {
    acc[s] = DEMO_PROJECTS.filter((p) => p.status === s).length;
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link
          href="/musteriler"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5 -ml-2")}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Müşteriler
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
            {client.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{client.name}</h1>
            <p className="text-sm text-muted-foreground">{client.industry}</p>
          </div>
          <HealthRing score={client.healthScore} />
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/musteriler/${id}/duzenle`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            <Edit2 className="h-3.5 w-3.5" /> Düzenle
          </Link>
          <Link
            href={`/icerikler/yeni?client=${id}`}
            className={cn(buttonVariants({ size: "sm" }), "gap-1.5 bg-primary text-white hover:bg-primary/90")}
          >
            <Plus className="h-3.5 w-3.5" /> Yeni İçerik
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="genel">
        <TabsList>
          <TabsTrigger value="genel">Genel Bakış</TabsTrigger>
          <TabsTrigger value="icerikler">İçerikler</TabsTrigger>
          <TabsTrigger value="hesaplar">Sosyal Hesaplar</TabsTrigger>
          <TabsTrigger value="ayarlar">Marka Ayarları</TabsTrigger>
        </TabsList>

        {/* Genel Bakış */}
        <TabsContent value="genel" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Sol: iletişim bilgileri */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3">İletişim Bilgileri</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Yetkili:</span>
                    <span className="font-medium">{client.contactName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">E-posta:</span>
                    <a href={`mailto:${client.contactEmail}`} className="font-medium text-primary hover:underline">
                      {client.contactEmail}
                    </a>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Telefon:</span>
                    <span className="font-medium">{client.contactPhone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Başlangıç:</span>
                    <span className="font-medium">{formatDate(client.createdAt)}</span>
                  </div>
                </div>
              </Card>

              {/* Pipeline özeti */}
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3">Pipeline Durumu</h3>
                <div className="grid grid-cols-4 gap-2">
                  {PIPELINE_ORDER.filter((s) => s !== "LIVE" && s !== "PUBLISHED").map((status) => (
                    <div key={status} className="rounded-lg bg-muted/50 p-2 text-center">
                      <p className="text-lg font-bold">{pipelineCounts[status] ?? 0}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                        {STATUS_LABELS[status]}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Aktif projeler */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">Aktif İçerikler</h3>
                  <Link
                    href={`/icerikler?client=${id}`}
                    className="text-xs text-primary hover:underline"
                  >
                    Tümünü gör
                  </Link>
                </div>
                <div className="space-y-2">
                  {activeProjects.map((p) => {
                    const Icon = PLATFORM_ICONS[p.platform] ?? Camera;
                    return (
                      <Link
                        key={p.id}
                        href={`/icerikler/${p.id}`}
                        className="flex items-center gap-3 rounded-lg hover:bg-muted p-2 -mx-2 transition-colors group"
                      >
                        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                            {p.title}
                          </p>
                          <p className="text-[11px] text-muted-foreground">{formatDate(p.publishAt)}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <StatusDot status={p.status} />
                          <Badge
                            className="text-[10px] h-5 px-1.5 font-medium"
                            style={{
                              background: STATUS_COLORS[p.status] + "22",
                              color: STATUS_COLORS[p.status],
                              border: "none",
                            }}
                          >
                            {STATUS_LABELS[p.status]}
                          </Badge>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </Card>
            </div>

            {/* Sağ: istatistikler */}
            <div className="space-y-4">
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3">Özet</h3>
                <div className="space-y-3">
                  {[
                    { label: "Aktif İçerik", value: activeProjects.length, icon: FileImage },
                    { label: "Tamamlanan", value: pastProjects.length, icon: CheckCircle2 },
                    { label: "Revizyon Kotası", value: `${client.revisionQuota} hak`, icon: Clock },
                    { label: "Bekleyen Onay", value: activeProjects.filter((p) => p.status === "CLIENT_REVIEW").length, icon: AlertCircle },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Icon className="h-4 w-4" />
                        <span>{label}</span>
                      </div>
                      <span className="text-sm font-semibold">{value}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3">Platformlar</h3>
                <div className="space-y-2">
                  {client.platforms.map((p) => {
                    const Icon = PLATFORM_ICONS[p] ?? Globe;
                    return (
                      <div key={p} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <span>{PLATFORM_LABELS[p]}</span>
                        </div>
                        <Badge variant="secondary" className="text-[10px]">Bağlı</Badge>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Link
                href={`/portal?token=demo_${id}`}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "w-full gap-2 justify-center"
                )}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Müşteri Portalı
              </Link>
            </div>
          </div>
        </TabsContent>

        {/* İçerikler tab */}
        <TabsContent value="icerikler" className="mt-4">
          <Card className="p-4">
            <div className="space-y-2">
              {DEMO_PROJECTS.map((p) => {
                const Icon = PLATFORM_ICONS[p.platform] ?? Camera;
                return (
                  <Link
                    key={p.id}
                    href={`/icerikler/${p.id}`}
                    className="flex items-center gap-3 rounded-lg hover:bg-muted p-2 -mx-2 transition-colors group"
                  >
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                        {p.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{formatDate(p.publishAt)}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <StatusDot status={p.status} />
                      <Badge
                        className="text-[10px] h-5 px-1.5"
                        style={{
                          background: STATUS_COLORS[p.status] + "22",
                          color: STATUS_COLORS[p.status],
                          border: "none",
                        }}
                      >
                        {STATUS_LABELS[p.status]}
                      </Badge>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        {/* Sosyal Hesaplar tab */}
        <TabsContent value="hesaplar" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {client.platforms.map((p) => {
              const Icon = PLATFORM_ICONS[p] ?? Globe;
              return (
                <Card key={p} className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{PLATFORM_LABELS[p]}</p>
                      <p className="text-[11px] text-muted-foreground">@{client.name.toLowerCase().replace(/\s/g, "")}</p>
                    </div>
                    <Badge variant="secondary" className="ml-auto text-[10px]">Bağlı</Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Token süresi: <span className="text-foreground font-medium">30 Haziran 2025</span>
                  </div>
                </Card>
              );
            })}

            <Card className="p-4 border-dashed border-2 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all cursor-pointer min-h-[120px]">
              <Plus className="h-5 w-5" />
              <p className="text-sm font-medium">Hesap Bağla</p>
            </Card>
          </div>
        </TabsContent>

        {/* Marka Ayarları tab */}
        <TabsContent value="ayarlar" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-2">Marka Sesi</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{client.brandVoice}</p>
            </Card>
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-2">Revizyon Kotası</h3>
              <p className="text-2xl font-bold">{client.revisionQuota}</p>
              <p className="text-xs text-muted-foreground">revizyon hakkı / içerik</p>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
