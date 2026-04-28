"use client";

import { useEffect, useState, useCallback, KeyboardEvent, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, Check, Loader2, X, Trash2 } from "lucide-react";

interface FormData {
  name: string;
  industry: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  brandVoice: string;
  revisionQuota: number;
  emojiPolicy: boolean;
  bannedWords: string[];
  healthScore: number;
  taxId: string;
  taxOffice: string;
  billingAddress: string;
}

const EMPTY: FormData = {
  name: "",
  industry: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  brandVoice: "",
  revisionQuota: 3,
  emojiPolicy: true,
  bannedWords: [],
  healthScore: 100,
  taxId: "",
  taxOffice: "",
  billingAddress: "",
};

// VKN 10, TCKN 11 hane.
const TAX_ID_REGEX = /^(?:\d{10}|\d{11})$/;

export default function MusteriDuzenlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [form, setForm] = useState<FormData>(EMPTY);
  const [initialLoad, setInitialLoad] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tagInput, setTagInput] = useState("");

  const update = (patch: Partial<FormData>) => setForm((p) => ({ ...p, ...patch }));

  const loadClient = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${id}`, { cache: "no-store" });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error("Müşteri bilgisi yüklenemedi");
      const json = (await res.json()) as {
        data: {
          name: string;
          industry: string | null;
          contactName: string | null;
          contactEmail: string | null;
          contactPhone: string | null;
          brandVoice: string | null;
          revisionQuota: number;
          emojiPolicy: boolean;
          bannedWords: string[];
          healthScore: number;
          taxId: string | null;
          taxOffice: string | null;
          billingAddress: string | null;
        };
      };
      setForm({
        name: json.data.name,
        industry: json.data.industry ?? "",
        contactName: json.data.contactName ?? "",
        contactEmail: json.data.contactEmail ?? "",
        contactPhone: json.data.contactPhone ?? "",
        brandVoice: json.data.brandVoice ?? "",
        revisionQuota: json.data.revisionQuota,
        emojiPolicy: json.data.emojiPolicy,
        bannedWords: json.data.bannedWords ?? [],
        healthScore: json.data.healthScore,
        taxId: json.data.taxId ?? "",
        taxOffice: json.data.taxOffice ?? "",
        billingAddress: json.data.billingAddress ?? "",
      });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setInitialLoad(false);
    }
  }, [id]);

  useEffect(() => {
    loadClient();
  }, [loadClient]);

  const addTag = (word: string) => {
    const trimmed = word.trim().toLowerCase();
    if (trimmed && !form.bannedWords.includes(trimmed)) {
      update({ bannedWords: [...form.bannedWords, trimmed] });
    }
    setTagInput("");
  };
  const removeTag = (word: string) =>
    update({ bannedWords: form.bannedWords.filter((w) => w !== word) });
  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(tagInput);
    }
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Müşteri adı zorunludur.";
    if (form.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail)) {
      e.contactEmail = "Geçersiz e-posta.";
    }
    if (form.revisionQuota < 0) e.revisionQuota = "0'dan küçük olamaz.";
    if (form.healthScore < 0 || form.healthScore > 100) {
      e.healthScore = "0–100 aralığında olmalı.";
    }
    if (form.taxId.trim() && !TAX_ID_REGEX.test(form.taxId.trim())) {
      e.taxId = "VKN 10 hane veya TCKN 11 hane olmalı.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          industry: form.industry || undefined,
          contactName: form.contactName || undefined,
          contactEmail: form.contactEmail || "",
          contactPhone: form.contactPhone || undefined,
          brandVoice: form.brandVoice || undefined,
          bannedWords: form.bannedWords,
          emojiPolicy: form.emojiPolicy,
          revisionQuota: form.revisionQuota,
          healthScore: form.healthScore,
          // Faturalama: boş değerler API tarafında null'a çevriliyor.
          taxId: form.taxId,
          taxOffice: form.taxOffice,
          billingAddress: form.billingAddress,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Güncelleme başarısız");
      }
      toast.success("Müşteri güncellendi");
      router.push(`/musteriler/${id}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Bu müşteri silinsin mi? İşlem geri alınamaz.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Silme başarısız");
      }
      toast.success("Müşteri silindi");
      router.push("/musteriler");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setDeleting(false);
    }
  };

  if (initialLoad) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Yükleniyor…
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-xl mx-auto text-center py-20 space-y-3">
        <h1 className="text-xl font-semibold">Müşteri bulunamadı</h1>
        <p className="text-sm text-muted-foreground">
          Aradığınız müşteri silinmiş veya hiç var olmamış olabilir.
        </p>
        <Link href="/musteriler" className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}>
          <ChevronLeft className="h-4 w-4" /> Müşteri listesine dön
        </Link>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-xl mx-auto py-10">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive font-medium">{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Müşteri Düzenle</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Müşteri bilgilerini güncelleyin.
          </p>
        </div>
        <Link
          href={`/musteriler/${id}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
        >
          <ChevronLeft className="h-4 w-4" /> İptal
        </Link>
      </div>

      {/* Temel Bilgiler */}
      <Card>
        <CardHeader>
          <CardTitle>Temel Bilgiler</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">
                Müşteri Adı <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => update({ name: e.target.value })}
                aria-invalid={!!errors.name}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="industry">Sektör</Label>
              <Input
                id="industry"
                value={form.industry}
                onChange={(e) => update({ industry: e.target.value })}
              />
            </div>
          </div>

          <hr className="border-border" />

          <p className="text-sm font-medium text-muted-foreground">Yetkili Kişi</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="contactName">Ad Soyad</Label>
              <Input
                id="contactName"
                value={form.contactName}
                onChange={(e) => update({ contactName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contactEmail">E-posta</Label>
              <Input
                id="contactEmail"
                type="email"
                value={form.contactEmail}
                onChange={(e) => update({ contactEmail: e.target.value })}
                aria-invalid={!!errors.contactEmail}
              />
              {errors.contactEmail && (
                <p className="text-xs text-destructive">{errors.contactEmail}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contactPhone">Telefon</Label>
              <Input
                id="contactPhone"
                type="tel"
                value={form.contactPhone}
                onChange={(e) => update({ contactPhone: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Marka Ayarları */}
      <Card>
        <CardHeader>
          <CardTitle>Marka Ayarları</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-1.5">
            <Label htmlFor="brandVoice">Marka Sesi</Label>
            <textarea
              id="brandVoice"
              maxLength={500}
              rows={4}
              value={form.brandVoice}
              onChange={(e) => update({ brandVoice: e.target.value })}
              className={cn(
                "h-auto w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none",
                "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                "resize-none"
              )}
            />
            <p className="text-xs text-muted-foreground text-right">
              {form.brandVoice.length}/500
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <Label htmlFor="revisionQuota">Revizyon Kotası</Label>
              <Input
                id="revisionQuota"
                type="number"
                min={0}
                max={20}
                value={form.revisionQuota}
                onChange={(e) =>
                  update({ revisionQuota: Math.max(0, parseInt(e.target.value) || 0) })
                }
              />
              {errors.revisionQuota && (
                <p className="text-xs text-destructive">{errors.revisionQuota}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Emoji Politikası</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => update({ emojiPolicy: true })}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    form.emojiPolicy && "border-primary bg-primary/10 text-primary"
                  )}
                >
                  😊 İzin Ver
                </button>
                <button
                  type="button"
                  onClick={() => update({ emojiPolicy: false })}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    !form.emojiPolicy && "border-destructive bg-destructive/10 text-destructive"
                  )}
                >
                  🚫 Yasak
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="healthScore">Sağlık Puanı</Label>
              <Input
                id="healthScore"
                type="number"
                min={0}
                max={100}
                value={form.healthScore}
                onChange={(e) => update({ healthScore: parseInt(e.target.value) || 0 })}
                aria-invalid={!!errors.healthScore}
              />
              {errors.healthScore && (
                <p className="text-xs text-destructive">{errors.healthScore}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bannedWordInput">Yasaklı Kelimeler</Label>
            <Input
              id="bannedWordInput"
              placeholder="Kelime yazıp Enter'a bas…"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
            />
            {form.bannedWords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {form.bannedWords.map((word) => (
                  <span
                    key={word}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground"
                  >
                    {word}
                    <button
                      type="button"
                      onClick={() => removeTag(word)}
                      className="ml-0.5 rounded-full text-muted-foreground hover:text-destructive transition-colors"
                      aria-label={`${word} kelimesini kaldır`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Faturalama Bilgileri */}
      <Card>
        <CardHeader>
          <CardTitle>Faturalama Bilgileri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="taxId">Vergi No (VKN / TCKN)</Label>
              <Input
                id="taxId"
                inputMode="numeric"
                placeholder="VKN: 10 hane, TCKN: 11 hane"
                value={form.taxId}
                onChange={(e) =>
                  // Sadece rakam kabul et (paste'te de filtrele).
                  update({ taxId: e.target.value.replace(/\D/g, "").slice(0, 11) })
                }
                aria-invalid={!!errors.taxId}
              />
              {errors.taxId && (
                <p className="text-xs text-destructive">{errors.taxId}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="taxOffice">Vergi Dairesi</Label>
              <Input
                id="taxOffice"
                value={form.taxOffice}
                onChange={(e) => update({ taxOffice: e.target.value })}
                placeholder="Örn. Beşiktaş"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="billingAddress">Fatura Adresi</Label>
            <textarea
              id="billingAddress"
              rows={3}
              value={form.billingAddress}
              onChange={(e) => update({ billingAddress: e.target.value })}
              placeholder="Tam adres (mahalle, sokak, no, ilçe, il, posta kodu)"
              className={cn(
                "h-auto w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none",
                "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                "resize-none"
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tehlikeli bölge */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Tehlikeli Bölge</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Müşteriyi sil</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Soft delete yapılır; ilgili projeler ve hesaplar ilişkili kalmaya devam eder.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className={cn(
                buttonVariants({ variant: "destructive", size: "sm" }),
                "gap-1.5"
              )}
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Sil
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Aksiyon butonları */}
      <div className="flex items-center justify-end gap-2">
        <Link
          href={`/musteriler/${id}`}
          className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
        >
          İptal
        </Link>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className={cn(buttonVariants(), "gap-1.5")}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          {submitting ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </div>
    </div>
  );
}
