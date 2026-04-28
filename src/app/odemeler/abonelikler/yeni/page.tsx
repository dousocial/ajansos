"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft, Save, Loader2, RefreshCcw } from "lucide-react";

interface ClientOption {
  id: string;
  name: string;
  contactEmail: string | null;
}

export default function YeniAbonelikPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);

  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"TRY" | "USD" | "EUR">("TRY");
  const [vatRate, setVatRate] = useState("20");
  const [interval, setInterval] = useState<"MONTHLY" | "QUARTERLY" | "YEARLY">("MONTHLY");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
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
        toast.error(e instanceof Error ? e.message : "Hata");
      } finally {
        setClientsLoading(false);
      }
    })();
  }, []);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!clientId) errs.clientId = "Müşteri seçin";
    if (!name.trim()) errs.name = "Abonelik adı zorunlu";
    const a = parseFloat(amount || "0");
    if (!a || a <= 0) errs.amount = "Tutar 0'dan büyük olmalı";
    const v = parseFloat(vatRate || "0");
    if (v < 0 || v > 100) errs.vatRate = "KDV 0-100 arası";
    if (!startDate) errs.startDate = "Başlangıç gerekli";
    if (endDate && new Date(endDate) < new Date(startDate)) {
      errs.endDate = "Bitiş başlangıçtan önce olamaz";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          name: name.trim(),
          description: description.trim() || undefined,
          amount: parseFloat(amount),
          currency,
          vatRate: parseFloat(vatRate),
          interval,
          startDate: new Date(startDate).toISOString(),
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Oluşturulamadı");
      }
      toast.success("Abonelik oluşturuldu");
      router.push("/odemeler");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hata");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Link
        href="/odemeler"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Ödemeler
      </Link>

      <div>
        <div className="flex items-center gap-2">
          <RefreshCcw className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Yeni Abonelik</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Yinelenen retainer faturaları otomatik oluşur. Oluşturulan faturalar <b>taslak</b> olur — sen kontrol edip gönderirsin.
        </p>
      </div>

      <Card className="p-5 space-y-4">
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
              className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— Müşteri seçin —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {errors.clientId && <p className="text-xs text-rose-500 mt-1">{errors.clientId}</p>}
        </div>

        <div>
          <Label htmlFor="name">
            Abonelik Adı <span className="text-rose-500">*</span>
          </Label>
          <Input
            id="name"
            placeholder="Ör: Instagram Yönetimi - Aylık Retainer"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {errors.name && <p className="text-xs text-rose-500 mt-1">{errors.name}</p>}
        </div>

        <div>
          <Label htmlFor="description">Açıklama (opsiyonel)</Label>
          <Textarea
            id="description"
            placeholder="Kapsam: ayda 12 post, 4 reel, hikaye yönetimi..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

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

        <div>
          <Label htmlFor="interval">Yinelenme Sıklığı</Label>
          <select
            id="interval"
            value={interval}
            onChange={(e) => setInterval(e.target.value as "MONTHLY" | "QUARTERLY" | "YEARLY")}
            className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="MONTHLY">Aylık</option>
            <option value="QUARTERLY">3 Aylık</option>
            <option value="YEARLY">Yıllık</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="startDate">
              Başlangıç <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground mt-1">İlk fatura bu tarihte kesilir</p>
          </div>
          <div>
            <Label htmlFor="endDate">Bitiş (opsiyonel)</Label>
            <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            {errors.endDate && <p className="text-xs text-rose-500 mt-1">{errors.endDate}</p>}
            <p className="text-[11px] text-muted-foreground mt-1">Boş bırakılırsa süresizdir</p>
          </div>
        </div>

        <div>
          <Label htmlFor="notes">İç not (opsiyonel)</Label>
          <Textarea
            id="notes"
            placeholder="Ajans ekibine özel bilgiler — müşteriye gitmez"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Link href="/odemeler" className={cn(buttonVariants({ variant: "outline" }))}>
            İptal
          </Link>
          <button onClick={handleSubmit} disabled={submitting} className={cn(buttonVariants(), "gap-2")}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Aboneliği Oluştur
          </button>
        </div>
      </Card>
    </div>
  );
}
