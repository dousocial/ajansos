"use client";

import { useState, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button";
import { cn, slugify } from "@/lib/utils";
import {
  Camera,
  Globe2,
  TrendingUp,
  Briefcase,
  Play,
  Send,
  X,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Platform =
  | "INSTAGRAM"
  | "FACEBOOK"
  | "TIKTOK"
  | "LINKEDIN"
  | "YOUTUBE"
  | "TWITTER";

interface FormData {
  // Step 1
  name: string;
  industry: string;
  slug: string;
  contactName: string;
  email: string;
  phone: string;
  // Step 2
  brandVoice: string;
  revisionQuota: number;
  emojiPolicy: "allow" | "deny";
  bannedWords: string[];
  // Step 3
  platforms: Platform[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { label: "Temel Bilgiler" },
  { label: "Marka Ayarları" },
  { label: "Platformlar" },
];

const PLATFORM_CONFIG: {
  id: Platform;
  label: string;
  Icon: React.ElementType;
}[] = [
  { id: "INSTAGRAM", label: "Instagram", Icon: Camera },
  { id: "FACEBOOK", label: "Facebook", Icon: Globe2 },
  { id: "TIKTOK", label: "TikTok", Icon: TrendingUp },
  { id: "LINKEDIN", label: "LinkedIn", Icon: Briefcase },
  { id: "YOUTUBE", label: "YouTube", Icon: Play },
  { id: "TWITTER", label: "Twitter", Icon: Send },
];

const INITIAL_FORM: FormData = {
  name: "",
  industry: "",
  slug: "",
  contactName: "",
  email: "",
  phone: "",
  brandVoice: "",
  revisionQuota: 3,
  emojiPolicy: "allow",
  bannedWords: [],
  platforms: [],
};

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((step, idx) => {
        const stepNum = idx + 1;
        const isActive = stepNum === current;
        const isDone = stepNum < current;
        return (
          <div key={step.label} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : isDone
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground"
                )}
              >
                {isDone ? <Check className="h-4 w-4" /> : stepNum}
              </div>
              <span
                className={cn(
                  "text-xs font-medium whitespace-nowrap",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-16 mx-2 mb-5 transition-colors",
                  isDone ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Temel Bilgiler ───────────────────────────────────────────────────

function Step1({
  data,
  onChange,
  errors,
}: {
  data: FormData;
  onChange: (patch: Partial<FormData>) => void;
  errors: Record<string, string>;
}) {
  const handleNameChange = (value: string) => {
    onChange({ name: value, slug: slugify(value) });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Ad */}
        <div className="space-y-1.5">
          <Label htmlFor="name">
            Müşteri Adı <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            placeholder="Coffee House"
            value={data.name}
            onChange={(e) => handleNameChange(e.target.value)}
            aria-invalid={!!errors.name}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name}</p>
          )}
        </div>

        {/* Sektör */}
        <div className="space-y-1.5">
          <Label htmlFor="industry">
            Sektör <span className="text-destructive">*</span>
          </Label>
          <Input
            id="industry"
            placeholder="F&B, Teknoloji, Kozmetik…"
            value={data.industry}
            onChange={(e) => onChange({ industry: e.target.value })}
            aria-invalid={!!errors.industry}
          />
          {errors.industry && (
            <p className="text-xs text-destructive">{errors.industry}</p>
          )}
        </div>
      </div>

      {/* Slug */}
      <div className="space-y-1.5">
        <Label htmlFor="slug">Slug (URL kısaltması)</Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            /musteriler/
          </span>
          <Input
            id="slug"
            placeholder="coffee-house"
            value={data.slug}
            onChange={(e) => onChange({ slug: e.target.value })}
            className="font-mono text-sm"
          />
        </div>
      </div>

      <hr className="border-border" />

      <p className="text-sm font-medium text-muted-foreground">
        Yetkili Kişi (İsteğe bağlı)
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="contactName">Ad Soyad</Label>
          <Input
            id="contactName"
            placeholder="Selin Kaya"
            value={data.contactName}
            onChange={(e) => onChange({ contactName: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">E-posta</Label>
          <Input
            id="email"
            type="email"
            placeholder="selin@firma.com"
            value={data.email}
            onChange={(e) => onChange({ email: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Telefon</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+90 555 000 00 00"
            value={data.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Marka Ayarları ───────────────────────────────────────────────────

function Step2({
  data,
  onChange,
}: {
  data: FormData;
  onChange: (patch: Partial<FormData>) => void;
}) {
  const [tagInput, setTagInput] = useState("");

  const addTag = (word: string) => {
    const trimmed = word.trim().toLowerCase();
    if (trimmed && !data.bannedWords.includes(trimmed)) {
      onChange({ bannedWords: [...data.bannedWords, trimmed] });
    }
    setTagInput("");
  };

  const removeTag = (word: string) => {
    onChange({ bannedWords: data.bannedWords.filter((w) => w !== word) });
  };

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(tagInput);
    }
  };

  return (
    <div className="space-y-6">
      {/* Marka sesi */}
      <div className="space-y-1.5">
        <Label htmlFor="brandVoice">Marka Sesi</Label>
        <textarea
          id="brandVoice"
          maxLength={500}
          rows={4}
          placeholder="Markamız samimi, enerjik ve genç bir dil kullanır. Teknik jargondan kaçınırız…"
          value={data.brandVoice}
          onChange={(e) => onChange({ brandVoice: e.target.value })}
          className={cn(
            "h-auto w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none",
            "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 resize-none"
          )}
        />
        <p className="text-xs text-muted-foreground text-right">
          {data.brandVoice.length}/500
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Revizyon kotası */}
        <div className="space-y-1.5">
          <Label htmlFor="revisionQuota">Revizyon Kotası (1–10)</Label>
          <Input
            id="revisionQuota"
            type="number"
            min={1}
            max={10}
            value={data.revisionQuota}
            onChange={(e) =>
              onChange({
                revisionQuota: Math.min(
                  10,
                  Math.max(1, parseInt(e.target.value) || 1)
                ),
              })
            }
            className="w-24"
          />
          <p className="text-xs text-muted-foreground">
            İçerik başına maksimum revizyon hakkı
          </p>
        </div>

        {/* Emoji politikası */}
        <div className="space-y-2">
          <Label>Emoji Politikası</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onChange({ emojiPolicy: "allow" })}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                data.emojiPolicy === "allow" &&
                  "border-primary bg-primary/10 text-primary"
              )}
            >
              😊 İzin Ver
            </button>
            <button
              type="button"
              onClick={() => onChange({ emojiPolicy: "deny" })}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                data.emojiPolicy === "deny" &&
                  "border-destructive bg-destructive/10 text-destructive"
              )}
            >
              🚫 Yasak
            </button>
          </div>
        </div>
      </div>

      {/* Yasaklı kelimeler */}
      <div className="space-y-2">
        <Label htmlFor="bannedWordInput">Yasaklı Kelimeler</Label>
        <Input
          id="bannedWordInput"
          placeholder="Kelime yazıp Enter'a bas…"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={handleTagKeyDown}
        />
        {data.bannedWords.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {data.bannedWords.map((word) => (
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
        <p className="text-xs text-muted-foreground">
          İçeriklerde kullanılmaması gereken kelimeler
        </p>
      </div>
    </div>
  );
}

// ─── Step 3: Platformlar ──────────────────────────────────────────────────────

function Step3({
  data,
  onChange,
  error,
}: {
  data: FormData;
  onChange: (patch: Partial<FormData>) => void;
  error?: string;
}) {
  const togglePlatform = (platform: Platform) => {
    const current = data.platforms;
    const next = current.includes(platform)
      ? current.filter((p) => p !== platform)
      : [...current, platform];
    onChange({ platforms: next });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Müşterinin aktif olacağı platformları seçin. En az 1 platform zorunludur.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {PLATFORM_CONFIG.map(({ id, label, Icon }) => {
          const isSelected = data.platforms.includes(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => togglePlatform(id)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-5 transition-all",
                isSelected
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-muted/50"
              )}
            >
              {isSelected && (
                <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-2.5 w-2.5" />
                </span>
              )}
              <Icon className="h-6 w-6" />
              <span className="text-xs font-semibold tracking-wide">{label}</span>
            </button>
          );
        })}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function YeniMusteriPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const updateForm = (patch: Partial<FormData>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const validateStep = (stepNum: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (stepNum === 1) {
      if (!form.name.trim()) newErrors.name = "Müşteri adı zorunludur.";
      if (!form.industry.trim()) newErrors.industry = "Sektör zorunludur.";
    }

    if (stepNum === 3) {
      if (form.platforms.length === 0)
        newErrors.platforms = "En az 1 platform seçilmelidir.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(step)) return;
    setErrors({});
    setStep((s) => Math.min(s + 1, 3));
  };

  const handleBack = () => {
    setErrors({});
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          industry: form.industry || undefined,
          contactName: form.contactName || undefined,
          contactEmail: form.email || undefined,
          contactPhone: form.phone || undefined,
          brandVoice: form.brandVoice || undefined,
          bannedWords: form.bannedWords,
          emojiPolicy: form.emojiPolicy === "allow",
          revisionQuota: form.revisionQuota,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Müşteri oluşturulamadı");
      }
      toast.success("Müşteri oluşturuldu");
      router.push("/musteriler");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-2">
      {/* Sayfa başlığı */}
      <div>
        <h1 className="text-2xl font-bold">Yeni Müşteri</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Birkaç adımda yeni müşterinizi sisteme ekleyin.
        </p>
      </div>

      {/* Step indicator */}
      <StepIndicator current={step} />

      {/* Form kartı */}
      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step - 1].label}</CardTitle>
        </CardHeader>
        <CardContent className="pb-6">
          {step === 1 && (
            <Step1 data={form} onChange={updateForm} errors={errors} />
          )}
          {step === 2 && <Step2 data={form} onChange={updateForm} />}
          {step === 3 && (
            <Step3
              data={form}
              onChange={updateForm}
              error={errors.platforms}
            />
          )}
        </CardContent>
      </Card>

      {/* Navigasyon butonları */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          disabled={step === 1}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "gap-1.5",
            step === 1 && "invisible"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
          Geri
        </button>

        <span className="text-xs text-muted-foreground">
          {step} / {STEPS.length}
        </span>

        {step < 3 ? (
          <button
            type="button"
            onClick={handleNext}
            className={cn(buttonVariants(), "gap-1.5")}
          >
            İleri
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
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
            {submitting ? "Oluşturuluyor..." : "Oluştur"}
          </button>
        )}
      </div>
    </div>
  );
}
