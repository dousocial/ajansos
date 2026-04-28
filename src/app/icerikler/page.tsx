"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import {
  Plus, Search, FileImage, Camera, Globe2, Video, Briefcase,
  PlaySquare, Loader2, LayoutGrid, List as ListIcon, Calendar,
} from "lucide-react";

// /icerikler artık üretim listesi değil — yayın sonrası bakış noktası.
// Sadece YAYIMLANMIŞ (LIVE/PUBLISHED), PLANLI (publishAt > now ve APPROVED+)
// ve İPTAL (CANCELLED) statüleri görünür. Üretim akışı /surec sayfasında.
type FilterStatus = "ALL" | "LIVE" | "SCHEDULED" | "CANCELLED";

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
  publishedAt?: string | null;
  updatedAt: string;
  client: { id: string; name: string; slug: string; logo: string | null };
  files?: ProjectFile[];
}

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  INSTAGRAM: Camera,
  FACEBOOK: Globe2,
  TIKTOK: Video,
  LINKEDIN: Briefcase,
  YOUTUBE: PlaySquare,
};

const POST_TYPE_LABELS: Record<string, string> = {
  IMAGE: "Görsel",
  VIDEO: "Video",
  REEL: "Reels",
  STORY: "Story",
  CAROUSEL: "Carousel",
};

// Renk şeritleri — kart sol kenarına 4px çizgi, durum bilgisi ekran tarayıcı için.
const STRIPE_COLORS: Record<FilterStatus, string> = {
  ALL: "bg-slate-300",
  LIVE: "bg-emerald-500",
  SCHEDULED: "bg-blue-500",
  CANCELLED: "bg-slate-400",
};

const STATUS_PILL: Record<FilterStatus, string> = {
  ALL: "bg-slate-100 text-slate-700",
  LIVE: "bg-emerald-100 text-emerald-700",
  SCHEDULED: "bg-blue-100 text-blue-700",
  CANCELLED: "bg-slate-100 text-slate-500 line-through",
};

const STATUS_LABEL: Record<FilterStatus, string> = {
  ALL: "Tümü",
  LIVE: "Yayında",
  SCHEDULED: "Planlandı",
  CANCELLED: "İptal",
};

function classifyStatus(p: ProjectRow): FilterStatus {
  if (p.status === "CANCELLED") return "CANCELLED";
  if (p.status === "LIVE" || p.status === "PUBLISHED") return "LIVE";
  // APPROVED + ileri tarihli publishAt olanlar planlandı.
  if (p.status === "APPROVED" && p.publishAt && new Date(p.publishAt) > new Date()) {
    return "SCHEDULED";
  }
  return "ALL"; // listede gösterilmez
}

export default function IceriklerPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [view, setView] = useState<"grid" | "list">("list");
  const [items, setItems] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/projects?limit=100", { cache: "no-store" });
        if (!res.ok) throw new Error("İçerikler yüklenemedi");
        const json = (await res.json()) as { data: ProjectRow[] };
        if (!cancelled) setItems(json.data ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Bilinmeyen hata");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Sadece yayında / planlandı / iptal olanlar; üretimdekiler /surec sayfasında.
  const visibleItems = useMemo(() => {
    return items
      .map((p) => ({ ...p, _filterStatus: classifyStatus(p) as FilterStatus }))
      .filter((p) => p._filterStatus !== "ALL");
  }, [items]);

  const counts = useMemo(() => {
    const c: Record<FilterStatus, number> = { ALL: visibleItems.length, LIVE: 0, SCHEDULED: 0, CANCELLED: 0 };
    for (const p of visibleItems) c[p._filterStatus] = (c[p._filterStatus] ?? 0) + 1;
    return c;
  }, [visibleItems]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return visibleItems
      .filter((p) => filter === "ALL" || p._filterStatus === filter)
      .filter(
        (p) =>
          !q ||
          p.title.toLowerCase().includes(q) ||
          p.client.name.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        // Son paylaşıma göre sıralama: publishedAt > publishAt > updatedAt.
        const at = new Date(a.publishedAt ?? a.publishAt ?? a.updatedAt).getTime();
        const bt = new Date(b.publishedAt ?? b.publishAt ?? b.updatedAt).getTime();
        return bt - at;
      });
  }, [visibleItems, filter, search]);

  return (
    <div className="space-y-5">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">İçerikler</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? "Yükleniyor…" : `${visibleItems.length} içerik (yayında / planlı / iptal)`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden" role="group" aria-label="Görünüm">
            <button
              type="button"
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
              className={cn(
                "px-2.5 py-1.5 text-xs font-medium transition-colors",
                view === "list" ? "bg-primary text-white" : "bg-card text-muted-foreground hover:bg-muted"
              )}
            >
              <ListIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-pressed={view === "grid"}
              className={cn(
                "px-2.5 py-1.5 text-xs font-medium transition-colors border-l border-border",
                view === "grid" ? "bg-primary text-white" : "bg-card text-muted-foreground hover:bg-muted"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          <Link href="/icerikler/yeni" className={cn(buttonVariants(), "gap-2 bg-primary text-white hover:bg-primary/90")}>
            <Plus className="h-4 w-4" /> Yeni İçerik
          </Link>
        </div>
      </div>

      {/* Hata */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive font-medium">{error}</p>
        </div>
      )}

      {/* Yükleniyor */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          İçerikler yükleniyor…
        </div>
      )}

      {/* Boş state */}
      {!loading && !error && visibleItems.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <FileImage className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium mb-1">Yayınlanmış / planlı içerik yok</p>
          <p className="text-xs text-muted-foreground mb-4">
            Üretim aşamasındaki içerikleri <Link href="/surec" className="text-primary hover:underline">Süreç Yönetimi</Link>&apos;nde görebilirsiniz.
          </p>
          <Link
            href="/icerikler/yeni"
            className={cn(buttonVariants(), "gap-2 bg-primary text-white hover:bg-primary/90")}
          >
            <Plus className="h-4 w-4" /> Yeni İçerik
          </Link>
        </div>
      )}

      {/* Filtre + arama */}
      {!loading && visibleItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {(["ALL", "LIVE", "SCHEDULED", "CANCELLED"] as FilterStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={cn(
                "shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                filter === s
                  ? "bg-primary text-white"
                  : "bg-muted text-muted-foreground hover:bg-border"
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", STRIPE_COLORS[s])} />
              {STATUS_LABEL[s]}
              <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px]">
                {counts[s] ?? 0}
              </span>
            </button>
          ))}

          <div className="relative ml-auto max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="İçerik veya müşteri ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>
      )}

      {/* Liste görünümü */}
      {!loading && visibleItems.length > 0 && view === "list" && (
        <div className="space-y-2">
          {filtered.map((item) => {
            const primaryPlatform = item.platforms[0] ?? "INSTAGRAM";
            const PlatformIcon = PLATFORM_ICONS[primaryPlatform] ?? FileImage;
            const stripe = STRIPE_COLORS[item._filterStatus];
            const pill = STATUS_PILL[item._filterStatus];
            const thumb = (item.files ?? []).find((f) => f.mimeType.startsWith("image/"));
            const dateLabel = item.publishedAt ?? item.publishAt;
            return (
              <Link
                key={item.id}
                href={`/icerikler/${item.id}`}
                className="relative flex items-center gap-4 rounded-xl border border-border bg-card p-3.5 pl-4 hover:border-primary/30 hover:bg-muted/30 transition-all group overflow-hidden"
              >
                {/* Renk şeridi (sol) */}
                <span className={cn("absolute left-0 top-0 bottom-0 w-1", stripe)} />

                {/* Thumbnail */}
                {thumb ? (
                  <Image
                    src={thumb.publicUrl}
                    alt=""
                    width={44}
                    height={44}
                    className="h-11 w-11 rounded-lg object-cover shrink-0 ring-1 ring-border"
                    unoptimized
                  />
                ) : (
                  <div className="h-11 w-11 shrink-0 rounded-lg bg-muted flex items-center justify-center">
                    <PlatformIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}

                {/* Bilgiler */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {item.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-muted-foreground">{item.client.name}</span>
                    <span className="text-border">·</span>
                    <span className="text-[11px] text-muted-foreground">
                      {POST_TYPE_LABELS[item.postType] ?? item.postType}
                    </span>
                  </div>
                </div>

                {/* Yayın tarihi */}
                <div className="hidden md:flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
                  <Calendar className="h-3.5 w-3.5" />
                  {dateLabel ? formatDate(new Date(dateLabel)) : "—"}
                </div>

                {/* Durum etiketi */}
                <Badge className={cn("shrink-0 text-[11px] border-0 font-medium", pill)}>
                  {STATUS_LABEL[item._filterStatus]}
                </Badge>
              </Link>
            );
          })}

          {filtered.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <FileImage className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Sonuç bulunamadı</p>
            </div>
          )}
        </div>
      )}

      {/* Grid görünümü — Reels/Story kapağı veya post ilk görseli kart preview */}
      {!loading && visibleItems.length > 0 && view === "grid" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((item) => {
            const primaryPlatform = item.platforms[0] ?? "INSTAGRAM";
            const PlatformIcon = PLATFORM_ICONS[primaryPlatform] ?? FileImage;
            const thumb = (item.files ?? []).find((f) => f.mimeType.startsWith("image/"));
            const stripe = STRIPE_COLORS[item._filterStatus];
            const pill = STATUS_PILL[item._filterStatus];
            const dateLabel = item.publishedAt ?? item.publishAt;
            // Reels & Story 9:16, diğerleri kare.
            const aspect =
              item.postType === "REEL" || item.postType === "STORY"
                ? "aspect-[9/16]"
                : "aspect-square";
            return (
              <Link
                key={item.id}
                href={`/icerikler/${item.id}`}
                className="group rounded-xl border border-border bg-card overflow-hidden hover:border-primary/30 hover:shadow-md transition-all"
              >
                <div className={cn("relative bg-muted overflow-hidden", aspect)}>
                  {/* Renk şeridi (üst) */}
                  <span className={cn("absolute top-0 left-0 right-0 h-1 z-10", stripe)} />
                  {thumb ? (
                    <Image
                      src={thumb.publicUrl}
                      alt={item.title}
                      fill
                      sizes="(min-width:1280px) 20vw, (min-width:640px) 33vw, 50vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      unoptimized
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                      <PlatformIcon className="h-8 w-8" />
                    </div>
                  )}
                  {/* Sağ üstte küçük platform rozeti */}
                  <span className="absolute top-2 right-2 z-10 inline-flex items-center justify-center h-6 w-6 rounded-md bg-black/60 backdrop-blur text-white">
                    <PlatformIcon className="h-3.5 w-3.5" />
                  </span>
                  {/* Sağ altta status pill */}
                  <span className={cn(
                    "absolute bottom-2 left-2 z-10 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                    pill
                  )}>
                    {STATUS_LABEL[item._filterStatus]}
                  </span>
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">
                    {item.title}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground truncate">{item.client.name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {dateLabel ? formatDate(new Date(dateLabel)) : "—"}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}

          {filtered.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-border p-10 text-center">
              <FileImage className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Sonuç bulunamadı</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
