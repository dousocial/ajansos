"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import { formatCurrency } from "@/lib/invoices/compute";
import {
  ArrowLeft, RefreshCcw, Loader2, Pause, Play,
  AlertTriangle, Trash2, CheckCircle2, Clock, FileText,
} from "lucide-react";

interface SubscriptionDetail {
  id: string;
  name: string;
  description: string | null;
  amount: string;
  currency: "TRY" | "USD" | "EUR";
  vatRate: string;
  interval: "MONTHLY" | "QUARTERLY" | "YEARLY";
  startDate: string;
  endDate: string | null;
  nextInvoiceDate: string;
  status: "ACTIVE" | "PAUSED" | "CANCELLED";
  notes: string | null;
  client: { id: string; name: string; contactEmail: string | null };
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    totalAmount: string;
    currency: "TRY" | "USD" | "EUR";
    status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED";
    issueDate: string;
    dueDate: string;
    paidAt: string | null;
  }>;
}

const INTERVAL_LABELS: Record<SubscriptionDetail["interval"], string> = {
  MONTHLY: "Aylık",
  QUARTERLY: "3 Aylık",
  YEARLY: "Yıllık",
};

const SUB_STATUS_META: Record<
  SubscriptionDetail["status"],
  { label: string; className: string; icon: React.ElementType }
> = {
  ACTIVE: { label: "Aktif", icon: RefreshCcw, className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  PAUSED: { label: "Durduruldu", icon: Pause, className: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
  CANCELLED: { label: "İptal", icon: AlertTriangle, className: "bg-muted text-muted-foreground border" },
};

const INVOICE_STATUS_META: Record<
  SubscriptionDetail["invoices"][number]["status"],
  { label: string; icon: React.ElementType; className: string }
> = {
  DRAFT: { label: "Taslak", icon: FileText, className: "bg-muted text-muted-foreground" },
  SENT: { label: "Gönderildi", icon: Clock, className: "bg-amber-500/10 text-amber-700" },
  PAID: { label: "Ödendi", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-700" },
  OVERDUE: { label: "Gecikmiş", icon: AlertTriangle, className: "bg-rose-500/10 text-rose-700" },
  CANCELLED: { label: "İptal", icon: AlertTriangle, className: "bg-muted text-muted-foreground" },
};

export default function AbonelikDetayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [sub, setSub] = useState<SubscriptionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/subscriptions/${id}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Yüklenemedi");
      setSub(json.data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hata");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (newStatus: "ACTIVE" | "PAUSED" | "CANCELLED") => {
    setSaving(true);
    try {
      const res = await fetch(`/api/subscriptions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Güncellenemedi");
      toast.success(`Durum: ${newStatus === "ACTIVE" ? "Aktif" : newStatus === "PAUSED" ? "Durduruldu" : "İptal"}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hata");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Bu aboneliği silmek istediğinizden emin misiniz?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/subscriptions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Silinemedi");
      toast.success("Abonelik silindi");
      router.push("/odemeler");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hata");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!sub) {
    return <Card className="p-6 text-sm text-rose-600">Abonelik bulunamadı</Card>;
  }

  const meta = SUB_STATUS_META[sub.status];
  const StatusIcon = meta.icon;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Link
        href="/odemeler"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Ödemeler
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge className={cn("border text-[11px] gap-1", meta.className)}>
              <StatusIcon className="h-3 w-3" />
              {meta.label}
            </Badge>
            <Badge variant="secondary" className="text-[11px]">
              {INTERVAL_LABELS[sub.interval]}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{sub.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{sub.client.name}</p>
          {sub.description && <p className="text-sm text-muted-foreground mt-2">{sub.description}</p>}
        </div>
        <div className="text-right shrink-0">
          <div className="text-3xl font-bold">{formatCurrency(Number(sub.amount), sub.currency)}</div>
          <div className="text-xs text-muted-foreground">
            {INTERVAL_LABELS[sub.interval].toLowerCase()} · KDV %{Number(sub.vatRate)} hariç
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {sub.status === "ACTIVE" && (
          <button
            onClick={() => updateStatus("PAUSED")}
            disabled={saving}
            className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
            Durdur
          </button>
        )}
        {sub.status === "PAUSED" && (
          <button
            onClick={() => updateStatus("ACTIVE")}
            disabled={saving}
            className={cn(buttonVariants(), "gap-2")}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Devam Ettir
          </button>
        )}
        {sub.status !== "CANCELLED" && (
          <button
            onClick={() => updateStatus("CANCELLED")}
            disabled={saving}
            className={cn(buttonVariants({ variant: "outline" }), "gap-2 text-rose-600")}
          >
            <AlertTriangle className="h-4 w-4" />
            İptal Et
          </button>
        )}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className={cn(buttonVariants({ variant: "outline" }), "gap-2 text-rose-600 ml-auto")}
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Sil
        </button>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold mb-3">Döngü Bilgileri</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Başlangıç</div>
            <div>{formatDate(sub.startDate)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Bitiş</div>
            <div>{sub.endDate ? formatDate(sub.endDate) : "Süresiz"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Sıradaki Fatura</div>
            <div className="font-semibold">{formatDate(sub.nextInvoiceDate)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Yinelenme</div>
            <div>{INTERVAL_LABELS[sub.interval]}</div>
          </div>
        </div>
        {sub.notes && (
          <div className="mt-4 pt-3 border-t">
            <div className="text-xs text-muted-foreground mb-1">İç Not</div>
            <p className="text-sm whitespace-pre-line">{sub.notes}</p>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold mb-3">Üretilen Faturalar ({sub.invoices.length})</h2>
        {sub.invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz fatura üretilmedi. İlk fatura: {formatDate(sub.nextInvoiceDate)}</p>
        ) : (
          <div className="space-y-2">
            {sub.invoices.map((inv) => {
              const m = INVOICE_STATUS_META[inv.status];
              const Icon = m.icon;
              return (
                <Link
                  key={inv.id}
                  href={`/odemeler/${inv.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border p-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="text-sm font-mono text-muted-foreground">{inv.invoiceNumber}</div>
                    <Badge className={cn("text-[11px] gap-1", m.className)}>
                      <Icon className="h-3 w-3" />
                      {m.label}
                    </Badge>
                    <div className="text-xs text-muted-foreground truncate">
                      {formatDate(inv.issueDate)} · Vade {formatDate(inv.dueDate)}
                    </div>
                  </div>
                  <div className="text-sm font-semibold shrink-0">
                    {formatCurrency(Number(inv.totalAmount), inv.currency)}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
