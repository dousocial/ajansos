"use client";

import { useState } from "react";
import { use } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { STATUS_LABELS, STATUS_COLORS, PIPELINE_ORDER } from "@/lib/constants";
import {
  ArrowLeft, Sparkles, Upload, CheckCircle2,
  RotateCcw, Clock, Hash, Loader2, Copy, RefreshCw,
} from "lucide-react";

const DEMO = {
  id: "1", title: "Mayıs Kampanya Reels",
  client: "Coffee House", status: "CLIENT_REVIEW",
  platform: "INSTAGRAM", postType: "REEL",
  publishAt: "15 Mayıs 2026, 18:00",
  brief: "Mayıs ayı bahar kampanyası için enerjik ve renkli bir Reels içeriği. Yeni sezon içecekleri öne çıkarılmalı. Müzik: uptempo. Logo sağ alt köşede.",
  caption: "☀️ Bahar geldi, lezzetler yenilendi!\n\nBu mevsim için özel hazırladığımız yeni tatlarımızla sizi bekliyoruz ☕🌸\n\nHangisini denemek istersiniz? Yorumlarda bize yazın! 👇",
  hashtags: ["#coffeehouse", "#bahar2026", "#yenisezon", "#kahve", "#istanbul"],
};

const PIPELINE = PIPELINE_ORDER;

function PipelineBar({ current }: { current: string }) {
  const idx = PIPELINE.indexOf(current);
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1">
      {PIPELINE.map((step, i) => {
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
            {i < PIPELINE.length - 1 && (
              <div className={cn("h-px w-3 shrink-0", done ? "bg-emerald-300" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function AICaptionPanel({ brief, onUse }: { brief: string; onUse: (text: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [suggestions, setSuggestions] = useState<{ tone: string; text: string; tags: string[] }[]>([]);
  const [streamText, setStreamText] = useState("");

  async function generate() {
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
          platform: "INSTAGRAM",
          postType: "REEL",
          brandVoice: "enerjik ve samimi",
          tones: ["Eğlenceli", "İlham Verici", "Profesyonel"],
        }),
      });

      if (!res.ok || !res.body) throw new Error("API hatası");

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
          } catch { /* ignore */ }
        }
      }
    } catch {
      // Demo fallback
      setSuggestions([
        {
          tone: "Eğlenceli",
          text: "☀️ Bahar geldi, lezzetler yenilendi!\n\nBu mevsim için özel hazırladığımız yeni tatlarımızla sizi bekliyoruz ☕🌸\n\nHangisini denemek istersiniz? 👇",
          tags: ["#coffeehouse", "#bahar2026", "#yenisezon", "#kahve", "#istanbul"],
        },
        {
          tone: "İlham Verici",
          text: "Her yeni mevsim, yeni başlangıçlar getirir. ✨\n\nBu baharda sizi en özel tatlarımızla karşılamaya hazırız. Çünkü iyi bir kahve, güzel bir gün demek. ☕",
          tags: ["#bahar", "#kahveseverleri", "#coffeehouse", "#yenisezon"],
        },
        {
          tone: "Profesyonel",
          text: "Bahar koleksiyonumuzu tanıtmaktan mutluluk duyuyoruz. 🌸\n\nMevsimin en taze tatlarını sizin için özenle seçtik. Detaylı bilgi için profilimizi ziyaret edin.",
          tags: ["#coffeehouse", "#bahar2026", "#premium", "#kahve"],
        },
      ]);
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

      {/* Streaming önizleme */}
      {streaming && streamText && (
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm whitespace-pre-wrap streaming-cursor">
          {streamText}
        </div>
      )}

      {/* Öneri kartları */}
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
          <p className="text-xs text-muted-foreground">Brief'e göre 3 farklı ton önerisi üretilecek</p>
        </div>
      )}
    </div>
  );
}

export default function IcerikDetayPage({ params }: { params: Promise<{ id: string }> }) {
  use(params); // Next.js 15 async params
  const [caption, setCaption] = useState(DEMO.caption);
  const [hashtags] = useState(DEMO.hashtags);

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Geri + Başlık */}
      <div className="flex items-center gap-3">
        <Link href="/icerikler" className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{DEMO.title}</h1>
          <p className="text-sm text-muted-foreground">{DEMO.client}</p>
        </div>
        <Badge className={cn("text-xs border-0 font-medium", STATUS_COLORS[DEMO.status])}>
          {STATUS_LABELS[DEMO.status]}
        </Badge>
      </div>

      {/* Pipeline bar */}
      <PipelineBar current={DEMO.status} />

      {/* 2 sütun layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Sol — ana içerik */}
        <div className="lg:col-span-3 space-y-4">
          {/* Brief */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">Brief & Yön</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-sm text-muted-foreground leading-relaxed">{DEMO.brief}</p>
            </CardContent>
          </Card>

          {/* Medya yükleme */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Upload className="h-4 w-4" /> Medya Dosyaları
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer">
                <Upload className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm font-medium text-muted-foreground">Dosyaları buraya sürükle veya tıkla</p>
                <p className="text-xs text-muted-foreground/70 mt-1">MP4, MOV, JPG, PNG · Maks 500MB</p>
              </div>
            </CardContent>
          </Card>

          {/* Caption */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">Caption</CardTitle>
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
                <button className="flex items-center gap-1 hover:text-foreground transition-colors">
                  <RefreshCw className="h-3 w-3" /> Sıfırla
                </button>
              </div>
              {/* Hashtag'ler */}
              <div>
                <div className="flex items-center gap-1 mb-2">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Hashtag'ler</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {hashtags.map((tag) => (
                    <span key={tag} className="text-xs bg-primary/10 text-primary rounded-md px-2 py-1 cursor-pointer hover:bg-primary/20 transition-colors">
                      {tag}
                    </span>
                  ))}
                  <button className="text-xs bg-muted text-muted-foreground rounded-md px-2 py-1 hover:bg-border transition-colors">
                    + Ekle
                  </button>
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
              <AICaptionPanel brief={DEMO.brief} onUse={(text) => setCaption(text)} />
            </CardContent>
          </Card>

          {/* Yayın Bilgisi */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">Yayın Bilgisi</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {[
                { label: "Platform", value: DEMO.platform },
                { label: "İçerik Türü", value: DEMO.postType },
                { label: "Planlanan Yayın", value: DEMO.publishAt },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Aksiyon butonları */}
          <div className="space-y-2">
            <button className={cn(buttonVariants(), "w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700")}>
              <CheckCircle2 className="h-4 w-4" /> İç Onaya Gönder
            </button>
            <button className={cn(buttonVariants({ variant: "outline" }), "w-full gap-2 text-amber-600 border-amber-200 hover:bg-amber-50")}>
              <RotateCcw className="h-4 w-4" /> Revizyon İste
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
