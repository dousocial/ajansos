"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import { formatCurrency } from "@/lib/invoices/compute";
import { ClientDocuments } from "@/components/odemeler/client-documents";
import {
  ArrowLeft, Download, Send, CheckCircle2, Clock,
  AlertTriangle, FileText, Loader2, Trash2, Mail,
} from "lucide-react";

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  title: string;
  description: string | null;
  currency: "TRY" | "USD" | "EUR";
  amount: string;
  vatRate: string;
  vatAmount: string;
  totalAmount: string;
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED";
  issueDate: string;
  dueDate: string;
  sentAt: string | null;
  paidAt: string | null;
  paymentMethod: string | null;
  paymentNote: string | null;
  publicNote: string | null;
  client: {
    id: string;
    name: string;
    contactEmail: string | null;
    contactPhone: string | null;
    taxId: string | null;
    taxOffice: string | null;
    billingAddress: string | null;
  };
  subscription: { id: string; name: string; interval: string } | null;
}

const STATUS_META: Record<
  InvoiceDetail["status"],
  { label: string; icon: React.ElementType; className: string }
> = {
  DRAFT: { label: "Taslak", icon: FileText, className: "bg-muted text-muted-foreground border" },
  SENT: { label: "Gönderildi", icon: Clock, className: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
  PAID: { label: "Ödendi", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  OVERDUE: { label: "Gecikmiş", icon: AlertTriangle, className: "bg-rose-500/10 text-rose-700 border-rose-500/20" },
  CANCELLED: { label: "İptal", icon: AlertTriangle, className: "bg-muted text-muted-foreground border" },
};

export default function FaturaDetayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Ödeme formu
  const [paymentMethod, setPaymentMethod] = useState("havale");
  const [paymentNote, setPaymentNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/${id}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Fatura yüklenemedi");
      setInvoice(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSend = async () => {
    if (!invoice) return;
    if (!invoice.client.contactEmail) {
      toast.error("Müşterinin e-posta adresi yok — müşteri kaydını güncelleyin");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/invoices/${id}/send`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Gönderilemedi");
      if (json.email?.skipped) {
        toast.warning("Fatura SENT olarak işaretlendi, ama RESEND_API_KEY yok — e-posta gönderilmedi");
      } else {
        toast.success("Fatura müşteriye e-postayla gönderildi");
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gönderim hatası");
    } finally {
      setSending(false);
    }
  };

  const handleMarkPaid = async () => {
    setMarkingPaid(true);
    try {
      const res = await fetch(`/api/invoices/${id}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod, paymentNote: paymentNote.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "İşaretlenemedi");
      toast.success("Fatura ödendi olarak işaretlendi");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hata oluştu");
    } finally {
      setMarkingPaid(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Bu faturayı silmek istediğinizden emin misiniz?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Silinemedi");
      toast.success("Fatura silindi");
      router.push("/odemeler");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Silme hatası");
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
  if (error || !invoice) {
    return (
      <Card className="p-6 text-sm text-rose-600">{error ?? "Fatura bulunamadı"}</Card>
    );
  }

  const meta = STATUS_META[invoice.status];
  const StatusIcon = meta.icon;
  const canSend = invoice.status === "DRAFT" || invoice.status === "SENT" || invoice.status === "OVERDUE";
  const canMarkPaid = invoice.status === "SENT" || invoice.status === "OVERDUE" || invoice.status === "DRAFT";
  const canDelete = invoice.status !== "PAID";

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Link
        href="/odemeler"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Ödemeler
      </Link>

      {/* Başlık */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-mono text-muted-foreground">{invoice.invoiceNumber}</span>
            <Badge className={cn("border text-[11px] gap-1", meta.className)}>
              <StatusIcon className="h-3 w-3" />
              {meta.label}
            </Badge>
            {invoice.subscription && (
              <Badge variant="secondary" className="text-[11px]">
                {invoice.subscription.name}
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{invoice.title}</h1>
          {invoice.description && <p className="text-sm text-muted-foreground mt-1">{invoice.description}</p>}
        </div>
        <div className="text-right shrink-0">
          <div className="text-3xl font-bold">{formatCurrency(Number(invoice.totalAmount), invoice.currency)}</div>
          <div className="text-xs text-muted-foreground">KDV dahil</div>
        </div>
      </div>

      {/* Aksiyonlar */}
      <div className="flex flex-wrap gap-2">
        <a
          href={`/api/invoices/${id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
        >
          <Download className="h-4 w-4" />
          PDF Önizle / İndir
        </a>
        {canSend && (
          <button
            onClick={handleSend}
            disabled={sending || !invoice.client.contactEmail}
            className={cn(buttonVariants(), "gap-2")}
            title={!invoice.client.contactEmail ? "Müşteri e-postası yok" : undefined}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {invoice.status === "DRAFT" ? "Müşteriye Gönder" : "Yeniden Gönder"}
          </button>
        )}
        {canDelete && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={cn(buttonVariants({ variant: "outline" }), "gap-2 text-rose-600 hover:bg-rose-50 ml-auto")}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Sil
          </button>
        )}
      </div>

      {/* Tutar kırılımı */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold mb-3">Tutar Kırılımı</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Ara toplam (KDV hariç)</span>
            <span>{formatCurrency(Number(invoice.amount), invoice.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">KDV (%{Number(invoice.vatRate)})</span>
            <span>{formatCurrency(Number(invoice.vatAmount), invoice.currency)}</span>
          </div>
          <div className="flex justify-between font-semibold pt-2 border-t">
            <span>Genel Toplam</span>
            <span>{formatCurrency(Number(invoice.totalAmount), invoice.currency)}</span>
          </div>
        </div>
      </Card>

      {/* Müşteri */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold mb-3">Müşteri</h2>
        <div className="text-sm space-y-1">
          <div className="font-medium">{invoice.client.name}</div>
          {invoice.client.contactEmail ? (
            <div className="text-muted-foreground flex items-center gap-1.5">
              <Mail className="h-3 w-3" /> {invoice.client.contactEmail}
            </div>
          ) : (
            <div className="text-rose-600 text-xs">⚠️ E-posta adresi yok — fatura e-postayla gönderilemez</div>
          )}
          {invoice.client.taxId && (
            <div className="text-muted-foreground">
              {invoice.client.taxId.length === 11 ? "TCKN" : "VKN"}: {invoice.client.taxId}
              {invoice.client.taxOffice ? ` · ${invoice.client.taxOffice} V.D.` : ""}
            </div>
          )}
          {invoice.client.billingAddress && (
            <div className="text-muted-foreground whitespace-pre-line">{invoice.client.billingAddress}</div>
          )}
        </div>
      </Card>

      {/* Tarihler */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold mb-3">Tarihler</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Düzenleme</div>
            <div>{formatDate(invoice.issueDate)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Vade</div>
            <div>{formatDate(invoice.dueDate)}</div>
          </div>
          {invoice.sentAt && (
            <div>
              <div className="text-xs text-muted-foreground">Gönderildi</div>
              <div>{formatDate(invoice.sentAt)}</div>
            </div>
          )}
          {invoice.paidAt && (
            <div>
              <div className="text-xs text-muted-foreground">Ödendi</div>
              <div>{formatDate(invoice.paidAt)}</div>
            </div>
          )}
        </div>
      </Card>

      {/* Ödendi olarak işaretle */}
      {canMarkPaid && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold mb-3">Ödendi Olarak İşaretle</h2>
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
            <div>
              <Label htmlFor="pm">Yöntem</Label>
              <select
                id="pm"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="havale">Havale</option>
                <option value="eft">EFT</option>
                <option value="nakit">Nakit</option>
                <option value="kart">Kredi Kartı</option>
              </select>
            </div>
            <div>
              <Label htmlFor="pn">Not (opsiyonel)</Label>
              <Input
                id="pn"
                placeholder="Örn: 15 Kasım havalesi"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
              />
            </div>
            <button
              onClick={handleMarkPaid}
              disabled={markingPaid}
              className={cn(buttonVariants(), "gap-2")}
            >
              {markingPaid ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              İşaretle
            </button>
          </div>
        </Card>
      )}

      {/* Dökümanlar — Sözleşme & Fatura PDF upload + listele.
          invoiceId verildiği için bu fatura ile ilişkili dökümanlar filtrelenir. */}
      <ClientDocuments clientId={invoice.client.id} invoiceId={invoice.id} />

      {invoice.paymentNote && invoice.status === "PAID" && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold mb-2">Ödeme Notu</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{invoice.paymentNote}</p>
        </Card>
      )}
    </div>
  );
}
