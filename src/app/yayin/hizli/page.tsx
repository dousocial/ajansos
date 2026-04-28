/**
 * Hızlı Yayın — üretim kaydı olmadan doğrudan yayın akışı.
 *
 * Akış:
 *  1. Müşteri seç + (opsiyonel) başlık + medya yükle
 *  2. Submit → POST /api/projects { status: "APPROVED", platforms: [], mediaFiles }
 *     (publishAt YOK → ScheduledPost burada oluşmaz)
 *  3. Dönen project.id ile /yayin/yeni?projectId=X'e yönlendir
 *  4. Orada platform/caption/scheduledAt + canlı önizleme aşaması yapılır
 *
 * Tasarım: Üretim formu (brief, çekim tarihi, postType) atlanır. Project DB'de
 * yine açılır — ScheduledPost.projectId zorunlu olduğu için bu kaçınılmaz —
 * ama UI bunu kullanıcıdan saklıyor.
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Upload,
  X,
  Loader2,
  FileVideo,
  ImageIcon,
  Zap,
} from "lucide-react";

interface ClientOption {
  id: string;
  name: string;
}

interface UploadedMedia {
  storageKey: string;
  publicUrl: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

export default function HizliYayinPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/clients?limit=100")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((j: { data: ClientOption[] }) => setClients(j.data ?? []))
      .catch(() => toast.error("Müşteri listesi yüklenemedi"));
  }, []);

  async function handleFiles(files: FileList | File[]) {
    if (!clientId) {
      toast.error("Önce müşteri seçin");
      return;
    }
    const arr = Array.from(files);
    setUploadingCount((n) => n + arr.length);
    await Promise.all(
      arr.map(async (file) => {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("clientId", clientId);
        try {
          const r = await fetch("/api/upload", { method: "POST", body: fd });
          const j = (await r.json().catch(() => ({}))) as {
            data?: UploadedMedia;
            error?: string;
          };
          if (!r.ok || !j.data) throw new Error(j.error ?? "Yükleme başarısız");
          setMedia((prev) => [...prev, j.data!]);
        } catch (e) {
          toast.error(
            `${file.name}: ${e instanceof Error ? e.message : "yükleme hatası"}`
          );
        } finally {
          setUploadingCount((n) => n - 1);
        }
      })
    );
  }

  function removeMedia(storageKey: string) {
    setMedia((prev) => prev.filter((m) => m.storageKey !== storageKey));
    fetch(`/api/upload?key=${encodeURIComponent(storageKey)}`, {
      method: "DELETE",
    }).catch(() => {});
  }

  async function next() {
    if (!clientId) return toast.error("Müşteri seçin");
    if (media.length === 0) return toast.error("En az bir medya yükleyin");
    if (uploadingCount > 0) return toast.error("Yükleme bitsin");

    setSubmitting(true);
    try {
      // İçerik kaydı arkada yaratılır — kullanıcıya görünmez. Üretim
      // pipeline'ı atlanıyor: status doğrudan APPROVED.
      const autoTitle =
        title.trim() ||
        `Hızlı yayın · ${new Date().toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}`;
      // postType medyadan tahmin: video varsa VIDEO, ≥2 görsel ise CAROUSEL,
      // yoksa IMAGE. dispatchPublish bunu Meta API tipine çeviriyor (REEL/STORY
      // dönüştürmek istenirse kullanıcı /yayin/yeni'de manuel değiştirebilmeli;
      // şimdilik basit mapping yeterli).
      const hasVideo = media.some((m) => m.mimeType.startsWith("video/"));
      const imageCount = media.filter((m) => m.mimeType.startsWith("image/")).length;
      const postType = hasVideo
        ? "VIDEO"
        : imageCount >= 2
          ? "CAROUSEL"
          : "IMAGE";
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          title: autoTitle,
          status: "APPROVED",
          postType,
          isQuickPublish: true,
          mediaFiles: media,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        data?: { id: string };
        error?: string;
      };
      if (!res.ok || !data.data) {
        throw new Error(data.error ?? "İçerik oluşturulamadı");
      }
      router.push(`/yayin/yeni?projectId=${data.data.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hata");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <Link
          href="/yayin"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"
        >
          <ArrowLeft className="h-3 w-3" /> Yayın Planlayıcı
        </Link>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" /> Hızlı Yayın
        </h1>
        <p className="text-sm text-muted-foreground">
          Üretim kaydı olmadan doğrudan yayın oluştur. Sonraki adımda platform,
          caption ve zaman seçeceksin.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">İçerik</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="client">Müşteri *</Label>
            <select
              id="client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className={cn(
                "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                "transition-colors"
              )}
            >
              <option value="">— Müşteri seçin —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="title">Başlık (iç kullanım — opsiyonel)</Label>
            <Input
              id="title"
              placeholder="Boş bırakılırsa otomatik ad verilir"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Bu başlık yayında görünmez; sadece iç listelerde tanımak için.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Medya *</Label>
              <span className="text-xs text-muted-foreground">
                {media.length} dosya
                {uploadingCount > 0 && ` · ${uploadingCount} yükleniyor`}
              </span>
            </div>
            <label
              htmlFor="media-input"
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add("border-primary", "bg-primary/5");
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove("border-primary", "bg-primary/5");
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove("border-primary", "bg-primary/5");
                if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input px-4 py-6 text-sm transition-colors cursor-pointer",
                "hover:border-primary/40 hover:bg-muted/40",
                !clientId && "opacity-60 cursor-not-allowed"
              )}
            >
              <Upload className="h-5 w-5 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium">
                  Dosyaları sürükleyin veya{" "}
                  <span className="text-primary">tıklayıp seçin</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  JPG, PNG, WEBP, MP4, MOV · Görsel ≤10MB · Video ≤100MB
                </p>
              </div>
              <input
                id="media-input"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime"
                disabled={!clientId}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFiles(e.target.files);
                    e.target.value = "";
                  }
                }}
              />
            </label>

            {media.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-2">
                {media.map((m) => {
                  const isVideo = m.mimeType.startsWith("video/");
                  return (
                    <div
                      key={m.storageKey}
                      className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
                    >
                      {isVideo ? (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
                          <FileVideo className="h-6 w-6" />
                          <span className="px-1 text-[10px] text-center truncate w-full">
                            {m.name}
                          </span>
                        </div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.publicUrl}
                          alt={m.name}
                          className="h-full w-full object-cover"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => removeMedia(m.storageKey)}
                        className="absolute top-1 right-1 rounded-full bg-black/70 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Kaldır"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1">
                        <div className="flex items-center gap-1 text-[10px] text-white/90">
                          {isVideo ? (
                            <FileVideo className="h-3 w-3" />
                          ) : (
                            <ImageIcon className="h-3 w-3" />
                          )}
                          <span className="truncate">
                            {(m.sizeBytes / 1024 / 1024).toFixed(1)}MB
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={next}
          disabled={submitting || uploadingCount > 0 || !clientId || media.length === 0}
          className={cn(
            buttonVariants({ variant: "default" }),
            "bg-primary text-white hover:bg-primary/90"
          )}
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Devam → Platform & Zaman
        </button>
      </div>
    </div>
  );
}
