"use client";

import { useState, useEffect, useCallback } from "react";
import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatDate } from "@/lib/utils";
import { STATUS_LABELS, STATUS_COLORS, PIPELINE_ORDER } from "@/lib/constants";
import {
  ArrowLeft, Sparkles, Upload, CheckCircle2,
  RotateCcw, Clock, Hash, Loader2, Copy, RefreshCw, AlertCircle, Save, Send,
} from "lucide-react";

interface ProjectDetail {
  id: string;
  title: string;
  status: string;
  platforms: string[];
  postType: string;
  brief: string | null;
  caption: string | null;
  hashtags: string[];
  publishAt: string | null;
  shootDate: string | null;
  client: {
    id: string;
    name: string;
    slug: string;
    brandVoice: string | null;
  };
  scheduledPosts?: {
    id: string;
    platform: string;
    scheduledAt: string;
    status: string;
  }[];
  files?: {
    id: string;
    name: string;
    mimeType: string;
    publicUrl: string;
    sizeBytes: number;
  }[];
}

function PipelineBar({ current }: { current: string }) {
  const idx = PIPELINE_ORDER.indexOf(current);
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1">
      {PIPELINE_ORDER.map((step, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={step} className="flex items-center shrink-0">
            <div className={cn(
              "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors",
              active ? "bg-primary text-white" : done ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
            )}>
              {done && <CheckCircle2 className="h-3 w-3" />}
              {active && <Clock className="h-3 w-3" />}
              {STATUS_LABELS[step]}
            </div>
            {i < PIPELINE_ORDER.length - 1 && (
              <div className={cn("h-px w-3 shrink-0", done ? "bg-emerald-300" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function AICaptionPanel({
  brief,
  brandVoice,
  platform,
  postType,
  onUse,
}: {
  brief: string;
  brandVoice: string;
  platform: string;
  postType: string;
  onUse: (text: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [suggestions, setSuggestions] = useState<{ tone: string; text: string; tags: string[] }[]>([]);
  const [streamText, setStreamText] = useState("");

  async function generate() {
    if (!brief.trim()) {
      toast.error("Öneri üretmek için önce brief girilmeli.");
      return;
    }
    setLoading(true);
    setStreaming(true);
    setStreamText("");
    setSuggestions([]);

    try {
      const res = await fetch("/api/ai/caption/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief,
          platform,
          postType,
          brandVoice: brandVoice || "profesyonel ve samimi",
          tones: ["Eğlenceli", "İlham Verici", "Profesyonel"],
        }),
      });

      if (!res.ok || !res.body) throw new Error("AI servisi cevap vermedi");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") break;
          try {
            const event = JSON.parse(raw);
            if (event.type === "chunk") setStreamText((p) => p + event.content);
            if (event.type === "done") {
              setSuggestions(event.suggestions ?? []);
              setStreamText("");
            }
            if (event.type === "tone_error") {
              // Tek ton başarısız — kullanıcıya sessiz bildirim yeterli
              toast.warning(
                `"${event.tone}" önerisi üretilemedi${event.message ? `: ${event.message}` : ""}`
              );
            }
            if (event.type === "error") {
              // Stream kapanmadan önce fatal hata — kullanıcıyı bilgilendir
              toast.error(event.message ?? "AI şu an kullanılamıyor");
              setStreamText("");
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI şu an kullanılamıyor");
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">AI Caption Asistanı</span>
          <Badge className="text-[10px] bg-primary/10 text-primary border-0">Beta</Badge>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className={cn(
            buttonVariants({ size: "sm" }),
            "gap-1.5 bg-primary text-white hover:bg-primary/90 text-xs h-7"
          )}
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {loading ? "Üretiliyor..." : "Üret"}
        </button>
      </div>

      {streaming && streamText && (
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm whitespace-pre-wrap streaming-cursor">
          {streamText}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-2">
          {suggestions.map((s, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Badge className="text-[10px] bg-muted text-muted-foreground border-0">{s.tone}</Badge>
                <div className="flex gap-1">
                  <button
                    onClick={() => navigator.clipboard?.writeText(s.text)}
                    className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    title="Kopyala"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => onUse(s.text)}
                    className="h-6 px-2 rounded bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-medium transition-colors"
                  >
                    Kullan
                  </button>
                </div>
              </div>
              <p className="text-xs text-foreground whitespace-pre-wrap">{s.text}</p>
              <div className="flex flex-wrap gap-1">
                {s.tags.map((t) => (
                  <span key={t} className="text-[10px] text-primary bg-primary/10 rounded px-1.5 py-0.5">{t}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {suggestions.length === 0 && !loading && (
        <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4 text-center">
          <Sparkles className="mx-auto h-5 w-5 text-primary/50 mb-1" />
          <p className="text-xs text-muted-foreground">Brief&apos;e göre 3 farklı ton önerisi üretilecek</p>
        </div>
      )}
    </div>
  );
}

export default function IcerikDetayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [caption, setCaption] = useState("");
  const [savingCaption, setSavingCaption] = useState(false);
  const [statusAction, setStatusAction] = useState<null | "INTERNAL_REVIEW" | "EDITING">(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}`, { cache: "no-store" });
      if (res.status === 404) {
        setError("İçerik bulunamadı");
        setProject(null);
        return;
      }
      if (!res.ok) throw new Error("İçerik yüklenemedi");
      const json = (await res.json()) as { data: ProjectDetail };
      setProject(json.data);
      setCaption(json.data.caption ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveCaption() {
    if (!project) return;
    setSavingCaption(true);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Caption kaydedilemedi");
      }
      toast.success("Caption kaydedildi");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setSavingCaption(false);
    }
  }

  async function publishNow(scheduledPostId: string) {
    setPublishingId(scheduledPostId);
    try {
      const res = await fetch("/api/meta/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledPostId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        externalId?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `Yayın başarısız (HTTP ${res.status})`);
      }
      toast.success(
        `Yayınlandı${data.externalId ? ` · ID: ${data.externalId}` : ""}`
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bilinmeyen yayın hatası");
    } finally {
      setPublishingId(null);
    }
  }

  async function changeStatus(status: "INTERNAL_REVIEW" | "EDITING") {
    setStatusAction(status);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Durum güncellenemedi");
      }
      toast.success(
        status === "INTERNAL_REVIEW" ? "İç onaya gönderildi" : "Revizyon için geri alındı"
      );
      await load();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setStatusAction(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-5 max-w-5xl">
        <Link href="/icerikler" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5 -ml-2")}>
          <ArrowLeft className="h-3.5 w-3.5" /> İçerikler
        </Link>
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          İçerik yükleniyor…
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="space-y-5 max-w-5xl">
        <Link href="/icerikler" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5 -ml-2")}>
          <ArrowLeft className="h-3.5 w-3.5" /> İçerikler
        </Link>
        <Card className="p-10 text-center text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
          <p className="font-medium">{error ?? "İçerik bulunamadı"}</p>
        </Card>
      </div>
    );
  }

  const primaryPlatform = project.platforms[0] ?? "INSTAGRAM";
  const publishAtLabel = project.publishAt
    ? formatDate(new Date(project.publishAt))
    : "—";
  const captionDirty = caption !== (project.caption ?? "");

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Geri + Başlık */}
      <div className="flex items-center gap-3">
        <Link href="/icerikler" className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{project.title}</h1>
          <p className="text-sm text-muted-foreground">{project.client.name}</p>
        </div>
        <Badge className={cn("text-xs border-0 font-medium", STATUS_COLORS[project.status])}>
          {STATUS_LABELS[project.status]}
        </Badge>
        {/* Üretim bittiğinde Yayın Planlayıcı'ya köprü. APPROVED ve sonrası
            (LIVE/PUBLISHED dahil) Project ScheduledPost'a aday — yayın
            henüz konfigüre edilmediyse oradan eklenir, edilmişse yine
            ScheduledPost listesi görülebilir. */}
        {(project.status === "APPROVED" ||
          project.status === "LIVE" ||
          project.status === "PUBLISHED") && (
          <Link
            href={`/yayin/yeni?projectId=${project.id}`}
            className={cn(
              buttonVariants({ variant: "default", size: "sm" }),
              "gap-1.5 shrink-0"
            )}
          >
            <Send className="h-3.5 w-3.5" /> Yayına Hazırla
          </Link>
        )}
      </div>

      {/* Pipeline bar */}
      <PipelineBar current={project.status} />

      {/* 2 sütun layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Sol — ana içerik */}
        <div className="lg:col-span-3 space-y-4">
          {/* Brief */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">Brief &amp; Yön</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {project.brief || "Brief henüz eklenmedi."}
              </p>
            </CardContent>
          </Card>

          {/* Medya dosyaları — /yeni'de yüklenenler buradan görüntülenir.
              Detay üzerinden ekleme/silme henüz yok; ScheduledPost.mediaUrls
              snapshot'ı oluştuğu için sonradan değişim ayrı bir senkron PR'da. */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Upload className="h-4 w-4" /> Medya Dosyaları
                {project.files && project.files.length > 0 && (
                  <span className="text-xs text-muted-foreground font-normal">
                    ({project.files.length})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {project.files && project.files.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {project.files.map((f) => {
                    const isVideo = f.mimeType.startsWith("video/");
                    return (
                      <div
                        key={f.id}
                        className="relative aspect-square overflow-hidden rounded-md border bg-muted"
                      >
                        {isVideo ? (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground text-xs">
                            {f.name}
                          </div>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={f.publicUrl}
                            alt={f.name}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Medya yok.</p>
              )}
            </CardContent>
          </Card>

          {/* Caption */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>Caption</span>
                {captionDirty && (
                  <button
                    onClick={saveCaption}
                    disabled={savingCaption}
                    className={cn(
                      buttonVariants({ size: "sm", variant: "default" }),
                      "gap-1.5 h-7 text-xs bg-primary text-white hover:bg-primary/90"
                    )}
                  >
                    {savingCaption ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Save className="h-3 w-3" />
                    )}
                    {savingCaption ? "Kaydediliyor…" : "Kaydet"}
                  </button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="min-h-[120px] text-sm resize-none"
                placeholder="Caption yazın..."
              />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{caption.length} / 2200 karakter</span>
                <button
                  onClick={() => setCaption(project.caption ?? "")}
                  disabled={!captionDirty}
                  className="flex items-center gap-1 hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RefreshCw className="h-3 w-3" /> Sıfırla
                </button>
              </div>
              {/* Hashtag'ler */}
              <div>
                <div className="flex items-center gap-1 mb-2">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Hashtag&apos;ler</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {project.hashtags.length === 0 && (
                    <span className="text-xs text-muted-foreground">Hashtag yok.</span>
                  )}
                  {project.hashtags.map((tag) => (
                    <span key={tag} className="text-xs bg-primary/10 text-primary rounded-md px-2 py-1">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sağ — AI + Onay */}
        <div className="lg:col-span-2 space-y-4">
          {/* AI Caption Asistanı */}
          <Card>
            <CardContent className="pt-4 px-4 pb-4">
              <AICaptionPanel
                brief={project.brief ?? ""}
                brandVoice={project.client.brandVoice ?? ""}
                platform={primaryPlatform}
                postType={project.postType}
                onUse={(text) => setCaption(text)}
              />
            </CardContent>
          </Card>

          {/* Yayın Bilgisi */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">Yayın Bilgisi</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {[
                { label: "Platform(lar)", value: project.platforms.join(", ") || "—" },
                { label: "İçerik Türü", value: project.postType },
                { label: "Planlanan Yayın", value: publishAtLabel },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Planlanmış post'lar */}
          {project.scheduledPosts && project.scheduledPosts.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold">Planlanmış Yayınlar</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-1.5">
                {project.scheduledPosts.map((sp) => {
                  const published = sp.status === "published";
                  const busy = publishingId === sp.id;
                  return (
                    <div key={sp.id} className="space-y-1 rounded-md border bg-muted/20 px-2 py-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{sp.platform}</span>
                        <span className="text-muted-foreground">
                          {formatDate(new Date(sp.scheduledAt))}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {sp.status}
                        </Badge>
                      </div>
                      {!published && (
                        <button
                          type="button"
                          onClick={() => publishNow(sp.id)}
                          disabled={busy || publishingId !== null}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "w-full h-7 gap-1.5 text-[11px]"
                          )}
                        >
                          {busy ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Send className="h-3 w-3" />
                          )}
                          Şimdi Yayınla
                        </button>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Aksiyon butonları */}
          <div className="space-y-2">
            <button
              onClick={() => changeStatus("INTERNAL_REVIEW")}
              disabled={statusAction !== null || project.status === "INTERNAL_REVIEW"}
              className={cn(
                buttonVariants(),
                "w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
              )}
            >
              {statusAction === "INTERNAL_REVIEW" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              İç Onaya Gönder
            </button>
            <button
              onClick={() => changeStatus("EDITING")}
              disabled={statusAction !== null || project.status === "EDITING"}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "w-full gap-2 text-amber-600 border-amber-200 hover:bg-amber-50"
              )}
            >
              {statusAction === "EDITING" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Revizyon İste
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
