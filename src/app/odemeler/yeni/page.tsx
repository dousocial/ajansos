"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { computeAmounts, formatCurrency } from "@/lib/invoices/compute";
import { ArrowLeft, Save, Loader2 } from "lucide-react";

interface ClientOption {
  id: string;
  name: string;
  contactEmail: string | null;
}

export default function YeniFaturaPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);

  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState<"TRY" | "USD" | "EUR">("TRY");
  const [amount, setAmount] = useState("");
  const [vatRate, setVatRate] = useState("20");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [paymentMethod, setPaymentMethod] = useState("havale");
  const [publicNote, setPublicNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/clients?limit=100", { cache: "no-store" });
        if (!res.ok) throw new Error("Müşteriler yüklenemedi");
        const json = await res.json();
        setClients(json.data ?? []);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Müşteriler yüklenemedi");
      } finally {
        setClientsLoading(false);
      }
    })();
  }, []);

  const amountNum = parseFloat(amount || "0");
  const vatNum = parseFloat(vatRate || "0");
  const preview = useMemo(
    () => (amountNum > 0 ? computeAmounts(amountNum, vatNum) : null),
    [amountNum, vatNum]
  );

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!clientId) errs.clientId = "Müşteri seçin";
    if (!title.trim()) errs.title = "Başlık zorunlu";
    if (!amountNum || amountNum <= 0) errs.amount = "Tutar 0'dan büyük olmalı";
    if (vatNum < 0 || vatNum > 100) errs.vatRate = "KDV oranı 0-100 arası olmalı";
    if (!issueDate) errs.issueDate = "Düzenleme tarihi gerekli";
    if (!dueDate) errs.dueDate = "Vade tarihi gerekli";
    if (issueDate && dueDate && new Date(dueDate) < new Date(issueDate)) {
      errs.dueDate = "Vade, düzenleme tarihinden önce olamaz";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          title: title.trim(),
          description: description.trim() || undefined,
          currency,
          amount: amountNum,
          vatRate: vatNum,
          issueDate: new Date(issueDate).toISOString(),
          dueDate: new Date(dueDate).toISOString(),
          paymentMethod,
          publicNote: publicNote.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Fatura oluşturulamadı");
      }
      const json = await res.json();
      toast.success(`Fatura oluşturuldu: ${json.data.invoiceNumber}`);
      router.push(`/odemeler/${json.data.id}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bir hata oluştu");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Link href="/odemeler" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Ödemeler
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Yeni Fatura</h1>
        <p className="text-sm text-muted-foreground mt-1">Taslak olarak kaydedilir; sonra müşteriye gönderebilirsin.</p>
      </div>

      <Card className="p-5 space-y-4">
        {/* Müşteri */}
        <div>
          <Label htmlFor="client">
            Müşteri <span className="text-rose-500">*</span>
          </Label>
          {clientsLoading ? (
            <div className="h-10 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor...
            </div>
          ) : clients.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Önce{" "}
              <Link href="/musteriler/yeni" className="underline text-primary">
                bir müşteri oluşturun
              </Link>
              .
            </div>
          ) : (
            <select
              id="client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className={cn(
                "w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-ring"
              )}
            >
              <option value="">— Müşteri seçin —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.contactEmail ? ` (${c.contactEmail})` : " — e-posta yok"}
                </option>
              ))}
            </select>
          )}
          {errors.clientId && <p className="text-xs text-rose-500 mt-1">{errors.clientId}</p>}
        </div>

        {/* Başlık */}
        <div>
          <Label htmlFor="title">
            Başlık <span className="text-rose-500">*</span>
          </Label>
          <Input
            id="title"
            placeholder="Örn: Kasım 2026 Sosyal Medya Yönetimi"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          {errors.title && <p className="text-xs text-rose-500 mt-1">{errors.title}</p>}
        </div>

        {/* Açıklama */}
        <div>
          <Label htmlFor="description">Açıklama (opsiyonel)</Label>
          <Textarea
            id="description"
            placeholder="Fatura detayı — örn. kampanya adı, proje bilgisi"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        {/* Tutar + KDV + Para birimi */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="amount">
              Tutar (KDV hariç) <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {errors.amount && <p className="text-xs text-rose-500 mt-1">{errors.amount}</p>}
          </div>
          <div>
            <Label htmlFor="vatRate">KDV %</Label>
            <Input
              id="vatRate"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
            />
            {errors.vatRate && <p className="text-xs text-rose-500 mt-1">{errors.vatRate}</p>}
          </div>
          <div>
            <Label htmlFor="currency">Para Birimi</Label>
            <select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as "TRY" | "USD" | "EUR")}
              className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="TRY">₺ TRY</option>
              <option value="USD">$ USD</option>
              <option value="EUR">€ EUR</option>
            </select>
          </div>
        </div>

        {/* Tutar önizleme */}
        {preview && (
          <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ara toplam</span>
              <span>{formatCurrency(preview.amount, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">KDV (%{preview.vatRate})</span>
              <span>{formatCurrency(preview.vatAmount, currency)}</span>
            </div>
            <div className="flex justify-between font-semibold pt-1 border-t">
              <span>Genel Toplam</span>
              <span>{formatCurrency(preview.totalAmount, currency)}</span>
            </div>
          </div>
        )}

        {/* Tarihler */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="issueDate">
              Düzenleme Tarihi <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="issueDate"
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
            {errors.issueDate && <p className="text-xs text-rose-500 mt-1">{errors.issueDate}</p>}
          </div>
          <div>
            <Label htmlFor="dueDate">
              Vade Tarihi <span className="text-rose-500">*</span>
            </Label>
            <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            {errors.dueDate && <p className="text-xs text-rose-500 mt-1">{errors.dueDate}</p>}
          </div>
        </div>

        {/* Ödeme + not */}
        <div>
          <Label htmlFor="paymentMethod">Ödeme Yöntemi</Label>
          <select
            id="paymentMethod"
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
          <Label htmlFor="publicNote">Müşteriye Not (opsiyonel)</Label>
          <Textarea
            id="publicNote"
            placeholder="Ör: IBAN TR00 0000 ... / Havale açıklamasına fatura no yazınız."
            value={publicNote}
            onChange={(e) => setPublicNote(e.target.value)}
            rows={2}
          />
          <p className="text-[11px] text-muted-foreground mt-1">Bu not PDF ve müşteri e-postasında görünür.</p>
        </div>

        {/* Kaydet */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Link href="/odemeler" className={cn(buttonVariants({ variant: "outline" }))}>
            İptal
          </Link>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={cn(buttonVariants(), "gap-2")}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {submitting ? "Oluşturuluyor..." : "Faturayı Oluştur (Taslak)"}
          </button>
        </div>
      </Card>
    </div>
  );
}
