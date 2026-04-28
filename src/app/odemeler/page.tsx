"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatDate } from "@/lib/utils";
import { formatCurrency } from "@/lib/invoices/compute";
import {
  Plus, Search, Loader2, FileText, Receipt, Clock,
  CheckCircle2, AlertTriangle, TrendingUp, RefreshCcw, Pause, FilePlus2,
} from "lucide-react";

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  title: string;
  currency: "TRY" | "USD" | "EUR";
  amount: string | number;
  totalAmount: string | number;
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED";
  issueDate: string;
  dueDate: string;
  paidAt: string | null;
  client: { id: string; name: string; slug: string; logo: string | null };
  subscription: { id: string; name: string } | null;
}

interface SubscriptionRow {
  id: string;
  name: string;
  amount: string | number;
  currency: "TRY" | "USD" | "EUR";
  interval: "MONTHLY" | "QUARTERLY" | "YEARLY";
  status: "ACTIVE" | "PAUSED" | "CANCELLED";
  startDate: string;
  nextInvoiceDate: string;
  client: { id: string; name: string; slug: string; logo: string | null };
  _count: { invoices: number };
}

const INVOICE_STATUS_META: Record<
  InvoiceRow["status"],
  { label: string; icon: React.ElementType; className: string }
> = {
  DRAFT: { label: "Taslak", icon: FileText, className: "bg-muted text-muted-foreground border" },
  SENT: { label: "Gönderildi", icon: Clock, className: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
  PAID: { label: "Ödendi", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  OVERDUE: { label: "Gecikmiş", icon: AlertTriangle, className: "bg-rose-500/10 text-rose-700 border-rose-500/20" },
  CANCELLED: { label: "İptal", icon: AlertTriangle, className: "bg-muted text-muted-foreground border line-through" },
};

const SUB_STATUS_META: Record<
  SubscriptionRow["status"],
  { label: string; className: string; icon: React.ElementType }
> = {
  ACTIVE: { label: "Aktif", icon: RefreshCcw, className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  PAUSED: { label: "Durduruldu", icon: Pause, className: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
  CANCELLED: { label: "İptal", icon: AlertTriangle, className: "bg-muted text-muted-foreground border" },
};

const INTERVAL_LABELS: Record<SubscriptionRow["interval"], string> = {
  MONTHLY: "Aylık",
  QUARTERLY: "3 Aylık",
  YEARLY: "Yıllık",
};

export default function OdemelerPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [invRes, subRes] = await Promise.all([
        fetch("/api/invoices?limit=100", { cache: "no-store" }),
        fetch("/api/subscriptions?limit=100", { cache: "no-store" }),
      ]);
      if (!invRes.ok) throw new Error("Faturalar yüklenemedi");
      if (!subRes.ok) throw new Error("Abonelikler yüklenemedi");
      const inv = await invRes.json();
      const sub = await subRes.json();
      setInvoices(inv.data ?? []);
      setSubscriptions(sub.data ?? []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Bilinmeyen hata";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Bir abonelikten manuel fatura üret. Sıradaki tıkta backend nextInvoiceDate'i
  // ileri aldığı için bir sonraki dönemin faturası kesilir → "her tıkta bir
  // sonraki ay" akışı.
  async function generateInvoice(sub: SubscriptionRow) {
    if (sub.status !== "ACTIVE") {
      toast.error("Sadece aktif abonelikler için fatura üretilebilir");
      return;
    }
    if (
      !confirm(
        `"${sub.name}" için ${formatDate(sub.nextInvoiceDate)} tarihli fatura üretilecek.\nDevam edilsin mi?`
      )
    ) {
      return;
    }
    setGeneratingId(sub.id);
    try {
      const res = await fetch(`/api/subscriptions/${sub.id}/generate-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        invoice?: { invoiceNumber: string; id: string };
        nextInvoiceDate?: string;
        error?: string;
      } | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? "Fatura üretilemedi");
      }
      toast.success(`Fatura oluşturuldu: ${data.invoice?.invoiceNumber}`);
      // Listeyi tazele — yeni fatura görünsün ve sıradaki tarih güncellensin
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setGeneratingId(null);
    }
  }

  const summary = useMemo(() => {
    const paid = invoices.filter((i) => i.status === "PAID");
    const open = invoices.filter((i) => i.status === "SENT" || i.status === "OVERDUE");
    const overdue = invoices.filter((i) => i.status === "OVERDUE");
    const sumPaid = paid.reduce((s, i) => s + Number(i.totalAmount), 0);
    const sumOpen = open.reduce((s, i) => s + Number(i.totalAmount), 0);
    const sumOverdue = overdue.reduce((s, i) => s + Number(i.totalAmount), 0);
    const activeSubs = subscriptions.filter((s) => s.status === "ACTIVE");
    const mrr = activeSubs
      .filter((s) => s.interval === "MONTHLY")
      .reduce((s, sub) => s + Number(sub.amount), 0);
    return { sumPaid, sumOpen, sumOverdue, mrr, paidCount: paid.length, openCount: open.length, overdueCount: overdue.length };
  }, [invoices, subscriptions]);

  const filteredInvoices = invoices.filter((inv) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.title.toLowerCase().includes(q) ||
      inv.client.name.toLowerCase().includes(q);
    const matchStatus = !statusFilter || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const filteredSubs = subscriptions.filter((s) => {
    const q = search.toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || s.client.name.toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ödemeler</h1>
          <p className="text-sm text-muted-foreground mt-1">Fatura ve abonelik yönetimi</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/odemeler/abonelikler/yeni"
            className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
          >
            <RefreshCcw className="h-4 w-4" />
            Yeni Abonelik
          </Link>
          <Link href="/odemeler/yeni" className={cn(buttonVariants(), "gap-2")}>
            <Plus className="h-4 w-4" />
            Yeni Fatura
          </Link>
        </div>
      </div>

      {/* Özet kartlar */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <TrendingUp className="h-3.5 w-3.5" />
            Tahsil Edilen
          </div>
          <div className="text-2xl font-bold text-emerald-600">{formatCurrency(summary.sumPaid)}</div>
          <div className="text-xs text-muted-foreground mt-1">{summary.paidCount} fatura</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Clock className="h-3.5 w-3.5" />
            Açık Alacak
          </div>
          <div className="text-2xl font-bold">{formatCurrency(summary.sumOpen)}</div>
          <div className="text-xs text-muted-foreground mt-1">{summary.openCount} fatura</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            Gecikmiş
          </div>
          <div className={cn("text-2xl font-bold", summary.overdueCount > 0 && "text-rose-600")}>
            {formatCurrency(summary.sumOverdue)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{summary.overdueCount} fatura</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <RefreshCcw className="h-3.5 w-3.5" />
            MRR
          </div>
          <div className="text-2xl font-bold">{formatCurrency(summary.mrr)}</div>
          <div className="text-xs text-muted-foreground mt-1">aylık yinelenen</div>
        </Card>
      </div>

      {/* Arama */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Fatura no, başlık veya müşteri..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {error && (
        <Card className="p-4 text-sm text-rose-600">{error}</Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices" className="gap-2">
            <Receipt className="h-4 w-4" />
            Faturalar
            <Badge variant="secondary" className="ml-1">
              {invoices.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="subscriptions" className="gap-2">
            <RefreshCcw className="h-4 w-4" />
            Abonelikler
            <Badge variant="secondary" className="ml-1">
              {subscriptions.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Faturalar */}
        <TabsContent value="invoices" className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {(["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"] as const).map((s) => {
              const meta = INVOICE_STATUS_META[s];
              const Icon = meta.icon;
              const count = invoices.filter((i) => i.status === s).length;
              const active = statusFilter === s;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(active ? null : s)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                    active ? meta.className : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {meta.label} <span className="text-[10px] opacity-70">({count})</span>
                </button>
              );
            })}
            {statusFilter && (
              <button
                onClick={() => setStatusFilter(null)}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                filtreyi temizle
              </button>
            )}
          </div>

          {filteredInvoices.length === 0 ? (
            <Card className="p-10 text-center">
              <Receipt className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-3">Fatura bulunamadı.</p>
              <Link href="/odemeler/yeni" className={cn(buttonVariants({ size: "sm" }), "gap-2")}>
                <Plus className="h-3.5 w-3.5" />
                İlk faturayı oluştur
              </Link>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredInvoices.map((inv) => {
                const meta = INVOICE_STATUS_META[inv.status];
                const Icon = meta.icon;
                return (
                  <Link key={inv.id} href={`/odemeler/${inv.id}`} className="block">
                    <Card className="p-4 hover:bg-muted/40 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-mono text-muted-foreground">{inv.invoiceNumber}</span>
                            <Badge className={cn("border text-[11px] gap-1", meta.className)}>
                              <Icon className="h-3 w-3" />
                              {meta.label}
                            </Badge>
                            {inv.subscription && (
                              <Badge variant="secondary" className="text-[11px]">
                                <RefreshCcw className="h-3 w-3 mr-1" />
                                abonelik
                              </Badge>
                            )}
                          </div>
                          <h3 className="font-semibold truncate">{inv.title}</h3>
                          <div className="text-xs text-muted-foreground mt-1">
                            {inv.client.name} · Düzenleme: {formatDate(inv.issueDate)} · Vade: {formatDate(inv.dueDate)}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-lg font-bold">{formatCurrency(Number(inv.totalAmount), inv.currency)}</div>
                          <div className="text-[11px] text-muted-foreground">KDV dahil</div>
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Abonelikler */}
        <TabsContent value="subscriptions" className="mt-4 space-y-3">
          {filteredSubs.length === 0 ? (
            <Card className="p-10 text-center">
              <RefreshCcw className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-3">Abonelik bulunamadı.</p>
              <Link href="/odemeler/abonelikler/yeni" className={cn(buttonVariants({ size: "sm" }), "gap-2")}>
                <Plus className="h-3.5 w-3.5" />
                İlk aboneliği oluştur
              </Link>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredSubs.map((sub) => {
                const meta = SUB_STATUS_META[sub.status];
                const Icon = meta.icon;
                const isGenerating = generatingId === sub.id;
                const canGenerate = sub.status === "ACTIVE";
                return (
                  <Card key={sub.id} className="p-4 hover:bg-muted/40 transition-colors group relative">
                    <Link
                      href={`/odemeler/abonelikler/${sub.id}`}
                      className="block"
                      aria-label={`${sub.name} detayını aç`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0 pr-32">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={cn("border text-[11px] gap-1", meta.className)}>
                              <Icon className="h-3 w-3" />
                              {meta.label}
                            </Badge>
                            <Badge variant="secondary" className="text-[11px]">
                              {INTERVAL_LABELS[sub.interval]}
                            </Badge>
                          </div>
                          <h3 className="font-semibold truncate">{sub.name}</h3>
                          <div className="text-xs text-muted-foreground mt-1">
                            {sub.client.name} · Sıradaki fatura: {formatDate(sub.nextInvoiceDate)} ·{" "}
                            {sub._count.invoices} fatura üretildi
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-lg font-bold">{formatCurrency(Number(sub.amount), sub.currency)}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {INTERVAL_LABELS[sub.interval].toLowerCase()} · KDV hariç
                          </div>
                        </div>
                      </div>
                    </Link>

                    {/* Fatura Üret butonu — Link'in dışında, mutlak konumlu */}
                    <button
                      type="button"
                      onClick={() => generateInvoice(sub)}
                      disabled={isGenerating || !canGenerate}
                      title={
                        !canGenerate
                          ? "Sadece aktif abonelikler için fatura üretilebilir"
                          : `${formatDate(sub.nextInvoiceDate)} tarihli fatura üret`
                      }
                      className={cn(
                        "absolute right-32 top-1/2 -translate-y-1/2",
                        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium",
                        "border border-primary/30 bg-primary/5 text-primary",
                        "hover:bg-primary/10 hover:border-primary/50 transition-colors",
                        "disabled:opacity-50 disabled:cursor-not-allowed"
                      )}
                    >
                      {isGenerating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FilePlus2 className="h-3.5 w-3.5" />
                      )}
                      Fatura Üret
                    </button>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
