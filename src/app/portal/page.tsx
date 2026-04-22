"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatDate } from "@/lib/utils";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";
import {
  CheckCircle2, XCircle, MessageSquare, Clock,
  Camera, Globe2, TrendingUp, Eye, Download,
  ThumbsUp, RefreshCw,
} from "lucide-react";

const DEMO_CONTENTS: {
  id: string; title: string; platform: string; status: string;
  publishAt: string; thumbnail: null; caption: string; revisions: number;
}[] = [];

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  INSTAGRAM: Camera,
  FACEBOOK: Globe2,
  TIKTOK: TrendingUp,
};

function ContentCard({
  content,
  onApprove,
  onRevision,
}: {
  content: (typeof DEMO_CONTENTS)[0];
  onApprove?: (id: string) => void;
  onRevision?: (id: string) => void;
}) {
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const Icon = PLATFORM_ICONS[content.platform] ?? Camera;
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
          <p className="text-xs">{content.platform}</p>
        </div>
        {content.status === "APPROVED" && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-emerald-500 text-white text-[10px] gap-1 border-0">
              <CheckCircle2 className="h-3 w-3" /> Onaylandı
            </Badge>
          </div>
        )}
        {content.status === "PUBLISHED" && (
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
          Yayın: {formatDate(content.publishAt)}
        </p>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-border pl-3 italic">
        {content.caption}
      </p>

      {content.revisions > 0 && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-600">
          <RefreshCw className="h-3 w-3" />
          {content.revisions} revizyon yapıldı
        </div>
      )}

      {/* Aksiyon butonları */}
      {isPending && (
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
              onClick={() => {
                setShowNote(false);
                onApprove?.(content.id);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold py-2 transition-colors"
            >
              <ThumbsUp className="h-3.5 w-3.5" /> Onayla
            </button>
            <button
              onClick={() => setShowNote(!showNote)}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold py-2 transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {showNote ? "İptal" : "Revizyon İste"}
            </button>
          </div>
          {showNote && note.trim() && (
            <button
              onClick={() => {
                setShowNote(false);
                onRevision?.(content.id);
              }}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-amber-400 text-amber-600 text-xs font-semibold py-2 hover:bg-amber-50 transition-colors"
            >
              <XCircle className="h-3.5 w-3.5" /> Revizyon Gönder
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

export default function PortalPage() {
  const [contents, setContents] = useState(DEMO_CONTENTS);

  const pending = contents.filter((c) => c.status === "CLIENT_REVIEW");
  const approved = contents.filter((c) => c.status === "APPROVED");
  const published = contents.filter((c) => c.status === "PUBLISHED");

  const handleApprove = (id: string) => {
    setContents((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: "APPROVED" } : c))
    );
  };

  const handleRevision = (id: string) => {
    setContents((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: "CLIENT_REVIEW", revisions: c.revisions + 1 } : c
      )
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">İçeriklerim</h1>
          <p className="text-sm text-muted-foreground">Coffee House — Müşteri Portalı</p>
        </div>
        <button className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}>
          <Download className="h-3.5 w-3.5" /> Rapor İndir
        </button>
      </div>

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
              <p className="font-medium">Tüm içerikler onaylandı!</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pending.map((c) => (
                <ContentCard key={c.id} content={c} onApprove={handleApprove} onRevision={handleRevision} />
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
