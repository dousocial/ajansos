/**
 * Yeni Üretim (Project) formu — yalnızca ÜRETİM tarafı.
 *
 * Bu form Project kaydı yaratır; ScheduledPost oluşturmaz, platform/caption/
 * publishAt almaz. Yayın tarafı /yayin/yeni'den yürütülür: orada onaylı
 * Project üzerinden platform seçimi + caption + scheduledAt girilir.
 *
 * Burada toplanan alanlar:
 *  - clientId, title (zorunlu)
 *  - postType: üretim tipi (REEL/IMAGE/CAROUSEL/...) — çekim ekibi için bilgi
 *  - brief: içerik fikri / yönerge
 *  - shootDate, shootLocation: çekim planlaması
 *  - mediaFiles: ham çekim/onay aşaması medyaları
 *
 * Yayın alanları (platforms, caption, hashtags, publishAt) bilinçli olarak
 * KALDIRILDI — iki süreç DB ve UI seviyesinde ayrık.
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  X,
  Loader2,
  Upload,
  FileVideo,
  ImageIcon,
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

type PostType = "IMAGE" | "VIDEO" | "REEL" | "STORY" | "CAROUSEL";

const POST_TYPES: { key: PostType; label: string; hint: string }[] = [
  { key: "IMAGE", label: "Görsel", hint: "Tek kare statik post" },
  { key: "CAROUSEL", label: "Carousel", hint: "Çoklu görsel kaydırma" },
  { key: "VIDEO", label: "Video", hint: "Yatay/kare video" },
  { key: "REEL", label: "Reels", hint: "Dikey kısa video" },
  { key: "STORY", label: "Story", hint: "24 saatlik dikey içerik" },
];

interface FormData {
  clientId: string;
  title: string;
  postType: PostType;
  brief: string;
  shootDate: string;
  shootLocation: string;
}

export default function YeniIcerikPage() {
  const router = useRouter();

  const [form, setForm] = useState<FormData>({
    clientId: "",
    title: "",
    postType: "IMAGE",
    brief: "",
    shootDate: "",
    shootLocation: "",
  });

  const [errors, setErrors] = useState<string[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);

  useEffect(() => {
    fetch("/api/clients?limit=100")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((json: { data: ClientOption[] }) => setClients(json.data ?? []))
      .catch(() => toast.error("Müşteri listesi yüklenemedi"));
  }, []);

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ── Medya yükleme ──────────────────────────────────────────────────────────

  async function handleFiles(files: FileList | File[]) {
    if (!form.clientId) {
      toast.error("Önce müşteri seçin (yükleme klasörü için).");
      return;
    }
    const arr = Array.from(files);
    setUploadingCount((n) => n + arr.length);
    await Promise.all(
      arr.map(async (file) => {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("clientId", form.clientId);
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

  // ── Doğrulama & gönderim ──────────────────────────────────────────────────

  function validate(): boolean {
    const errs: string[] = [];
    if (!form.clientId) errs.push("Lütfen bir müşteri seçin.");
    if (!form.title.trim()) errs.push("Başlık zorunludur.");
    setErrors(errs);
    return errs.length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: form.clientId,
          title: form.title,
          postType: form.postType,
          brief: form.brief || undefined,
          shootDate: form.shootDate
            ? new Date(form.shootDate).toISOString()
            : undefined,
          shootLocation: form.shootLocation || undefined,
          mediaFiles: media,
          // Bilinçli olarak gönderilmeyen alanlar: platforms, caption,
          // hashtags, publishAt → bunlar /yayin/yeni'de ScheduledPost
          // oluşturulurken doldurulur.
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "İçerik oluşturulamadı");
      }
      toast.success("Üretim kaydı oluşturuldu");
      router.push("/icerikler");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Yeni Üretim</h1>
        <p className="text-sm text-muted-foreground">
          Brief, çekim planı ve ham medya. Platform seçimi ve yayın planlaması{" "}
          <span className="font-medium text-foreground">Yayın Planlayıcı</span>'da
          yapılır — proje onaylandıktan sonra.
        </p>
      </div>

      {errors.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 space-y-1">
          {errors.map((err) => (
            <p key={err} className="text-sm text-destructive font-medium">
              {err}
            </p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-5 gap-6 items-start">
        {/* Sol: Üretim bilgileri */}
        <div className="col-span-3 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Üretim Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="client">Müşteri *</Label>
                <select
                  id="client"
                  value={form.clientId}
                  onChange={(e) => setField("clientId", e.target.value)}
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
                <Label htmlFor="title">Başlık *</Label>
                <Input
                  id="title"
                  placeholder="ör. Kış kampanyası — ürün vitrin çekimi"
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Üretim Tipi</Label>
                <div className="grid grid-cols-3 gap-2">
                  {POST_TYPES.map(({ key, label, hint }) => {
                    const selected = form.postType === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setField("postType", key)}
                        title={hint}
                        className={cn(
                          "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors",
                          selected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        )}
                      >
                        <span className="text-sm font-medium">{label}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="brief">Brief / Yönerge</Label>
                <Textarea
                  id="brief"
                  placeholder="Kreatif fikir, ton, referanslar, kısıtlar..."
                  rows={5}
                  value={form.brief}
                  onChange={(e) => setField("brief", e.target.value)}
                />
              </div>

              {/* Medya */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Ham Medya</Label>
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
                    !form.clientId && "opacity-60 cursor-not-allowed"
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
                    disabled={!form.clientId}
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
                  <div className="grid grid-cols-3 gap-2 pt-2">
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
        </div>

        {/* Sağ: Çekim planlaması */}
        <div className="col-span-2 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Çekim Planı</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="shootDate">Çekim Tarihi</Label>
                <Input
                  id="shootDate"
                  type="date"
                  value={form.shootDate}
                  onChange={(e) => setField("shootDate", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="shootLocation">Çekim Yeri</Label>
                <Input
                  id="shootLocation"
                  placeholder="Stüdyo, lokasyon..."
                  value={form.shootLocation}
                  onChange={(e) => setField("shootLocation", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || uploadingCount > 0}
              className={cn(
                buttonVariants({ variant: "default" }),
                "w-full bg-primary text-white hover:bg-primary/90"
              )}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Üretim Kaydı Oluştur
            </button>
            <p className="text-xs text-muted-foreground text-center pt-1">
              Onay aşamasından sonra Yayın Planlayıcı'da platform/caption/zaman
              ayarlanır.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
