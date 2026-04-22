"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Plus, Search, Camera, Globe2, Users,
  MoreHorizontal, FileImage, CheckCircle2, TrendingUp,
} from "lucide-react";

const DEMO_CLIENTS: {
  id: string; name: string; slug: string; industry: string;
  contactName: string; activeProjects: number; totalProjects: number;
  healthScore: number; platforms: string[]; lastActivity: string;
}[] = [];

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

  const filtered = DEMO_CLIENTS.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.industry.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Müşteriler</h1>
          <p className="text-sm text-muted-foreground">{DEMO_CLIENTS.length} aktif müşteri</p>
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

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((client) => (
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
                    <p className="text-[11px] text-muted-foreground">{client.industry}</p>
                  </div>
                </div>
                <HealthRing score={client.healthScore} />
              </div>

              {/* Platform ikonları */}
              <div className="flex items-center gap-1.5 mb-3">
                {client.platforms.map((p) => {
                  const Icon = PLATFORM_ICONS[p] ?? Camera;
                  return (
                    <div key={p} className="h-6 w-6 rounded-md bg-muted flex items-center justify-center">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  );
                })}
              </div>

              {/* İstatistikler */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <FileImage className="h-3.5 w-3.5" />
                  <span><span className="font-semibold text-foreground">{client.activeProjects}</span> aktif</span>
                  <span className="text-border mx-1">·</span>
                  <span>{client.totalProjects} toplam</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{client.lastActivity}</span>
              </div>
            </Card>
          </Link>
        ))}

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
    </div>
  );
}
