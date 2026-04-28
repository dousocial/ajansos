"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import { formatCurrency } from "@/lib/invoices/compute";
import { FileText, Download, Loader2, CheckCircle2, Clock, AlertTriangle, EyeOff } from "lucide-react";

interface PortalInvoice {
  id: string;
  invoiceNumber: string;
  title: string;
  currency: "TRY" | "USD" | "EUR";
  amount: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  status: "SENT" | "PAID" | "OVERDUE";
  issueDate: string;
  dueDate: string;
  paidAt: string | null;
  publicNote: string | null;
}

const STATUS_META: Record<PortalInvoice["status"], { label: string; icon: React.ElementType; className: string }> = {
  SENT: {
    label: "Ödeme Bekliyor",
    icon: Clock,
    className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  },
  PAID: {
    label: "Ödendi",
    icon: CheckCircle2,
    className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  },
  OVERDUE: {
    label: "Gecikmiş",
    icon: AlertTriangle,
    className: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  },
};

function PortalFaturalarContent() {
  const searchParams = useSearchParams();
  const preview = searchParams.get("preview");

  const [invoices, setInvoices] = useState<PortalInvoice[]>([]);
  const [clientName, setClientName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = preview
        ? `/api/portal/invoices?preview=${encodeURIComponent(preview)}`
        : "/api/portal/invoices";
      const res = await fetch(endpoint, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Faturalar yüklenemedi");
      setInvoices(json.invoices ?? []);
      setClientName(json.client?.name ?? "");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Bilinmeyen hata";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [preview]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(() => {
    const open = invoices.filter((i) => i.status === "SENT" || i.status === "OVERDUE");
    const overdue = invoices.filter((i) => i.status === "OVERDUE");
    const sumOpen = open.reduce((s, i) => s + i.totalAmount, 0);
    const sumOverdue = overdue.reduce((s, i) => s + i.totalAmount, 0);
    const paidLast = invoices.filter((i) => i.status === "PAID").length;
    return { open: open.length, overdue: overdue.length, sumOpen, sumOverdue, paidCount: paidLast };
  }, [invoices]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {preview && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-700">
          <EyeOff className="h-4 w-4" />
          <span>Salt-okunur önizleme modu{clientName ? ` — ${clientName}` : ""}</span>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Faturalarım</h1>
        <p className="text-sm text-muted-foreground mt-1">Açık ve ödenmiş tüm faturalarınız burada.</p>
      </div>

      {/* Özet kartlar */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Açık Alacak</div>
          <div className="text-2xl font-bold">{formatCurrency(summary.sumOpen)}</div>
          <div className="text-xs text-muted-foreground mt-1">{summary.open} fatura</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Gecikmiş</div>
          <div className={cn("text-2xl font-bold", summary.overdue > 0 && "text-rose-600")}>
            {formatCurrency(summary.sumOverdue)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{summary.overdue} fatura</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Ödenmiş</div>
          <div className="text-2xl font-bold">{summary.paidCount}</div>
          <div className="text-xs text-muted-foreground mt-1">fatura</div>
        </Card>
      </div>

      {error ? (
        <Card className="p-6 text-sm text-rose-600">{error}</Card>
      ) : invoices.length === 0 ? (
        <Card className="p-10 text-center">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Henüz bir faturanız yok.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => {
            const meta = STATUS_META[inv.status];
            const Icon = meta.icon;
            const pdfUrl = preview
              ? `/api/portal/invoices/${inv.id}/pdf?preview=${encodeURIComponent(preview)}`
              : `/api/portal/invoices/${inv.id}/pdf`;
            return (
              <Card key={inv.id} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-mono text-muted-foreground">{inv.invoiceNumber}</span>
                      <Badge className={cn("border text-[11px] font-medium gap-1", meta.className)}>
                        <Icon className="h-3 w-3" />
                        {meta.label}
                      </Badge>
                    </div>
                    <h3 className="font-semibold truncate">{inv.title}</h3>
                    <div className="text-xs text-muted-foreground mt-1">
                      Düzenleme: {formatDate(inv.issueDate)} · Vade: {formatDate(inv.dueDate)}
                      {inv.paidAt && ` · Ödendi: ${formatDate(inv.paidAt)}`}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl font-bold">{formatCurrency(inv.totalAmount, inv.currency)}</div>
                    <div className="text-[11px] text-muted-foreground">KDV dahil</div>
                  </div>
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0 gap-2")}
                  >
                    <Download className="h-3.5 w-3.5" />
                    PDF
                  </a>
                </div>
                {inv.publicNote && (
                  <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">{inv.publicNote}</div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PortalFaturalarPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <PortalFaturalarContent />
    </Suspense>
  );
}
