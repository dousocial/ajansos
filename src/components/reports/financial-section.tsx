"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/invoices/compute";
import {
  DollarSign, TrendingUp, RefreshCcw,
  AlertTriangle, Clock, Loader2, Receipt, Users,
} from "lucide-react";

interface FinancialData {
  mrr: number;
  arr: number;
  openTotal: number;
  overdueTotal: number;
  activeSubCount: number;
  monthly: Array<{ year: number; month: number; collected: number; issued: number }>;
  topClients: Array<{ clientId: string; name: string; total: number }>;
}

const MONTHS_SHORT = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

/** İkili mini bar: üst = kesilen, alt = tahsil edilen. */
function DualBar({
  issued,
  collected,
  max,
}: {
  issued: number;
  collected: number;
  max: number;
}) {
  const issuedPct = max > 0 ? (issued / max) * 100 : 0;
  const collectedPct = max > 0 ? (collected / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary/40 transition-all duration-700"
          style={{ width: `${issuedPct}%` }}
        />
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all duration-700"
          style={{ width: `${collectedPct}%` }}
        />
      </div>
    </div>
  );
}

export function FinancialSection() {
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/reports/financial", { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 403) {
          // ADMIN değil — finansal bölümü gizle
          setData(null);
          setLoading(false);
          return;
        }
        throw new Error("Finansal rapor yüklenemedi");
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <Card className="p-6 flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Finansal veriler yükleniyor...
      </Card>
    );
  }

  if (error) {
    return <Card className="p-4 text-sm text-rose-600">{error}</Card>;
  }

  if (!data) return null; // ADMIN değil

  const maxMonthly = Math.max(...data.monthly.map((m) => Math.max(m.issued, m.collected)), 1);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            Finansal Özet
          </h2>
          <p className="text-xs text-muted-foreground">Gelir, alacak ve abonelik metrikleri</p>
        </div>
        <Link href="/odemeler" className="text-xs text-primary hover:underline">
          Ödemeler sayfasına git →
        </Link>
      </div>

      {/* KPI kartları */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <RefreshCcw className="h-3.5 w-3.5" /> MRR
          </div>
          <div className="text-xl font-bold">{formatCurrency(data.mrr)}</div>
          <div className="text-[11px] text-muted-foreground mt-1">{data.activeSubCount} aktif abonelik</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <TrendingUp className="h-3.5 w-3.5" /> ARR
          </div>
          <div className="text-xl font-bold">{formatCurrency(data.arr)}</div>
          <div className="text-[11px] text-muted-foreground mt-1">yıllık yinelenen</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Clock className="h-3.5 w-3.5" /> Açık Alacak
          </div>
          <div className="text-xl font-bold">{formatCurrency(data.openTotal)}</div>
          <div className="text-[11px] text-muted-foreground mt-1">ödeme bekleyen</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <AlertTriangle className="h-3.5 w-3.5" /> Gecikmiş
          </div>
          <div className={cn("text-xl font-bold", data.overdueTotal > 0 && "text-rose-600")}>
            {formatCurrency(data.overdueTotal)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">vadesi geçmiş</div>
        </Card>
      </div>

      {/* Aylık grafik */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Son 12 Ay — Kesilen vs. Tahsil Edilen
          </h3>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-primary/40" /> Kesilen
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Tahsil
            </span>
          </div>
        </div>
        <div className="grid grid-cols-12 gap-2">
          {data.monthly.map((m) => (
            <div key={`${m.year}-${m.month}`} className="space-y-1">
              <DualBar issued={m.issued} collected={m.collected} max={maxMonthly} />
              <div className="text-[10px] text-center text-muted-foreground">{MONTHS_SHORT[m.month - 1]}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs">
          <span className="text-muted-foreground">
            Toplam kesilen:{" "}
            <span className="font-semibold text-foreground">
              {formatCurrency(data.monthly.reduce((s, m) => s + m.issued, 0))}
            </span>
          </span>
          <span className="text-muted-foreground">
            Toplam tahsil:{" "}
            <span className="font-semibold text-emerald-600">
              {formatCurrency(data.monthly.reduce((s, m) => s + m.collected, 0))}
            </span>
          </span>
        </div>
      </Card>

      {/* En çok ödeme yapan müşteriler */}
      {data.topClients.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Users className="h-4 w-4" />
            En Çok Tahsil Edilen Müşteriler
          </h3>
          <div className="space-y-2">
            {data.topClients.map((c, i) => (
              <Link
                key={c.clientId}
                href={`/musteriler/${c.clientId}`}
                className="flex items-center justify-between gap-3 rounded-md border p-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="text-xs text-muted-foreground font-mono w-6">#{i + 1}</div>
                  <div className="font-medium truncate">{c.name}</div>
                </div>
                <div className="text-sm font-semibold text-emerald-700">{formatCurrency(c.total)}</div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
