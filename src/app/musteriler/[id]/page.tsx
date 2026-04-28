"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatDate } from "@/lib/utils";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";
import {
  ArrowLeft, Plus, Camera, Globe2, Globe,
  TrendingUp, Users, Mail, Phone, Calendar,
  AlertCircle,
  Edit2, ExternalLink, Briefcase, Loader2,
  Receipt, Building2, Megaphone, CheckCircle2,
  Video, Clock, Trash2,
} from "lucide-react";

// Reklam çıkıldı mı işaretlenmemiş yayınlanmış post'lar için yanıp söner uyarı.
// Tailwind animate-pulse'ı override etmiyoruz ama daha agresif bir blink istiyoruz
// (göz çekmeli) — global stylesheet eklemek yerine inline keyframes.
const BLINK_STYLE = `
@keyframes ad-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
.ad-blink { animation: ad-blink 1s ease-in-out infinite; }
`;

interface ProjectFile {
  id: string;
  publicUrl: string;
  mimeType: string;
}

interface ProjectRow {
  id: string;
  title: string;
  status: string;
  platforms: string[];
  postType: string;
  publishAt: string | null;
  publishedAt: string | null;
  shootDate: string | null;
  shootLocation: string | null;
  createdAt: string;
  purposes: string[];
  briefDone: boolean;
  shootingDone: boolean;
  editingDone: boolean;
  adRequired: boolean;
  adPosted: boolean;
  files: ProjectFile[];
}

interface SocialAccountRow {
  id: string;
  platform: string;
  accountName: string;
  profileImageUrl: string | null;
  tokenExpiresAt: string | null;
}

interface ClientDetail {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  brandVoice: string | null;
  revisionQuota: number;
  healthScore: number;
  taxId: string | null;
  taxOffice: string | null;
  billingAddress: string | null;
  createdAt: string;
  socialAccounts: SocialAccountRow[];
  projects: ProjectRow[];
  _count: { projects: number };
}

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED";
  totalAmount: string | number; // Decimal as string
  currency: string;
  issueDate: string;
  dueDate: string;
  title: string;
}

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

const PLATFORM_COLORS: Record<string, string> = {
  INSTAGRAM: "bg-gradient-to-tr from-purple-500 via-pink-500 to-orange-400 text-white",
  FACEBOOK: "bg-blue-600 text-white",
  TIKTOK: "bg-black text-white",
  LINKEDIN: "bg-sky-700 text-white",
  YOUTUBE: "bg-red-600 text-white",
};

const PURPOSE_LABELS: Record<string, string> = {
  BILGI: "Bilgi",
  EGLENCE: "Eğlence",
  TANITIM: "Tanıtım",
  KAMPANYA: "Kampanya",
  POST: "Post",
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
  const color = STATUS_COLORS[status] ?? "bg-slate-400";
  return <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", color)} />;
}

// Aynı ay içinde mi (yerel takvim).
function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

const TR_MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function formatTRY(value: string | number, currency: string) {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: currency || "TRY",
    maximumFractionDigits: 0,
  }).format(isFinite(n) ? n : 0);
}

export default function MusteriDetayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Sosyal hesabı sil — onay gerektirir, bekleyen yayın varsa zorunlu onay.
  async function handleRemoveAccount(acc: SocialAccountRow) {
    const label = `${acc.platform} • ${acc.accountName}`;
    if (!confirm(`"${label}" hesabını kaldırmak istediğine emin misin?\n\nBu hesaba bağlı yayınlar varsa silinecek.`)) {
      return;
    }
    setRemovingId(acc.id);
    try {
      let res = await fetch(`/api/social-accounts/${acc.id}`, { method: "DELETE" });
      if (res.status === 409) {
        const data = (await res.json().catch(() => null)) as { pendingCount?: number } | null;
        const pending = data?.pendingCount ?? 0;
        if (!confirm(`Bu hesapta ${pending} bekleyen yayın var. Yine de silmek istiyor musun?\n\nBekleyen yayınlar da kaldırılacak.`)) {
          return;
        }
        res = await fetch(`/api/social-accounts/${acc.id}?force=true`, { method: "DELETE" });
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Silme başarısız");
      }
      // Optimistic UI: client state'inden çıkar
      setClient((c) =>
        c ? { ...c, socialAccounts: c.socialAccounts.filter((a) => a.id !== acc.id) } : c
      );
      toast.success(`${label} kaldırıldı`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setRemovingId(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [resClient, resInv] = await Promise.all([
          fetch(`/api/clients/${id}`, { cache: "no-store" }),
          fetch(`/api/invoices?clientId=${id}&limit=100`, { cache: "no-store" }),
        ]);
        if (resClient.status === 404) {
          if (!cancelled) {
            setClient(null);
            setError("Müşteri bulunamadı");
          }
          return;
        }
        if (!resClient.ok) throw new Error("Müşteri yüklenemedi");
        const json = (await resClient.json()) as { data: ClientDetail };
        if (!cancelled) setClient(json.data);

        if (resInv.ok) {
          const invJson = (await resInv.json()) as { data: InvoiceRow[] };
          if (!cancelled) setInvoices(invJson.data ?? []);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Bilinmeyen hata");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-5">
        <Link href="/musteriler" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5 -ml-2")}>
          <ArrowLeft className="h-3.5 w-3.5" /> Müşteriler
        </Link>
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Müşteri yükleniyor…
        </div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="space-y-5">
        <Link href="/musteriler" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5 -ml-2")}>
          <ArrowLeft className="h-3.5 w-3.5" /> Müşteriler
        </Link>
        <Card className="p-10 text-center text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
          <p className="font-medium">{error ?? "Müşteri bulunamadı"}</p>
          <p className="text-xs mt-1">Bu ID&apos;ye ait bir müşteri kaydı yok.</p>
        </Card>
      </div>
    );
  }

  const projects = client.projects;

  // Yayınlanmış (LIVE/PUBLISHED) projeleri ayır — içerik paylaşımları listesi.
  // Reklam akışı: adRequired=true && adPosted=false → uyarı gerek.
  const publishedProjects = projects
    .filter((p) => p.status === "LIVE" || p.status === "PUBLISHED")
    .sort((a, b) => {
      const aT = new Date(a.publishedAt ?? a.publishAt ?? a.createdAt).getTime();
      const bT = new Date(b.publishedAt ?? b.publishAt ?? b.createdAt).getTime();
      return bT - aT;
    });

  const adWarnings = publishedProjects.filter((p) => p.adRequired && !p.adPosted);

  // Aktif (üretim aşamasında) projeler.
  const activeProjects = projects.filter(
    (p) => !["PUBLISHED", "LIVE", "CANCELLED"].includes(p.status)
  );

  // Çekim planlaması: ileri tarihli shootDate olanlar veya planı yapılmamış olanlar.
  const upcomingShoots = projects
    .filter((p) => p.shootDate && new Date(p.shootDate) >= new Date(new Date().toDateString()))
    .sort((a, b) => new Date(a.shootDate!).getTime() - new Date(b.shootDate!).getTime());

  const connectedPlatforms = client.socialAccounts;
  const hasMetaConnection = connectedPlatforms.some(
    (s) => s.platform === "INSTAGRAM" || s.platform === "FACEBOOK"
  );

  // Bu ayın faturaları — yapıldı/kesildi/bekliyor/iptal kırılımı.
  const now = new Date();
  const monthInvoices = invoices.filter((i) => isSameMonth(new Date(i.issueDate), now));
  const monthSummary = {
    paid: monthInvoices.filter((i) => i.status === "PAID").length,
    sent: monthInvoices.filter((i) => i.status === "SENT" || i.status === "OVERDUE").length,
    draft: monthInvoices.filter((i) => i.status === "DRAFT").length,
    cancelled: monthInvoices.filter((i) => i.status === "CANCELLED").length,
  };
  const monthLabel = `${TR_MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <div className="space-y-5">
      {/* Blink keyframes — sadece bu sayfa için. */}
      <style dangerouslySetInnerHTML={{ __html: BLINK_STYLE }} />

      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link
          href="/musteriler"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5 -ml-2")}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Müşteriler
        </Link>
      </div>

      {/* Reklam uyarı bandı — yayında ama reklam çıkılmamış post varsa */}
      {adWarnings.length > 0 && (
        <div className="ad-blink rounded-lg border border-destructive bg-destructive/10 px-4 py-3 flex items-center gap-3">
          <Megaphone className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-destructive">
              {adWarnings.length} içerik için reklam çıkılmadı!
            </p>
            <p className="text-xs text-destructive/80">
              Yayınlanan post&apos;lar var ama &quot;reklam çıkıldı&quot; işareti konmamış. Aşağıdaki listeden işaretle.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
            {client.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{client.name}</h1>
            <p className="text-sm text-muted-foreground">{client.industry ?? "—"}</p>
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

        {/* Genel Bakış — pipeline kaldırıldı, vergi/Meta/ödeme/içerik/çekim eklendi */}
        <TabsContent value="genel" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Sol kolon */}
            <div className="lg:col-span-2 space-y-4">
              {/* İletişim */}
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3">İletişim Bilgileri</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Yetkili:</span>
                    <span className="font-medium truncate">{client.contactName ?? "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">E-posta:</span>
                    {client.contactEmail ? (
                      <a href={`mailto:${client.contactEmail}`} className="font-medium text-primary hover:underline truncate">
                        {client.contactEmail}
                      </a>
                    ) : (
                      <span className="font-medium">—</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Telefon:</span>
                    <span className="font-medium">{client.contactPhone ?? "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Başlangıç:</span>
                    <span className="font-medium">{formatDate(new Date(client.createdAt))}</span>
                  </div>
                </div>
              </Card>

              {/* Faturalama */}
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Faturalama Bilgileri
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Vergi No:</span>
                    <span className="font-medium font-mono">{client.taxId ?? "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Vergi Dairesi:</span>
                    <span className="font-medium">{client.taxOffice ?? "—"}</span>
                  </div>
                  {client.billingAddress && (
                    <div className="sm:col-span-2 flex items-start gap-2">
                      <span className="text-muted-foreground shrink-0">Fatura Adresi:</span>
                      <span className="font-medium whitespace-pre-line">{client.billingAddress}</span>
                    </div>
                  )}
                </div>
              </Card>

              {/* Bu ay ödemeler özet satırı */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                    {monthLabel} Ödemeleri
                  </h3>
                  <Link
                    href={`/odemeler?clientId=${id}`}
                    className="text-xs text-primary hover:underline"
                  >
                    Tümünü gör
                  </Link>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 text-center">
                    <p className="text-lg font-bold text-emerald-600">{monthSummary.paid}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">Yapıldı</p>
                  </div>
                  <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-2 text-center">
                    <p className="text-lg font-bold text-blue-600">{monthSummary.sent}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">Fatura kesildi</p>
                  </div>
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2 text-center">
                    <p className="text-lg font-bold text-amber-600">{monthSummary.draft}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">Bekliyor</p>
                  </div>
                  <div className="rounded-lg bg-slate-500/10 border border-slate-500/20 p-2 text-center">
                    <p className="text-lg font-bold text-slate-600">{monthSummary.cancelled}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">İptal</p>
                  </div>
                </div>
              </Card>

              {/* İçerik Paylaşımları (yayınlanmış) */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">İçerik Paylaşımları</h3>
                  <span className="text-[11px] text-muted-foreground">
                    {publishedProjects.length} yayında
                  </span>
                </div>
                {publishedProjects.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    Henüz yayınlanmış içerik yok.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {publishedProjects.slice(0, 8).map((p) => {
                      const primaryPlatform = p.platforms[0] ?? "INSTAGRAM";
                      const Icon = PLATFORM_ICONS[primaryPlatform] ?? Camera;
                      const adAlert = p.adRequired && !p.adPosted;
                      const thumb = p.files.find((f) => f.mimeType.startsWith("image/"));
                      return (
                        <Link
                          key={p.id}
                          href={`/icerikler/${p.id}`}
                          className={cn(
                            "flex items-center gap-3 rounded-lg p-2 -mx-2 transition-colors group",
                            adAlert ? "bg-destructive/5 hover:bg-destructive/10" : "hover:bg-muted"
                          )}
                        >
                          {/* Önizleme */}
                          {thumb ? (
                            <Image
                              src={thumb.publicUrl}
                              alt=""
                              width={36}
                              height={36}
                              className="h-9 w-9 rounded-lg object-cover shrink-0"
                              unoptimized
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                              {p.title}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {p.publishedAt
                                ? formatDate(new Date(p.publishedAt))
                                : p.publishAt
                                ? formatDate(new Date(p.publishAt))
                                : "—"}
                            </p>
                          </div>
                          {adAlert && (
                            <span className="ad-blink inline-flex items-center gap-1 rounded-full bg-destructive text-white px-2 py-0.5 text-[10px] font-semibold">
                              <Megaphone className="h-3 w-3" /> Reklam!
                            </span>
                          )}
                          {p.adRequired && p.adPosted && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 px-2 py-0.5 text-[10px] font-medium">
                              <CheckCircle2 className="h-3 w-3" /> Reklam OK
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* Çekim Planlaması */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Video className="h-4 w-4 text-muted-foreground" />
                    Çekim Planlaması
                  </h3>
                  <span className="text-[11px] text-muted-foreground">
                    {upcomingShoots.length} planlı
                  </span>
                </div>
                {upcomingShoots.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    Yaklaşan çekim yok.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {upcomingShoots.slice(0, 5).map((p) => (
                      <Link
                        key={p.id}
                        href={`/icerikler/${p.id}`}
                        className="flex items-center gap-3 rounded-lg hover:bg-muted p-2 -mx-2 transition-colors group"
                      >
                        <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                          <Calendar className="h-4 w-4 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                            {p.title}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {p.shootDate
                              ? new Date(p.shootDate).toLocaleString("tr-TR", {
                                  day: "2-digit",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                            {p.shootLocation ? ` · ${p.shootLocation}` : ""}
                          </p>
                        </div>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* Sağ kolon */}
            <div className="space-y-4">
              {/* Meta İşletme bağlantı durumu */}
              <Card className={cn(
                "p-4",
                hasMetaConnection ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"
              )}>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Meta İşletme Bağlantısı
                </h3>
                {hasMetaConnection ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="font-medium">Bağlı</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-amber-600">
                      <AlertCircle className="h-4 w-4" />
                      <span className="font-medium">Bağlı değil</span>
                    </div>
                    <a
                      href={`/api/meta/oauth/start?clientId=${id}`}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "w-full gap-1.5 justify-center"
                      )}
                    >
                      <Plus className="h-3.5 w-3.5" /> Meta&apos;yı bağla
                    </a>
                  </div>
                )}
              </Card>

              {/* Aktif içerikler özeti */}
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3">Üretimde</h3>
                {activeProjects.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">Aktif içerik yok.</p>
                ) : (
                  <div className="space-y-2">
                    {activeProjects.slice(0, 5).map((p) => (
                      <Link
                        key={p.id}
                        href={`/icerikler/${p.id}`}
                        className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                      >
                        <StatusDot status={p.status} />
                        <span className="truncate flex-1">{p.title}</span>
                        <Badge className={cn("text-[10px] h-4 px-1 border-0", STATUS_COLORS[p.status])}>
                          {STATUS_LABELS[p.status]}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>

              {/* Platformlar */}
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3">Platformlar</h3>
                {connectedPlatforms.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    Henüz bağlı sosyal hesap yok.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {connectedPlatforms.map((s) => {
                      const Icon = PLATFORM_ICONS[s.platform] ?? Globe;
                      return (
                        <div key={s.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm min-w-0">
                            {s.profileImageUrl ? (
                              <Image
                                src={s.profileImageUrl}
                                alt=""
                                width={28}
                                height={28}
                                className="h-7 w-7 rounded-full object-cover shrink-0"
                                unoptimized
                              />
                            ) : (
                              <div className={cn(
                                "h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                                PLATFORM_COLORS[s.platform] ?? "bg-muted"
                              )}>
                                <Icon className="h-3.5 w-3.5" />
                              </div>
                            )}
                            <span className="truncate">{PLATFORM_LABELS[s.platform] ?? s.platform}</span>
                          </div>
                          <Badge variant="secondary" className="text-[10px] shrink-0">Bağlı</Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* Müşteri Portalı (önizle) */}
              <a
                href={`/api/portal/preview?clientId=${id}`}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "w-full gap-2 justify-center"
                )}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Müşteri Portalı (Önizle)
              </a>
            </div>
          </div>
        </TabsContent>

        {/* İçerikler tab */}
        <TabsContent value="icerikler" className="mt-4">
          <Card className="p-4">
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Bu müşteri için henüz içerik yok.
              </p>
            ) : (
              <div className="space-y-2">
                {projects.map((p) => {
                  const primaryPlatform = p.platforms[0] ?? "INSTAGRAM";
                  const Icon = PLATFORM_ICONS[primaryPlatform] ?? Camera;
                  const adAlert = p.adRequired && !p.adPosted &&
                    (p.status === "LIVE" || p.status === "PUBLISHED");
                  return (
                    <Link
                      key={p.id}
                      href={`/icerikler/${p.id}`}
                      className={cn(
                        "flex items-center gap-3 rounded-lg p-2 -mx-2 transition-colors group",
                        adAlert ? "bg-destructive/5 hover:bg-destructive/10" : "hover:bg-muted"
                      )}
                    >
                      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {p.title}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>
                            {p.publishAt ? formatDate(new Date(p.publishAt)) : "Plan yok"}
                          </span>
                          {p.purposes.length > 0 && (
                            <>
                              <span>·</span>
                              <span className="truncate">
                                {p.purposes.map((x) => PURPOSE_LABELS[x] ?? x).join(", ")}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {adAlert && (
                          <span className="ad-blink inline-flex items-center gap-1 rounded-full bg-destructive text-white px-2 py-0.5 text-[10px] font-semibold">
                            <Megaphone className="h-3 w-3" /> Reklam!
                          </span>
                        )}
                        <StatusDot status={p.status} />
                        <Badge
                          className={cn(
                            "text-[10px] h-5 px-1.5 border-0",
                            STATUS_COLORS[p.status]
                          )}
                        >
                          {STATUS_LABELS[p.status]}
                        </Badge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Sosyal Hesaplar tab — profil fotoğrafı / platform logosu eklendi */}
        <TabsContent value="hesaplar" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {connectedPlatforms.map((s) => {
              const Icon = PLATFORM_ICONS[s.platform] ?? Globe;
              const isRemoving = removingId === s.id;
              return (
                <Card key={s.id} className="p-4 group relative">
                  <div className="flex items-center gap-3 mb-3">
                    {s.profileImageUrl ? (
                      <Image
                        src={s.profileImageUrl}
                        alt={s.accountName}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-full object-cover ring-2 ring-border"
                        unoptimized
                      />
                    ) : (
                      <div className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center",
                        PLATFORM_COLORS[s.platform] ?? "bg-muted"
                      )}>
                        <Icon className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{PLATFORM_LABELS[s.platform] ?? s.platform}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{s.accountName}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-1.5 shrink-0">
                      <Badge variant="secondary" className="text-[10px]">Bağlı</Badge>
                      <button
                        type="button"
                        onClick={() => handleRemoveAccount(s)}
                        disabled={isRemoving}
                        title="Hesabı kaldır"
                        aria-label={`${s.accountName} hesabını kaldır`}
                        className={cn(
                          "h-7 w-7 rounded-md inline-flex items-center justify-center",
                          "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
                          "transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                      >
                        {isRemoving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Token süresi:{" "}
                    <span className="text-foreground font-medium">
                      {s.tokenExpiresAt ? formatDate(new Date(s.tokenExpiresAt)) : "Süresiz"}
                    </span>
                  </div>
                </Card>
              );
            })}

            <a href={`/api/meta/oauth/start?clientId=${id}`} className="block">
              <Card className="p-4 border-dashed border-2 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all cursor-pointer min-h-[120px]">
                <Plus className="h-5 w-5" />
                <p className="text-sm font-medium">Meta Hesabı Bağla</p>
                <p className="text-[10px] text-muted-foreground">
                  Instagram &amp; Facebook için Meta OAuth akışı
                </p>
              </Card>
            </a>

            <a href={`/api/linkedin/oauth/start?clientId=${id}`} className="block">
              <Card className="p-4 border-dashed border-2 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-sky-500/50 hover:text-sky-600 hover:bg-sky-500/5 transition-all cursor-pointer min-h-[120px]">
                <Plus className="h-5 w-5" />
                <p className="text-sm font-medium">LinkedIn Hesabı Bağla</p>
                <p className="text-[10px] text-muted-foreground">
                  Kişisel profilde paylaşım (w_member_social)
                </p>
              </Card>
            </a>

            <a href={`/api/youtube/oauth/start?clientId=${id}`} className="block">
              <Card className="p-4 border-dashed border-2 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-red-500/50 hover:text-red-600 hover:bg-red-500/5 transition-all cursor-pointer min-h-[120px]">
                <Plus className="h-5 w-5" />
                <p className="text-sm font-medium">YouTube Kanalı Bağla</p>
                <p className="text-[10px] text-muted-foreground">
                  Video + Shorts yayınlama (youtube.upload scope)
                </p>
              </Card>
            </a>

            <a href={`/api/tiktok/oauth/start?clientId=${id}`} className="block">
              <Card className="p-4 border-dashed border-2 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-slate-600/50 hover:text-slate-700 hover:bg-slate-500/5 transition-all cursor-pointer min-h-[120px]">
                <Plus className="h-5 w-5" />
                <p className="text-sm font-medium">TikTok Hesabı Bağla</p>
                <p className="text-[10px] text-muted-foreground">
                  Content Posting API (app review gerekli)
                </p>
              </Card>
            </a>
          </div>
        </TabsContent>

        {/* Marka Ayarları tab */}
        <TabsContent value="ayarlar" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-2">Marka Sesi</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {client.brandVoice ?? "Henüz tanımlanmadı."}
              </p>
            </Card>
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-2">Revizyon Kotası</h3>
              <p className="text-2xl font-bold">{client.revisionQuota}</p>
              <p className="text-xs text-muted-foreground">revizyon hakkı / içerik</p>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* formatTRY referansı (tip uyarısı önle) — gelecekte fatura listesinde kullanılacak */}
      <span className="hidden">{formatTRY(0, "TRY")}</span>
    </div>
  );
}
