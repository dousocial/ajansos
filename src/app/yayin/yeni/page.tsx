/**
 * Yayın Planlama formu — onaylı projeden ScheduledPost(lar) yaratır.
 *
 * Akış:
 *  1. ?projectId=X ile geliyoruz (yayın planlayıcıdan)
 *  2. Proje bilgilerini, medyayı, brief'i çek
 *  3. Platform seçimi + her platform için caption/scheduledAt
 *  4. Sağda CANLI ÖNİZLEME (IG feed mockup, FB post mockup) — seçilen platforma göre
 *  5. "Planla" → POST /api/scheduled-posts
 *
 * Üretim kararları (caption variantları, hashtag) bu formdan ScheduledPost'a
 * yazılır; Project'in caption'ı bozulmaz.
 */

"use client";

import { useEffect, useMemo, useState, Suspense, KeyboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isPlatformSupported } from "@/lib/constants";
import {
  Camera,
  Globe2,
  Briefcase,
  Video as VideoIcon,
  PlaySquare,
  Loader2,
  ArrowLeft,
  Heart,
  MessageCircle,
  Send as SendIcon,
  Bookmark,
  MoreHorizontal,
  ThumbsUp,
  X,
  AlertCircle,
  Music,
  Eye,
  Repeat2,
  Play,
  Sparkles,
  Wand2,
} from "lucide-react";

type Platform = "INSTAGRAM" | "FACEBOOK" | "TIKTOK" | "LINKEDIN" | "YOUTUBE";

// `<input type="datetime-local" min>` UTC kabul etmiyor; yerel saat
// formatında YYYY-MM-DDTHH:mm string'i lazım. toISOString() UTC dönüyor,
// burada kullanılırsa kullanıcı yerel saatine göre yanlış min gösterilir.
function localNowForInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

interface ProjectData {
  id: string;
  title: string;
  status: string;
  postType: string;
  caption: string | null;
  hashtags: string[];
  client: { id: string; name: string; slug: string; logo: string | null };
  files: { id: string; publicUrl: string; mimeType: string; name: string }[];
}

interface PerPlatform {
  caption: string;
  hashtags: string[];
  scheduledAt: string; // datetime-local
}

const PLATFORMS: { key: Platform; label: string; Icon: React.ElementType }[] = [
  { key: "INSTAGRAM", label: "Instagram", Icon: Camera },
  { key: "FACEBOOK", label: "Facebook", Icon: Globe2 },
  { key: "TIKTOK", label: "TikTok", Icon: VideoIcon },
  { key: "LINKEDIN", label: "LinkedIn", Icon: Briefcase },
  { key: "YOUTUBE", label: "YouTube", Icon: PlaySquare },
];

export default function YayinYeniWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <YayinYeniPage />
    </Suspense>
  );
}

function YayinYeniPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const projectId = sp.get("projectId");

  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<Platform[]>([]);
  const [activePreview, setActivePreview] = useState<Platform>("INSTAGRAM");
  const [config, setConfig] = useState<Record<Platform, PerPlatform>>({
    INSTAGRAM: { caption: "", hashtags: [], scheduledAt: "" },
    FACEBOOK: { caption: "", hashtags: [], scheduledAt: "" },
    TIKTOK: { caption: "", hashtags: [], scheduledAt: "" },
    LINKEDIN: { caption: "", hashtags: [], scheduledAt: "" },
    YOUTUBE: { caption: "", hashtags: [], scheduledAt: "" },
  });
  const [hashtagInput, setHashtagInput] = useState("");

  // AI ile caption üretimi
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [aiPromptText, setAiPromptText] = useState("");
  const [aiPromptHint, setAiPromptHint] = useState("");

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    fetch(`/api/projects/${projectId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((j: { data: ProjectData }) => {
        setProject(j.data);
        // Project'in caption/hashtag'ini default olarak tüm platformlara basalım
        const defaultCaption = j.data.caption ?? "";
        const defaultTags = j.data.hashtags ?? [];
        setConfig((prev) => {
          const next = { ...prev };
          for (const k of Object.keys(next) as Platform[]) {
            next[k] = { ...next[k], caption: defaultCaption, hashtags: defaultTags };
          }
          return next;
        });
      })
      .catch(() => toast.error("Proje yüklenemedi"))
      .finally(() => setLoading(false));
  }, [projectId]);

  const togglePlatform = (p: Platform) => {
    if (!isPlatformSupported(p)) {
      toast.info("Bu platform için yayınlama yakında eklenecek");
      return;
    }
    setSelected((prev) => {
      const already = prev.includes(p);
      if (already) return prev.filter((x) => x !== p);
      return [...prev, p];
    });
    setActivePreview(p);
  };

  const setPlatformField = <K extends keyof PerPlatform>(
    p: Platform,
    key: K,
    value: PerPlatform[K]
  ) => {
    setConfig((prev) => ({ ...prev, [p]: { ...prev[p], [key]: value } }));
  };

  // AI ile caption üret. customPrompt verilmezse video projeler için backend
  // 200 + needsPrompt:true döner; o zaman üst kullanıcıdan prompt isteriz.
  async function generateCaption(customPrompt?: string) {
    if (!project) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/caption/from-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          platform: activePreview,
          ...(customPrompt && customPrompt.trim() ? { customPrompt: customPrompt.trim() } : {}),
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | {
            caption?: string;
            hashtags?: string[];
            needsPrompt?: boolean;
            message?: string;
            error?: string;
          }
        | null;

      if (data?.needsPrompt) {
        // Video / medyasız: kullanıcıdan açıklama iste
        setAiPromptHint(data.message ?? "AI'ın yazabilmesi için kısa bir açıklama gir.");
        setShowAiPrompt(true);
        return;
      }

      if (!res.ok || !data?.caption) {
        // 429 (kota aşıldı / kredi bitti) için daha açıklayıcı mesaj
        if (res.status === 429 || /429|quota|prepayment|credits/i.test(data?.error ?? "")) {
          throw new Error(
            "Gemini kotası dolu. AI Studio → Billing'den kredi yükle veya farklı bir API anahtarı dene."
          );
        }
        throw new Error(data?.error ?? "AI üretim başarısız");
      }

      // Caption'ı yerleştir; hashtag varsa mevcutlara ekle (duplicate önle)
      setPlatformField(activePreview, "caption", data.caption);
      if (data.hashtags && data.hashtags.length > 0) {
        const cur = config[activePreview].hashtags;
        const merged = [...cur];
        for (const t of data.hashtags) {
          if (!merged.includes(t)) merged.push(t);
        }
        setPlatformField(activePreview, "hashtags", merged);
      }
      setShowAiPrompt(false);
      setAiPromptText("");
      toast.success("Caption AI ile üretildi");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI hatası");
    } finally {
      setAiLoading(false);
    }
  }

  const addHashtagToActive = () => {
    const raw = hashtagInput.trim();
    if (!raw) return;
    const tag = raw.startsWith("#") ? raw : `#${raw}`;
    const cur = config[activePreview].hashtags;
    if (!cur.includes(tag)) setPlatformField(activePreview, "hashtags", [...cur, tag]);
    setHashtagInput("");
  };

  const removeHashtagFromActive = (tag: string) => {
    setPlatformField(
      activePreview,
      "hashtags",
      config[activePreview].hashtags.filter((t) => t !== tag)
    );
  };

  // Backend (POST /api/scheduled-posts) medyasız projeyi 422 ile reddediyor —
  // butonları önceden disable etmek için bunu burada hesaplıyoruz.
  const hasMedia = (project?.files?.length ?? 0) > 0;

  /**
   * `mode`:
   *  - "scheduled": her platform için form'daki scheduledAt kullanılır,
   *    cron ileri tarihte yayınlar.
   *  - "now": scheduledAt new Date() yapılır, ScheduledPost yaratıldıktan
   *    sonra her biri için /api/meta/post tetiklenir → cron beklemez.
   *    Atomic-claim sayesinde cron aynı anda gelse bile çift yayın olmaz.
   */
  async function submit(mode: "scheduled" | "now") {
    if (!project) return;
    if (selected.length === 0) {
      toast.error("En az bir platform seçin");
      return;
    }
    if (!hasMedia) {
      toast.error("Bu projede medya yok — önce medya ekle");
      return;
    }
    if (mode === "scheduled") {
      const missing = selected.filter((p) => !config[p].scheduledAt);
      if (missing.length > 0) {
        toast.error(`Yayın tarihi eksik: ${missing.join(", ")}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const posts = selected.map((p) => ({
        platform: p,
        caption: config[p].caption,
        hashtags: config[p].hashtags,
        scheduledAt:
          mode === "now"
            ? nowIso
            : new Date(config[p].scheduledAt).toISOString(),
      }));
      const res = await fetch("/api/scheduled-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, posts }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        data?: { id: string; platform: string }[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Planlama başarısız");
      }

      if (mode === "scheduled") {
        toast.success(`${posts.length} platform için yayın planlandı`);
        router.push("/yayin");
        router.refresh();
        return;
      }

      // mode === "now": her ScheduledPost için publish'i paralel tetikle
      const created = data.data ?? [];
      toast.info(`${created.length} platform yayınlanıyor...`);
      const results = await Promise.all(
        created.map(async (c) => {
          try {
            const r = await fetch("/api/meta/post", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ scheduledPostId: c.id }),
            });
            const j = (await r.json().catch(() => ({}))) as {
              ok?: boolean;
              error?: string;
            };
            return { platform: c.platform, ok: !!j.ok, error: j.error };
          } catch (e) {
            return {
              platform: c.platform,
              ok: false,
              error: e instanceof Error ? e.message : "Bilinmeyen hata",
            };
          }
        })
      );
      for (const r of results) {
        if (r.ok) toast.success(`${r.platform}: yayınlandı`);
        else toast.error(`${r.platform}: ${r.error ?? "yayınlanamadı"}`);
      }
      router.push("/yayin");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hata");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  // projectId verilmediyse: yayına hazır proje seçici göster.
  // /yayin'deki "Yayına Hazır" listesiyle aynı mantık ama tek amaçlı bir
  // arayüzle (kart ızgarası → tıklayınca ?projectId=X ile geri gel).
  if (!projectId) {
    return <ProjectPicker />;
  }
  if (!project) {
    return (
      <div className="space-y-3">
        <Link
          href="/yayin"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Yayın Planlayıcı
        </Link>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Proje bulunamadı veya yayına uygun değil.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Üst bar */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/yayin"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"
          >
            <ArrowLeft className="h-3 w-3" /> Yayın Planlayıcı
          </Link>
          <h1 className="text-xl font-bold">{project.title}</h1>
          <p className="text-xs text-muted-foreground">
            {project.client.name} · {project.postType}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => submit("now")}
            disabled={submitting || selected.length === 0 || !hasMedia}
            title={
              !hasMedia
                ? "Bu projede medya yok — gönderim için medya gerekli"
                : "Seçili platformlara hemen gönder"
            }
            className={cn(
              buttonVariants({ variant: "default" }),
              "bg-primary text-white hover:bg-primary/90"
            )}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Şimdi Paylaş ({selected.length})
          </button>
          <button
            type="button"
            onClick={() => submit("scheduled")}
            disabled={
              submitting ||
              selected.length === 0 ||
              !hasMedia ||
              selected.some((p) => !config[p].scheduledAt)
            }
            title={
              !hasMedia
                ? "Bu projede medya yok"
                : selected.some((p) => !config[p].scheduledAt)
                  ? "Her platform için yayın tarihi & saati seçin"
                  : "Cron ileri tarihte yayınlasın"
            }
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Planla
          </button>
        </div>
      </div>

      {!hasMedia && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="font-medium">Bu projede medya yok</div>
            <div className="text-xs">
              Yayın için en az bir görsel/video gerekli.{" "}
              <Link
                href={`/icerikler/${project.id}`}
                className="underline font-medium"
              >
                Üretim sayfasından medya ekle
              </Link>
              .
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
        {/* Sol: konfigürasyon (3/5) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Platform seçimi */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Hangi platformlara?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {PLATFORMS.map(({ key, label, Icon }) => {
                  const active = selected.includes(key);
                  const supported = isPlatformSupported(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => togglePlatform(key)}
                      disabled={!supported}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-xs font-medium transition-colors",
                        !supported
                          ? "border-border bg-muted/30 text-muted-foreground/50 cursor-not-allowed"
                          : active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/40"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      {label}
                      {!supported && (
                        <span className="text-[9px] uppercase">Yakında</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Aktif platform tab'ları (caption/scheduledAt için) */}
          {selected.length > 0 && (
            <Card>
              <CardHeader className="pb-2 border-b">
                <div className="flex items-center gap-1 -mx-1 -my-1 overflow-x-auto">
                  {selected.map((p) => {
                    const cfg = PLATFORMS.find((x) => x.key === p)!;
                    const active = activePreview === p;
                    const Icon = cfg.Icon;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setActivePreview(p)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                          active
                            ? "bg-primary text-white"
                            : "text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {/* AI ile Üret — Caption'ın üstünde */}
                <div className="flex items-center justify-between gap-2 -mb-1">
                  <button
                    type="button"
                    onClick={() => generateCaption()}
                    disabled={aiLoading}
                    style={{ backgroundColor: "var(--primary)", color: "#fff" }}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold",
                      "shadow-sm hover:opacity-90 transition-all",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                    title="Görseli (veya prompt'u) Gemini AI ile analiz edip caption üret"
                  >
                    {aiLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="h-3.5 w-3.5" />
                    )}
                    AI ile Üret
                  </button>
                  <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Gemini · markaya özel
                  </span>
                </div>

                {/* AI prompt — video / medyasız durumlarda açılır */}
                {showAiPrompt && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="flex-1 text-xs text-foreground">
                        <p className="font-semibold">AI için kısa bilgi gir</p>
                        <p className="text-muted-foreground mt-0.5">{aiPromptHint}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAiPrompt(false);
                          setAiPromptText("");
                        }}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Kapat"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Textarea
                      rows={3}
                      placeholder="Örn: Bu video anneler günü tanıtımıyla alakalı eğlenceli bir video, sıcak ve duygusal bir açıklama yaz."
                      value={aiPromptText}
                      onChange={(e) => setAiPromptText(e.target.value)}
                      className="text-sm bg-card"
                      autoFocus
                    />
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAiPrompt(false);
                          setAiPromptText("");
                        }}
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "sm" }),
                          "h-7 text-xs"
                        )}
                      >
                        İptal
                      </button>
                      <button
                        type="button"
                        onClick={() => generateCaption(aiPromptText)}
                        disabled={aiLoading || !aiPromptText.trim()}
                        className={cn(
                          buttonVariants({ size: "sm" }),
                          "h-7 gap-1 text-xs bg-primary text-white hover:bg-primary/90"
                        )}
                      >
                        {aiLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Wand2 className="h-3 w-3" />
                        )}
                        Üret
                      </button>
                    </div>
                  </div>
                )}

                {/* Caption */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="caption-input">Caption ({activePreview})</Label>
                    <span className="text-xs text-muted-foreground">
                      {config[activePreview].caption.length}/2200
                    </span>
                  </div>
                  <Textarea
                    id="caption-input"
                    rows={5}
                    maxLength={2200}
                    placeholder="Bu platform için açıklama..."
                    value={config[activePreview].caption}
                    onChange={(e) =>
                      setPlatformField(activePreview, "caption", e.target.value)
                    }
                  />
                </div>

                {/* Hashtag */}
                <div className="space-y-1.5">
                  <Label htmlFor="ht-input">Hashtag&apos;ler</Label>
                  <Input
                    id="ht-input"
                    placeholder="#örnek yazıp Enter'a basın"
                    value={hashtagInput}
                    onChange={(e) => setHashtagInput(e.target.value)}
                    onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addHashtagToActive();
                      }
                    }}
                    onBlur={addHashtagToActive}
                  />
                  {config[activePreview].hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {config[activePreview].hashtags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeHashtagFromActive(tag)}
                            className="hover:text-destructive"
                            aria-label={`${tag} kaldır`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Yayın tarihi */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sched-input">
                      Yayın Tarihi & Saati ({activePreview})
                    </Label>
                    {selected.length > 1 && config[activePreview].scheduledAt && (
                      <button
                        type="button"
                        onClick={() => {
                          const v = config[activePreview].scheduledAt;
                          setConfig((prev) => {
                            const next = { ...prev };
                            for (const k of selected) {
                              next[k] = { ...next[k], scheduledAt: v };
                            }
                            return next;
                          });
                          toast.success("Tüm platformlara uygulandı");
                        }}
                        className="text-[11px] text-primary hover:underline font-medium"
                      >
                        ↳ Tümüne uygula
                      </button>
                    )}
                  </div>
                  <Input
                    id="sched-input"
                    type="datetime-local"
                    // Geçmiş tarih seçimini engellemek için min: şu an. Native
                    // input bunu görsel olarak gri yapar; backend'e geçse bile
                    // submit anında ayrıca uyarı veriyoruz.
                    min={localNowForInput()}
                    value={config[activePreview].scheduledAt}
                    onChange={(e) =>
                      setPlatformField(activePreview, "scheduledAt", e.target.value)
                    }
                  />
                  {config[activePreview].scheduledAt &&
                    new Date(config[activePreview].scheduledAt).getTime() <
                      Date.now() && (
                      <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                        ⚠ Bu tarih geçmişte. Planlarsan cron ilk kontrolde
                        hemen yayınlamayı dener.
                      </p>
                    )}
                  <p className="text-[11px] text-muted-foreground">
                    Cron her 5 dk'da bir kontrol ediyor — en kötü gecikme 5 dakika.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sağ: önizleme (2/5) */}
        <div className="lg:col-span-2 lg:sticky lg:top-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Önizleme</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {activePreview}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PostPreview
                platform={activePreview}
                caption={config[activePreview].caption}
                hashtags={config[activePreview].hashtags}
                files={project.files}
                client={project.client}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Önizleme bileşenleri ────────────────────────────────────────────────────

function PostPreview({
  platform,
  caption,
  hashtags,
  files,
  client,
}: {
  platform: Platform;
  caption: string;
  hashtags: string[];
  files: { id: string; publicUrl: string; mimeType: string; name: string }[];
  client: { name: string; slug: string; logo: string | null };
}) {
  const fullCaption = useMemo(() => {
    const parts = [caption.trim(), hashtags.join(" ")].filter(Boolean);
    return parts.join("\n\n");
  }, [caption, hashtags]);

  if (platform === "INSTAGRAM") {
    return <InstagramPreview caption={fullCaption} files={files} client={client} />;
  }
  if (platform === "FACEBOOK") {
    return <FacebookPreview caption={fullCaption} files={files} client={client} />;
  }
  if (platform === "LINKEDIN") {
    return <LinkedInPreview caption={fullCaption} files={files} client={client} />;
  }
  if (platform === "YOUTUBE") {
    return <YouTubePreview caption={fullCaption} files={files} client={client} />;
  }
  if (platform === "TIKTOK") {
    return <TikTokPreview caption={fullCaption} files={files} client={client} />;
  }
  return (
    <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
      {platform} için önizleme henüz hazır değil.
    </div>
  );
}

function InstagramPreview({
  caption,
  files,
  client,
}: {
  caption: string;
  files: { id: string; publicUrl: string; mimeType: string }[];
  client: { name: string; slug: string; logo: string | null };
}) {
  const firstImage = files.find((f) => f.mimeType.startsWith("image/"));
  const firstVideo = files.find((f) => f.mimeType.startsWith("video/"));
  const handle = client.slug || client.name.toLowerCase().replace(/\s+/g, "");

  // İlk satır + devamı (IG "more" davranışı)
  const lines = caption.split("\n");
  const preview = lines.slice(0, 2).join("\n");
  const hasMore = caption.length > 125 || lines.length > 2;

  return (
    <div className="rounded-xl border bg-white text-black shadow-sm overflow-hidden max-w-sm mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[2px]">
          <div className="h-full w-full rounded-full bg-white p-[2px]">
            {client.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={client.logo}
                alt={client.name}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <div className="h-full w-full rounded-full bg-gradient-to-tr from-pink-400 to-orange-300" />
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold truncate">{handle}</div>
        </div>
        <MoreHorizontal className="h-4 w-4" />
      </div>

      {/* Media */}
      <div className="aspect-square bg-neutral-100 relative">
        {firstImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={firstImage.publicUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : firstVideo ? (
          <video
            src={firstVideo.publicUrl}
            className="h-full w-full object-cover"
            muted
            playsInline
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-neutral-400">
            medya yok
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 px-3 py-2">
        <Heart className="h-5 w-5" />
        <MessageCircle className="h-5 w-5" />
        <SendIcon className="h-5 w-5" />
        <Bookmark className="h-5 w-5 ml-auto" />
      </div>

      {/* Caption */}
      <div className="px-3 pb-3 text-[13px] leading-tight">
        {caption ? (
          <>
            <span className="font-semibold mr-1.5">{handle}</span>
            <span className="whitespace-pre-wrap">{preview}</span>
            {hasMore && <span className="text-neutral-500"> ... daha fazla</span>}
          </>
        ) : (
          <span className="text-neutral-400 italic">Caption yok</span>
        )}
      </div>
    </div>
  );
}

function FacebookPreview({
  caption,
  files,
  client,
}: {
  caption: string;
  files: { id: string; publicUrl: string; mimeType: string }[];
  client: { name: string; slug: string; logo: string | null };
}) {
  const firstImage = files.find((f) => f.mimeType.startsWith("image/"));
  const firstVideo = files.find((f) => f.mimeType.startsWith("video/"));

  return (
    <div className="rounded-xl border bg-white text-black shadow-sm overflow-hidden max-w-sm mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="h-10 w-10 rounded-full overflow-hidden bg-blue-100 shrink-0">
          {client.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={client.logo}
              alt={client.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-sm font-bold">
              {client.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{client.name}</div>
          <div className="text-[11px] text-neutral-500">Şimdi · 🌐</div>
        </div>
        <MoreHorizontal className="h-4 w-4" />
      </div>

      {/* Caption */}
      {caption && (
        <div className="px-3 pb-2 text-[13px] whitespace-pre-wrap leading-snug">
          {caption}
        </div>
      )}

      {/* Media */}
      <div className="bg-neutral-100 relative aspect-[4/3]">
        {firstImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={firstImage.publicUrl} alt="" className="h-full w-full object-cover" />
        ) : firstVideo ? (
          <video
            src={firstVideo.publicUrl}
            className="h-full w-full object-cover"
            muted
            playsInline
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-neutral-400">
            medya yok
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-3 py-2 border-t text-neutral-600 text-xs">
        <ThumbsUp className="h-4 w-4" /> Beğen
        <MessageCircle className="h-4 w-4 ml-3" /> Yorum
        <SendIcon className="h-4 w-4 ml-3" /> Paylaş
      </div>
    </div>
  );
}

function LinkedInPreview({
  caption,
  files,
  client,
}: {
  caption: string;
  files: { id: string; publicUrl: string; mimeType: string }[];
  client: { name: string; slug: string; logo: string | null };
}) {
  const firstImage = files.find((f) => f.mimeType.startsWith("image/"));
  const firstVideo = files.find((f) => f.mimeType.startsWith("video/"));
  // LinkedIn caption ~140 char "see more" davranışı
  const lines = caption.split("\n");
  const preview = caption.length > 200 ? caption.slice(0, 200) : caption;
  const hasMore = caption.length > 200 || lines.length > 3;

  return (
    <div className="rounded-lg border bg-white text-black shadow-sm overflow-hidden max-w-sm mx-auto">
      <div className="flex items-start gap-2 px-3 py-3">
        <div className="h-12 w-12 rounded-full overflow-hidden bg-blue-100 shrink-0">
          {client.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={client.logo} alt={client.name} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-blue-700 to-blue-900 flex items-center justify-center text-white text-base font-bold">
              {client.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{client.name}</div>
          <div className="text-[11px] text-neutral-500 truncate">Şirket · Takipçi</div>
          <div className="text-[11px] text-neutral-500">Şimdi · 🌐</div>
        </div>
        <MoreHorizontal className="h-4 w-4 text-neutral-500" />
      </div>
      {caption && (
        <div className="px-3 pb-2 text-[13px] whitespace-pre-wrap leading-snug">
          {preview}
          {hasMore && <span className="text-neutral-500"> ...daha fazla</span>}
        </div>
      )}
      {(firstImage || firstVideo) && (
        <div className="bg-neutral-100 relative aspect-[1.91/1]">
          {firstImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={firstImage.publicUrl} alt="" className="h-full w-full object-cover" />
          ) : firstVideo ? (
            <video src={firstVideo.publicUrl} className="h-full w-full object-cover" muted playsInline />
          ) : null}
        </div>
      )}
      <div className="flex items-center justify-around px-2 py-1.5 border-t text-neutral-600 text-[11px]">
        <span className="flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" /> Beğen</span>
        <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> Yorum</span>
        <span className="flex items-center gap-1"><Repeat2 className="h-3.5 w-3.5" /> Yeniden Yayınla</span>
        <span className="flex items-center gap-1"><SendIcon className="h-3.5 w-3.5" /> Gönder</span>
      </div>
    </div>
  );
}

function YouTubePreview({
  caption,
  files,
  client,
}: {
  caption: string;
  files: { id: string; publicUrl: string; mimeType: string }[];
  client: { name: string; slug: string; logo: string | null };
}) {
  const firstVideo = files.find((f) => f.mimeType.startsWith("video/"));
  const firstImage = files.find((f) => f.mimeType.startsWith("image/"));
  // YouTube açıklaması ilk 3 satır gösterilir, başlık caption'ın ilk satırı.
  const lines = caption.split("\n");
  const title = lines[0] || "Başlıksız video";
  const description = lines.slice(1).join("\n");

  return (
    <div className="rounded-lg border bg-white text-black shadow-sm overflow-hidden max-w-sm mx-auto">
      {/* Thumbnail / video */}
      <div className="bg-black relative aspect-video">
        {firstVideo ? (
          <video src={firstVideo.publicUrl} className="h-full w-full object-cover" muted playsInline />
        ) : firstImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={firstImage.publicUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">
            video yok
          </div>
        )}
        {firstVideo && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-12 w-12 rounded-full bg-black/50 flex items-center justify-center">
              <Play className="h-6 w-6 text-white fill-white ml-0.5" />
            </div>
          </div>
        )}
      </div>
      {/* Title + meta */}
      <div className="flex items-start gap-2 p-3">
        <div className="h-9 w-9 rounded-full overflow-hidden bg-red-100 shrink-0">
          {client.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={client.logo} alt={client.name} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-sm font-bold">
              {client.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold leading-snug line-clamp-2">{title}</div>
          <div className="text-[11px] text-neutral-500 mt-0.5">{client.name}</div>
          <div className="text-[11px] text-neutral-500 flex items-center gap-2">
            <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" /> 0 görüntüleme</span>
            <span>· şimdi</span>
          </div>
          {description && (
            <div className="text-[12px] text-neutral-700 mt-1.5 whitespace-pre-wrap line-clamp-2">
              {description}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TikTokPreview({
  caption,
  files,
  client,
}: {
  caption: string;
  files: { id: string; publicUrl: string; mimeType: string }[];
  client: { name: string; slug: string; logo: string | null };
}) {
  const firstVideo = files.find((f) => f.mimeType.startsWith("video/"));
  const firstImage = files.find((f) => f.mimeType.startsWith("image/"));
  const handle = client.slug || client.name.toLowerCase().replace(/\s+/g, "");

  return (
    <div className="rounded-xl bg-black text-white shadow-sm overflow-hidden max-w-[280px] mx-auto relative aspect-[9/16]">
      {/* Media — full bleed */}
      {firstVideo ? (
        <video src={firstVideo.publicUrl} className="absolute inset-0 h-full w-full object-cover" muted playsInline />
      ) : firstImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={firstImage.publicUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-400">
          video yok
        </div>
      )}
      {/* Gradient alt */}
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 to-transparent" />
      {/* Sağ aksiyon kolonu */}
      <div className="absolute right-2 bottom-16 flex flex-col items-center gap-3 text-white">
        <div className="h-10 w-10 rounded-full overflow-hidden border-2 border-white bg-pink-300">
          {client.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={client.logo} alt={client.name} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-pink-500 to-cyan-400 flex items-center justify-center text-xs font-bold">
              {client.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex flex-col items-center"><Heart className="h-6 w-6" /><span className="text-[10px]">0</span></div>
        <div className="flex flex-col items-center"><MessageCircle className="h-6 w-6" /><span className="text-[10px]">0</span></div>
        <div className="flex flex-col items-center"><SendIcon className="h-6 w-6" /><span className="text-[10px]">Paylaş</span></div>
      </div>
      {/* Alt caption */}
      <div className="absolute inset-x-0 bottom-0 p-3 pr-14">
        <div className="text-sm font-semibold mb-0.5">@{handle}</div>
        <div className="text-[12px] whitespace-pre-wrap leading-snug line-clamp-3">
          {caption || <span className="italic text-white/60">Caption yok</span>}
        </div>
        <div className="flex items-center gap-1 mt-1.5 text-[11px]">
          <Music className="h-3 w-3" />
          <span className="truncate">orijinal ses · {client.name}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Proje Seçici ───────────────────────────────────────────────────────────
// /yayin/yeni'ye projectId olmadan gelindiğinde gösterilir. APPROVED ve
// henüz ScheduledPost'u olmayan projeleri listeler — kart tıklanınca aynı
// sayfaya ?projectId=X ile dönüş yapar ve form moduna geçilir.
interface PickerProject {
  id: string;
  title: string;
  postType: string;
  client: { id: string; name: string };
  files: { publicUrl: string; mimeType: string }[];
}

function ProjectPicker() {
  const [projects, setProjects] = useState<PickerProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/projects?limit=100&status=APPROVED&includeQuickPublish=1").then((r) => r.json()),
      fetch("/api/scheduled-posts").then((r) => r.json()),
    ])
      .then(
        ([proj, sched]: [
          { data?: PickerProject[] },
          { data?: { project: { id: string } }[] },
        ]) => {
          const taken = new Set((sched.data ?? []).map((s) => s.project.id));
          setProjects((proj.data ?? []).filter((p) => !taken.has(p.id)));
        }
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/yayin"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"
        >
          <ArrowLeft className="h-3 w-3" /> Yayın Planlayıcı
        </Link>
        <h1 className="text-xl font-bold">Yayınlanacak İçeriği Seç</h1>
        <p className="text-sm text-muted-foreground">
          Üretimi onaylanmış (APPROVED) projeler. Birini seçip platform/zaman
          ayarlayarak yayın oluşturabilirsin.
        </p>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Yayına hazır proje yok.
            </p>
            <p className="text-xs text-muted-foreground">
              <Link href="/yayin/hizli" className="text-primary underline">
                Hızlı Yayın
              </Link>{" "}
              ile üretim kaydı olmadan doğrudan yayın oluşturabilir, ya da{" "}
              <Link href="/icerikler/yeni" className="text-primary underline">
                yeni bir üretim
              </Link>{" "}
              açıp APPROVED'a getirebilirsin.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects.map((p) => {
            const thumb = p.files.find((f) => f.mimeType.startsWith("image/"));
            return (
              <Link
                key={p.id}
                href={`/yayin/yeni?projectId=${p.id}`}
                className="group rounded-xl border bg-card hover:border-primary hover:shadow-sm transition-all overflow-hidden"
              >
                <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb.publicUrl}
                      alt={p.title}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground text-xs">
                      medya yok
                    </div>
                  )}
                  <div className="absolute top-2 right-2 rounded-md bg-background/90 backdrop-blur px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                    {p.postType}
                  </div>
                </div>
                <div className="p-3 space-y-1">
                  <div className="text-xs text-muted-foreground">
                    {p.client.name}
                  </div>
                  <div className="text-sm font-medium line-clamp-1 group-hover:text-primary">
                    {p.title}
                  </div>
                  <div className="flex items-center gap-1 pt-1 text-[11px] text-primary font-medium">
                    Yayına Hazırla →
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
