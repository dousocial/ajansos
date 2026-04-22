"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { STATUS_LABELS, STATUS_COLORS, PIPELINE_ORDER } from "@/lib/constants";
import { Plus, Search, FileImage, Camera, Globe2, Video } from "lucide-react";

const DEMO_ITEMS: {
  id: string; title: string; status: string; client: string;
  platform: string; postType: string; publishAt: string; updatedAt: string;
}[] = [];

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  INSTAGRAM: Camera, FACEBOOK: Globe2,
  TIKTOK: Video, LINKEDIN: FileImage,
};

const POST_TYPE_LABELS: Record<string, string> = {
  IMAGE: "Görsel", VIDEO: "Video", REEL: "Reels",
  STORY: "Story", CAROUSEL: "Carousel",
};

export default function IceriklerPage() {
  const [search, setSearch] = useState("");
  const [activeStatus, setActiveStatus] = useState<string | null>(null);

  const filtered = DEMO_ITEMS.filter((item) => {
    const matchSearch = item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.client.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !activeStatus || item.status === activeStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-5">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">İçerikler</h1>
          <p className="text-sm text-muted-foreground">{DEMO_ITEMS.length} içerik</p>
        </div>
        <Link href="/icerikler/yeni" className={cn(buttonVariants(), "gap-2 bg-primary text-white hover:bg-primary/90")}>
          <Plus className="h-4 w-4" /> Yeni İçerik
        </Link>
      </div>

      {/* Pipeline filtre bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setActiveStatus(null)}
          className={cn(
            "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
            !activeStatus ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-border"
          )}
        >
          Tümü ({DEMO_ITEMS.length})
        </button>
        {PIPELINE_ORDER.map((status) => {
          const count = DEMO_ITEMS.filter((i) => i.status === status).length;
          if (count === 0) return null;
          return (
            <button
              key={status}
              onClick={() => setActiveStatus(activeStatus === status ? null : status)}
              className={cn(
                "shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                activeStatus === status
                  ? "bg-primary text-white"
                  : "bg-muted text-muted-foreground hover:bg-border"
              )}
            >
              {STATUS_LABELS[status]}
              <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px]">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Arama */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="İçerik veya müşteri ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Liste */}
      <div className="space-y-2">
        {filtered.map((item) => {
          const PlatformIcon = PLATFORM_ICONS[item.platform] ?? FileImage;
          return (
            <Link
              key={item.id}
              href={`/icerikler/${item.id}`}
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-3.5 hover:border-primary/30 hover:bg-muted/30 transition-all group"
            >
              {/* Tür ikonu */}
              <div className={cn("h-9 w-9 shrink-0 rounded-lg flex items-center justify-center", STATUS_COLORS[item.status])}>
                <PlatformIcon className="h-4 w-4" />
              </div>

              {/* Bilgiler */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                  {item.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-muted-foreground">{item.client}</span>
                  <span className="text-border">·</span>
                  <span className="text-[11px] text-muted-foreground">{POST_TYPE_LABELS[item.postType]}</span>
                </div>
              </div>

              {/* Yayın tarihi */}
              <div className="hidden md:block text-center shrink-0">
                <p className="text-[11px] font-medium text-foreground">{item.publishAt}</p>
                <p className="text-[10px] text-muted-foreground">yayın tarihi</p>
              </div>

              {/* Durum */}
              <Badge className={cn("shrink-0 text-[11px] border-0 font-medium", STATUS_COLORS[item.status])}>
                {STATUS_LABELS[item.status]}
              </Badge>

              {/* Güncelleme */}
              <span className="hidden lg:block text-[10px] text-muted-foreground shrink-0 w-20 text-right">
                {item.updatedAt}
              </span>
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
    </div>
  );
}
