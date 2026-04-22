"use client";

import { useState, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Camera, Globe2, Briefcase, Video, PlaySquare, X } from "lucide-react";

// ─── Demo veriler ────────────────────────────────────────────────────────────

const DEMO_CLIENTS = [
  { id: "1", name: "Coffee House" },
  { id: "2", name: "ModaStore" },
  { id: "3", name: "FitLife Gym" },
  { id: "4", name: "Teknosa" },
  { id: "5", name: "Natura Beauty" },
  { id: "6", name: "BurgerLab" },
];

// ─── Platform tanımları ──────────────────────────────────────────────────────

type Platform = "INSTAGRAM" | "FACEBOOK" | "TIKTOK" | "LINKEDIN" | "YOUTUBE";
type PostType = "IMAGE" | "VIDEO" | "REEL" | "STORY" | "CAROUSEL";

const PLATFORMS: { key: Platform; label: string; Icon: React.ElementType }[] = [
  { key: "INSTAGRAM", label: "Instagram", Icon: Camera },
  { key: "FACEBOOK", label: "Facebook", Icon: Globe2 },
  { key: "TIKTOK", label: "TikTok", Icon: Video },
  { key: "LINKEDIN", label: "LinkedIn", Icon: Briefcase },
  { key: "YOUTUBE", label: "YouTube", Icon: PlaySquare },
];

const POST_TYPES: { key: PostType; label: string }[] = [
  { key: "IMAGE", label: "Görsel" },
  { key: "VIDEO", label: "Video" },
  { key: "REEL", label: "Reels" },
  { key: "STORY", label: "Story" },
  { key: "CAROUSEL", label: "Carousel" },
];

// ─── Form state tipi ─────────────────────────────────────────────────────────

interface FormData {
  clientId: string;
  title: string;
  platforms: Platform[];
  postType: PostType | "";
  brief: string;
  caption: string;
  hashtags: string[];
  shootDate: string;
  shootLocation: string;
  publishAt: string;
}

// ─── Sayfa bileşeni ──────────────────────────────────────────────────────────

export default function YeniIcerikPage() {
  const router = useRouter();

  const [form, setForm] = useState<FormData>({
    clientId: "",
    title: "",
    platforms: [],
    postType: "",
    brief: "",
    caption: "",
    hashtags: [],
    shootDate: "",
    shootLocation: "",
    publishAt: "",
  });

  const [hashtagInput, setHashtagInput] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  // ── Yardımcı güncelleyiciler ───────────────────────────────────────────────

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function togglePlatform(platform: Platform) {
    setForm((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter((p) => p !== platform)
        : [...prev.platforms, platform],
    }));
  }

  // ── Hashtag yönetimi ───────────────────────────────────────────────────────

  function addHashtag() {
    const raw = hashtagInput.trim();
    if (!raw) return;
    const tag = raw.startsWith("#") ? raw : `#${raw}`;
    if (!form.hashtags.includes(tag)) {
      setField("hashtags", [...form.hashtags, tag]);
    }
    setHashtagInput("");
  }

  function handleHashtagKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addHashtag();
    }
  }

  function removeHashtag(tag: string) {
    setField(
      "hashtags",
      form.hashtags.filter((h) => h !== tag)
    );
  }

  // ── Doğrulama ──────────────────────────────────────────────────────────────

  function validate(): boolean {
    const errs: string[] = [];
    if (!form.clientId) errs.push("Lütfen bir müşteri seçin.");
    if (!form.title.trim()) errs.push("Başlık zorunludur.");
    if (form.platforms.length === 0) errs.push("En az bir platform seçin.");
    setErrors(errs);
    return errs.length === 0;
  }

  // ── Gönderim ───────────────────────────────────────────────────────────────

  function handleAddToPipeline() {
    if (!validate()) return;
    console.log("Pipeline'a Ekle →", form);
    router.push("/icerikler");
  }

  function handleSaveDraft() {
    if (!validate()) return;
    console.log("Taslak Kaydet →", form);
    router.push("/dashboard");
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Sayfa başlığı */}
      <div>
        <h1 className="text-2xl font-bold">Yeni İçerik</h1>
        <p className="text-sm text-muted-foreground">
          İçerik bilgilerini doldurarak pipeline'a ekleyin.
        </p>
      </div>

      {/* Hata mesajları */}
      {errors.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 space-y-1">
          {errors.map((err) => (
            <p key={err} className="text-sm text-destructive font-medium">
              {err}
            </p>
          ))}
        </div>
      )}

      {/* 2 kolonlu layout */}
      <div className="grid grid-cols-5 gap-6 items-start">
        {/* ── Sol kolon (3/5) ── */}
        <div className="col-span-3 space-y-5">
          {/* Müşteri seçimi */}
          <Card>
            <CardHeader>
              <CardTitle>İçerik Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Müşteri */}
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
                  {DEMO_CLIENTS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Başlık */}
              <div className="space-y-1.5">
                <Label htmlFor="title">Başlık *</Label>
                <Input
                  id="title"
                  placeholder="İçerik başlığını girin"
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                />
              </div>

              {/* Platform(lar) */}
              <div className="space-y-2">
                <Label>Platform(lar) *</Label>
                <div className="grid grid-cols-3 gap-2">
                  {PLATFORMS.map(({ key, label, Icon }) => {
                    const selected = form.platforms.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => togglePlatform(key)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                          selected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* İçerik türü */}
              <div className="space-y-2">
                <Label>İçerik Türü</Label>
                <div className="flex flex-wrap gap-2">
                  {POST_TYPES.map(({ key, label }) => {
                    const selected = form.postType === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setField("postType", key)}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                          selected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Brief / Açıklama */}
              <div className="space-y-1.5">
                <Label htmlFor="brief">Brief / Açıklama</Label>
                <Textarea
                  id="brief"
                  placeholder="İçerik briefinizi yazın..."
                  rows={3}
                  value={form.brief}
                  onChange={(e) => setField("brief", e.target.value)}
                />
              </div>

              {/* Caption */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="caption">Caption</Label>
                  <span className="text-xs text-muted-foreground">
                    {form.caption.length}/2200
                  </span>
                </div>
                <Textarea
                  id="caption"
                  placeholder="Gönderi açıklaması..."
                  rows={4}
                  maxLength={2200}
                  value={form.caption}
                  onChange={(e) => setField("caption", e.target.value)}
                />
              </div>

              {/* Hashtag input */}
              <div className="space-y-1.5">
                <Label htmlFor="hashtag">Hashtag&apos;ler</Label>
                <Input
                  id="hashtag"
                  placeholder="#örnek yazıp Enter'a basın"
                  value={hashtagInput}
                  onChange={(e) => setHashtagInput(e.target.value)}
                  onKeyDown={handleHashtagKeyDown}
                  onBlur={addHashtag}
                />
                {form.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {form.hashtags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeHashtag(tag)}
                          className="hover:text-destructive transition-colors"
                          aria-label={`${tag} kaldır`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Sağ kolon (2/5) ── */}
        <div className="col-span-2 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Planlama</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Çekim tarihi */}
              <div className="space-y-1.5">
                <Label htmlFor="shootDate">Çekim Tarihi</Label>
                <Input
                  id="shootDate"
                  type="date"
                  value={form.shootDate}
                  onChange={(e) => setField("shootDate", e.target.value)}
                />
              </div>

              {/* Çekim yeri */}
              <div className="space-y-1.5">
                <Label htmlFor="shootLocation">Çekim Yeri</Label>
                <Input
                  id="shootLocation"
                  placeholder="Stüdyo, lokasyon..."
                  value={form.shootLocation}
                  onChange={(e) => setField("shootLocation", e.target.value)}
                />
              </div>

              {/* Yayın tarihi & saati */}
              <div className="space-y-1.5">
                <Label htmlFor="publishAt">Yayın Tarihi & Saati</Label>
                <Input
                  id="publishAt"
                  type="datetime-local"
                  value={form.publishAt}
                  onChange={(e) => setField("publishAt", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Aksiyon butonları */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleAddToPipeline}
              className={cn(
                buttonVariants({ variant: "default" }),
                "w-full bg-primary text-white hover:bg-primary/90"
              )}
            >
              Pipeline&apos;a Ekle
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              className={cn(buttonVariants({ variant: "outline" }), "w-full")}
            >
              Taslak Kaydet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
