"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatDate } from "@/lib/utils";
import {
  CheckCircle2, XCircle, MessageSquare, Clock,
  Camera, Globe2, TrendingUp, Eye, Download,
  ThumbsUp, RefreshCw, Loader2, Briefcase, PlaySquare, FileImage,
  EyeOff,
} from "lucide-react";

interface PortalProject {
  id: string;
  title: string;
  status: string;
  platforms: string[];
  postType: string;
  caption: string | null;
  publishAt: string | null;
  updatedAt: string;
  revisions: number;
}

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  INSTAGRAM: Camera,
  FACEBOOK: Globe2,
  TIKTOK: TrendingUp,
  LINKEDIN: Briefcase,
  YOUTUBE: PlaySquare,
};

function ContentCard({
  content,
  onApprove,
  onRevision,
  busy,
  readOnly = false,
}: {
  content: PortalProject;
  onApprove?: (id: string) => Promise<void> | void;
  onRevision?: (id: string, note: string) => Promise<void> | void;
  busy?: "approve" | "revision" | null;
  readOnly?: boolean;
}) {
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const primaryPlatform = content.platforms[0] ?? "INSTAGRAM";
  const Icon = PLATFORM_ICONS[primaryPlatform] ?? FileImage;
  const isPending = content.status === "CLIENT_REVIEW";

  return (
    <Card className={cn("p-4 space-y-3", isPending && "border-primary/30 shadow-sm shadow-primary/5")}>
      {isPending && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
          <Clock className="h-3.5 w-3.5" />
          Onayınızı Bekliyor
        </div>
      )}

      {/* Önizleme alanı */}
      <div className="aspect-[4/3] rounded-xl bg-muted/50 border border-border flex items-center justify-center relative overflow-hidden">
        <div className="text-center text-muted-foreground">
          <Icon className="h-8 w-8 mx-auto mb-2" />
          <p className="text-xs">{primaryPlatform}</p>
        </div>
        {content.status === "APPROVED" && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-emerald-500 text-white text-[10px] gap-1 border-0">
              <CheckCircle2 className="h-3 w-3" /> Onaylandı
            </Badge>
          </div>
        )}
        {(content.status === "LIVE" || content.status === "PUBLISHED") && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-primary text-white text-[10px] gap-1 border-0">
              <Eye className="h-3 w-3" /> Yayında
            </Badge>
          </div>
        )}
      </div>

      {/* İçerik bilgisi */}
      <div>
        <p className="font-semibold text-sm">{content.title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {content.publishAt
            ? `Yayın: ${formatDate(new Date(content.publishAt))}`
            : "Yayın planlanmadı"}
        </p>
      </div>

      {content.caption && (
        <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-border pl-3 italic whitespace-pre-wrap">
          {content.caption}
        </p>
      )}

      {content.revisions > 0 && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-600">
          <RefreshCw className="h-3 w-3" />
          {content.revisions} onay hareketi yapıldı
        </div>
      )}

      {/* Aksiyon butonları — önizleme modunda gizli */}
      {isPending && !readOnly && (
        <div className="space-y-2 pt-1">
          {showNote && (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Revizyon notunuzu yazın..."
              className="w-full text-xs border border-border rounded-lg p-2.5 resize-none h-20 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
            />
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onApprove?.(content.id)}
              disabled={!!busy}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-xs font-semibold py-2 transition-colors"
            >
              {busy === "approve" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ThumbsUp className="h-3.5 w-3.5" />
              )}
              Onayla
            </button>
            <button
              onClick={() => setShowNote(!showNote)}
              disabled={!!busy}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-xs font-semibold py-2 transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {showNote ? "İptal" : "Revizyon İste"}
            </button>
          </div>
          {showNote && note.trim() && (
            <button
              onClick={async () => {
                await onRevision?.(content.id, note);
                setNote("");
                setShowNote(false);
              }}
              disabled={!!busy}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-amber-400 text-amber-600 text-xs font-semibold py-2 hover:bg-amber-50 disabled:opacity-60 transition-colors"
            >
              {busy === "revision" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
              Revizyon Gönder
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

export default function PortalPage() {
  const [clientName, setClientName] = useState<string>("Müşteri Portalı");
  const [contents, setContents] = useState<PortalProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ id: string; kind: "approve" | "revision" } | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  const load = useCallback(async () => {
    try {
      // ?preview=<jwt> varsa ADMIN/TEAM salt-okunur moddadır — token'ı API'ye aktarırız
      const preview =
        typeof window !== "undefined"
          ? new URL(window.location.href).searchParams.get("preview")
          : null;
      const endpoint = preview
        ? `/api/portal/projects?preview=${encodeURIComponent(preview)}`
        : "/api/portal/projects";
      const res = await fetch(endpoint, { cache: "no-store" });
      if (!res.ok) throw new Error("Portal yüklenemedi");
      const json = (await res.json()) as {
        client: { id: string; name: string } | null;
        projects: PortalProject[];
        mode?: "client" | "preview";
        error?: string;
      };
      if (json.client) setClientName(json.client.name);
      if (json.error) setError(json.error);
      setPreviewMode(json.mode === "preview");
      setContents(json.projects ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleApprove(id: string) {
    setBusy({ id, kind: "approve" });
    try {
      const res = await fetch(`/api/portal/projects/${id}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "APPROVED" }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Onay kaydedilemedi");
      }
      toast.success("İçerik onaylandı");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setBusy(null);
    }
  }

  async function handleRevision(id: string, note: string) {
    setBusy({ id, kind: "revision" });
    try {
      const res = await fetch(`/api/portal/projects/${id}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "REVISION", note }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Revizyon kaydedilemedi");
      }
      toast.success("Revizyon isteği gönderildi");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setBusy(null);
    }
  }

  const pending = contents.filter((c) => c.status === "CLIENT_REVIEW");
  const approved = contents.filter((c) => c.status === "APPROVED");
  const published = contents.filter((c) => c.status === "LIVE" || c.status === "PUBLISHED");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Portal yükleniyor…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {previewMode && (
        <div className="rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-900/10 px-4 py-3 flex items-start gap-2.5">
          <EyeOff className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-xs">
            <p className="font-semibold text-amber-800 dark:text-amber-300">Önizleme modu</p>
            <p className="text-amber-700 dark:text-amber-400/80 mt-0.5">
              Bu sayfayı yönetici olarak görüntülüyorsunuz. Onaylama ve revizyon
              aksiyonları devre dışıdır — yalnızca müşteri kullanıcısı kendi hesabından
              karar verebilir.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">İçeriklerim</h1>
          <p className="text-sm text-muted-foreground">{clientName} — Müşteri Portalı</p>
        </div>
        <button className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}>
          <Download className="h-3.5 w-3.5" /> Rapor İndir
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive font-medium">{error}</p>
        </div>
      )}

      {/* Özet sayaçlar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Onay Bekliyor", count: pending.length, color: "text-primary bg-primary/10" },
          { label: "Onaylandı", count: approved.length, color: "text-emerald-600 bg-emerald-50" },
          { label: "Yayında", count: published.length, color: "text-violet-600 bg-violet-50" },
        ].map(({ label, count, color }) => (
          <Card key={label} className="p-3 text-center">
            <p className={cn("text-2xl font-bold mb-0.5", color.split(" ")[0])}>{count}</p>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="bekleyen">
        <TabsList>
          <TabsTrigger value="bekleyen">
            Bekleyenler
            {pending.length > 0 && (
              <span className="ml-1.5 h-4 w-4 rounded-full bg-primary text-white text-[10px] flex items-center justify-center">
                {pending.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="onaylanan">Onaylananlar</TabsTrigger>
          <TabsTrigger value="yayinda">Yayında</TabsTrigger>
        </TabsList>

        <TabsContent value="bekleyen" className="mt-4">
          {pending.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
              <p className="font-medium">Bekleyen içerik yok</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pending.map((c) => (
                <ContentCard
                  key={c.id}
                  content={c}
                  onApprove={handleApprove}
                  onRevision={handleRevision}
                  busy={busy?.id === c.id ? busy.kind : null}
                  readOnly={previewMode}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="onaylanan" className="mt-4">
          {approved.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <p className="font-medium">Onaylanmış içerik yok</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {approved.map((c) => (
                <ContentCard key={c.id} content={c} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="yayinda" className="mt-4">
          {published.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <p className="font-medium">Yayında içerik yok</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {published.map((c) => (
                <ContentCard key={c.id} content={c} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
