"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import {
  Plus, Search, Camera, Globe2, Users, Loader2,
  FileImage, TrendingUp,
} from "lucide-react";

interface ClientRow {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  contactName: string | null;
  contactEmail: string | null;
  healthScore: number;
  updatedAt: string;
  socialAccounts?: { platform: string }[];
  _count: { projects: number };
  activeProjects?: number;
}

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  INSTAGRAM: Camera,
  FACEBOOK: Globe2,
  TIKTOK: TrendingUp,
  LINKEDIN: Users,
};

function HealthRing({ score }: { score: number }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <svg width="44" height="44" viewBox="0 0 44 44">
      <circle cx="22" cy="22" r={r} fill="none" stroke="var(--border)" strokeWidth="3" />
      <circle
        cx="22" cy="22" r={r} fill="none"
        stroke={color} strokeWidth="3"
        strokeDasharray={`${fill} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 22 22)"
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
      <text x="22" y="27" textAnchor="middle" fontSize="11" fontWeight="700" fill={color}>
        {score}
      </text>
    </svg>
  );
}

export default function MusterilerPage() {
  const [search, setSearch] = useState("");
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/clients?limit=100", { cache: "no-store" });
        if (!res.ok) throw new Error("Müşteriler yüklenemedi");
        const json = (await res.json()) as { data: ClientRow[] };
        if (!cancelled) setClients(json.data ?? []);
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

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.industry ?? "").toLowerCase().includes(q) ||
      (c.contactName ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Müşteriler</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? "Yükleniyor…" : `${clients.length} aktif müşteri`}
          </p>
        </div>
        <Link href="/musteriler/yeni" className={cn(buttonVariants(), "gap-2 bg-primary text-white hover:bg-primary/90")}>
          <Plus className="h-4 w-4" /> Yeni Müşteri
        </Link>
      </div>

      {/* Arama */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Müşteri ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
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
          Müşteriler yükleniyor…
        </div>
      )}

      {/* Boş state */}
      {!loading && !error && clients.length === 0 && (
        <Card className="p-10 text-center border-dashed border-2">
          <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium mb-1">Henüz müşteri yok</p>
          <p className="text-xs text-muted-foreground mb-4">
            İlk müşterinizi ekleyerek başlayın.
          </p>
          <Link
            href="/musteriler/yeni"
            className={cn(buttonVariants(), "gap-2 bg-primary text-white hover:bg-primary/90")}
          >
            <Plus className="h-4 w-4" /> Yeni Müşteri
          </Link>
        </Card>
      )}

      {/* Grid */}
      {!loading && clients.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((client) => {
            // Aynı müşterinin bir platformda birden fazla hesabı olabilir
            // (örn. iki Instagram, FB Page + Group). React key çakışmasını
            // önlemek + ikonu tekilleştirmek için Set ile dedupe.
            const platforms = Array.from(
              new Set((client.socialAccounts ?? []).map((s) => s.platform))
            );
            return (
              <Link key={client.id} href={`/musteriler/${client.id}`}>
                <Card className="p-4 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group h-full">
                  <div className="flex items-start justify-between mb-3">
                    {/* Avatar */}
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        {client.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-sm group-hover:text-primary transition-colors">
                          {client.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {client.industry ?? "—"}
                        </p>
                      </div>
                    </div>
                    <HealthRing score={client.healthScore} />
                  </div>

                  {/* Platform ikonları */}
                  {platforms.length > 0 && (
                    <div className="flex items-center gap-1.5 mb-3">
                      {platforms.map((p) => {
                        const Icon = PLATFORM_ICONS[p] ?? Camera;
                        return (
                          <div key={p} className="h-6 w-6 rounded-md bg-muted flex items-center justify-center">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* İstatistikler */}
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <FileImage className="h-3.5 w-3.5" />
                      <span>
                        <span className="font-semibold text-foreground">
                          {client._count.projects}
                        </span>{" "}
                        toplam içerik
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(new Date(client.updatedAt))}
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}

          {/* Yeni müşteri kartı */}
          <Link href="/musteriler/yeni">
            <Card className="p-4 border-dashed border-2 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer h-full min-h-[148px] flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary">
              <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                <Plus className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium">Yeni Müşteri Ekle</p>
            </Card>
          </Link>
        </div>
      )}
    </div>
  );
}
