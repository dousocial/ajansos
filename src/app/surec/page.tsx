"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Plus, Loader2, Workflow, Search, ExternalLink, Check, X, ChevronDown,
} from "lucide-react";

// ─── Türler ──────────────────────────────────────────────────────────────────

const PURPOSE_OPTIONS = [
  { value: "BILGI", label: "Bilgi" },
  { value: "EGLENCE", label: "Eğlence" },
  { value: "TANITIM", label: "Tanıtım" },
  { value: "KAMPANYA", label: "Kampanya" },
  { value: "POST", label: "Post" },
] as const;

type Purpose = typeof PURPOSE_OPTIONS[number]["value"];

interface ProjectRow {
  id: string;
  title: string;
  status: string;
  publishAt: string | null;
  shootDate: string | null;
  purposes: Purpose[];
  briefDone: boolean;
  shootingDone: boolean;
  editingDone: boolean;
  adRequired: boolean;
  adPosted: boolean;
  client: { id: string; name: string };
  // En son hangi kullanıcı bu projeye dokundu — satır sonunda görünür.
  lastActor: { id: string; name: string; image: string | null } | null;
}

interface ClientLite {
  id: string;
  name: string;
}

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

// HTML datetime-local için ISO → "YYYY-MM-DDTHH:MM" (yerel)
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Kullanıcı yerel saat verir → UTC ISO (yyyy-mm-ddThh:mm:ss.sssZ)
function localInputToISO(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// ─── Çoklu seçim dropdown'u ──────────────────────────────────────────────────

function PurposeMultiSelect({
  value,
  onChange,
  disabled,
}: {
  value: Purpose[];
  onChange: (v: Purpose[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={cn(
          "inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-xs min-w-[110px] justify-between",
          "hover:bg-muted transition-colors disabled:opacity-50"
        )}
      >
        <span className="truncate">
          {value.length === 0
            ? <span className="text-muted-foreground">Amaç seç</span>
            : value.map((v) => PURPOSE_OPTIONS.find((p) => p.value === v)?.label).join(", ")}
        </span>
        <ChevronDown className="h-3 w-3 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-44 rounded-lg border border-border bg-card shadow-lg p-1">
          {PURPOSE_OPTIONS.map((opt) => {
            const checked = value.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault(); // blur'ı engelle
                  const next = checked
                    ? value.filter((v) => v !== opt.value)
                    : [...value, opt.value];
                  onChange(next);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted",
                  checked && "bg-primary/5 text-primary"
                )}
              >
                <span className={cn(
                  "flex h-3.5 w-3.5 items-center justify-center rounded border",
                  checked ? "bg-primary border-primary text-white" : "border-border"
                )}>
                  {checked && <Check className="h-2.5 w-2.5" />}
                </span>
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Checkbox hücresi ────────────────────────────────────────────────────────

function CheckCell({
  checked,
  onChange,
  disabled,
  tone = "primary",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  tone?: "primary" | "emerald" | "amber" | "destructive";
}) {
  const toneClass =
    tone === "emerald"
      ? "bg-emerald-500 border-emerald-500"
      : tone === "amber"
      ? "bg-amber-500 border-amber-500"
      : tone === "destructive"
      ? "bg-destructive border-destructive"
      : "bg-primary border-primary";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded border transition-all",
        checked ? `${toneClass} text-white` : "border-border bg-card hover:border-primary/50",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {checked && <Check className="h-3 w-3" />}
    </button>
  );
}

// ─── Sayfa ───────────────────────────────────────────────────────────────────

export default function SurecPage() {
  const { data: session } = useSession();
  const me = session?.user as { id?: string; name?: string | null; image?: string | null } | undefined;
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Üstte yeni satır
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState({
    title: "",
    clientId: "",
    purposes: [] as Purpose[],
    shootDate: "",
    publishAt: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // Per-row pending state — optimistic update'lerin görsel kilidi.
  const [pending, setPending] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [resP, resC] = await Promise.all([
          fetch("/api/projects?limit=100", { cache: "no-store" }),
          fetch("/api/clients?limit=100", { cache: "no-store" }),
        ]);
        if (!resP.ok) throw new Error("İçerikler yüklenemedi");
        if (!resC.ok) throw new Error("Müşteriler yüklenemedi");
        const pj = (await resP.json()) as { data: ProjectRow[] };
        const cj = (await resC.json()) as { data: ClientLite[] };
        if (!cancelled) {
          setRows(pj.data ?? []);
          setClients(cj.data ?? []);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Bilinmeyen hata");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows
      .filter((r) =>
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.client.name.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        // En son güncellenenler / yakın tarihliler üstte (publishAt asc null sona).
        const at = a.publishAt ? new Date(a.publishAt).getTime() : Number.POSITIVE_INFINITY;
        const bt = b.publishAt ? new Date(b.publishAt).getTime() : Number.POSITIVE_INFINITY;
        return at - bt;
      });
  }, [rows, search]);

  // ─── Inline patch ─────────────────────────────────────────────────────────

  async function patchRow(id: string, patch: Partial<ProjectRow> & { status?: string; shootDate?: string | null; publishAt?: string | null }) {
    setPending((p) => ({ ...p, [id]: true }));
    // Optimistic: önceden uygula, hata varsa geri al.
    // lastActor anında current user'a set ediliyor — kullanıcı tıklar tıklamaz
    // satır sonunda kendi adını görür (backend yanıtı beklemez).
    const prev = rows.find((r) => r.id === id);
    const optimisticActor = me?.id
      ? { id: me.id, name: me.name ?? "(siz)", image: me.image ?? null }
      : null;
    setRows((rs) =>
      rs.map((r) =>
        r.id === id
          ? ({
              ...r,
              ...patch,
              lastActor: optimisticActor ?? r.lastActor,
            } as ProjectRow)
          : r
      )
    );
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Güncelleme başarısız");
      }
      // Backend de lastActor döner — kullansak rollback'siz, ama optimistic
      // sürüm zaten doğru; ekstra refetch'e gerek yok.
    } catch (e) {
      // Geri al
      if (prev) {
        setRows((rs) => rs.map((r) => (r.id === id ? prev : r)));
      }
      toast.error(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setPending((p) => {
        const { [id]: _, ...rest } = p;
        void _;
        return rest;
      });
    }
  }

  // ─── Yeni satır ekle ─────────────────────────────────────────────────────

  async function handleAdd() {
    if (!newRow.title.trim() || !newRow.clientId) {
      toast.error("Başlık ve müşteri zorunlu");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: newRow.clientId,
          title: newRow.title.trim(),
          status: "PLANNED",
          platforms: ["INSTAGRAM"], // varsayılan
          postType: "IMAGE",
          shootDate: localInputToISO(newRow.shootDate) ?? undefined,
          publishAt: localInputToISO(newRow.publishAt) ?? undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Kayıt başarısız");
      }
      const json = (await res.json()) as { data: ProjectRow };
      // Patch: amaç da ayrıca PATCH ile gönderilir (POST schema henüz purposes kabul etmiyor).
      if (newRow.purposes.length > 0) {
        await fetch(`/api/projects/${json.data.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ purposes: newRow.purposes }),
        });
      }
      // Yeni satır en üste ekle
      setRows((rs) => [
        {
          ...json.data,
          purposes: newRow.purposes,
          briefDone: false,
          shootingDone: false,
          editingDone: false,
          adRequired: false,
          adPosted: false,
          // Backend lastActorId set ediyor; UI da hemen göstersin diye optimistic.
          lastActor: me?.id
            ? { id: me.id, name: me.name ?? "(siz)", image: me.image ?? null }
            : json.data.lastActor ?? null,
        },
        ...rs,
      ]);
      setNewRow({ title: "", clientId: "", purposes: [], shootDate: "", publishAt: "" });
      setAdding(false);
      toast.success("İçerik eklendi");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setSubmitting(false);
    }
  }

  // Yardımcılar — checkbox'ların durum karşılıkları
  const isScheduled = (r: ProjectRow) =>
    r.status === "APPROVED" && !!r.publishAt && new Date(r.publishAt) > new Date();
  const isPublished = (r: ProjectRow) => r.status === "LIVE" || r.status === "PUBLISHED";

  return (
    <div className="space-y-5">
      {/* Başlık */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Workflow className="h-6 w-6 text-primary" />
            Süreç Yönetimi
          </h1>
          <p className="text-sm text-muted-foreground">
            Üretim aşamalarını ve yayın akışını tek tabloda yönet.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 w-44"
            />
          </div>
          <button
            type="button"
            onClick={() => setAdding((a) => !a)}
            className={cn(
              buttonVariants({ size: "sm" }),
              "gap-1.5 bg-primary text-white hover:bg-primary/90"
            )}
          >
            <Plus className="h-3.5 w-3.5" /> Yeni Satır
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive font-medium">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Yükleniyor…
        </div>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">İçerik</th>
                  <th className="text-left px-3 py-2 font-medium">Amaç</th>
                  <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Çekim Günü/Saati</th>
                  <th className="text-center px-2 py-2 font-medium">Brief</th>
                  <th className="text-center px-2 py-2 font-medium">Çekim</th>
                  <th className="text-center px-2 py-2 font-medium">Kurgu</th>
                  <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Paylaşım Günü</th>
                  <th className="text-center px-2 py-2 font-medium">Planlandı</th>
                  <th className="text-center px-2 py-2 font-medium">Paylaşıldı</th>
                  <th className="text-center px-2 py-2 font-medium">Reklam</th>
                  <th className="text-right px-3 py-2 font-medium">İşlem</th>
                  <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Son</th>
                </tr>
              </thead>
              <tbody>
                {/* Yeni satır formu */}
                {adding && (
                  <tr className="bg-primary/5 border-y-2 border-primary/30">
                    <td className="px-3 py-2 align-top">
                      <div className="space-y-1">
                        <Input
                          placeholder="İçerik başlığı"
                          value={newRow.title}
                          onChange={(e) => setNewRow((r) => ({ ...r, title: e.target.value }))}
                          className="h-8 text-xs"
                        />
                        <select
                          value={newRow.clientId}
                          onChange={(e) => setNewRow((r) => ({ ...r, clientId: e.target.value }))}
                          className="h-8 w-full rounded-lg border border-border bg-card px-2 text-xs"
                        >
                          <option value="">Müşteri seç…</option>
                          {clients.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <PurposeMultiSelect
                        value={newRow.purposes}
                        onChange={(v) => setNewRow((r) => ({ ...r, purposes: v }))}
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <Input
                        type="datetime-local"
                        value={newRow.shootDate}
                        onChange={(e) => setNewRow((r) => ({ ...r, shootDate: e.target.value }))}
                        className="h-8 text-xs w-[200px]"
                      />
                    </td>
                    <td colSpan={3} className="px-2 py-2 text-center text-[10px] text-muted-foreground">
                      Kayıttan sonra
                    </td>
                    <td className="px-3 py-2 align-top">
                      <Input
                        type="datetime-local"
                        value={newRow.publishAt}
                        onChange={(e) => setNewRow((r) => ({ ...r, publishAt: e.target.value }))}
                        className="h-8 text-xs w-[200px]"
                      />
                    </td>
                    <td colSpan={3} className="px-2 py-2 text-center text-[10px] text-muted-foreground">
                      —
                    </td>
                    <td className="px-3 py-2 align-top text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={handleAdd}
                          disabled={submitting}
                          className={cn(
                            buttonVariants({ size: "sm" }),
                            "h-7 gap-1 bg-primary text-white hover:bg-primary/90"
                          )}
                        >
                          {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          Kaydet
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAdding(false);
                            setNewRow({ title: "", clientId: "", purposes: [], shootDate: "", publishAt: "" });
                          }}
                          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7")}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top text-[10px] text-muted-foreground">—</td>
                  </tr>
                )}

                {filtered.length === 0 && !adding && (
                  <tr>
                    <td colSpan={12} className="px-3 py-10 text-center text-muted-foreground">
                      <Workflow className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">İçerik yok</p>
                      <p className="text-xs">Yeni satır ekleyerek başlayın.</p>
                    </td>
                  </tr>
                )}

                {filtered.map((r) => {
                  const busy = !!pending[r.id];
                  const scheduled = isScheduled(r);
                  const published = isPublished(r);
                  return (
                    <tr key={r.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                      {/* İçerik */}
                      <td className="px-3 py-2 align-middle min-w-[180px]">
                        <Link
                          href={`/icerikler/${r.id}`}
                          className="text-sm font-medium hover:text-primary transition-colors line-clamp-1"
                        >
                          {r.title}
                        </Link>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {r.client.name}
                        </p>
                      </td>

                      {/* Amaç */}
                      <td className="px-3 py-2 align-middle">
                        <PurposeMultiSelect
                          value={r.purposes}
                          disabled={busy}
                          onChange={(v) => patchRow(r.id, { purposes: v })}
                        />
                      </td>

                      {/* Çekim günü */}
                      <td className="px-3 py-2 align-middle">
                        <Input
                          type="datetime-local"
                          value={isoToLocalInput(r.shootDate)}
                          disabled={busy}
                          onChange={(e) => {
                            const iso = localInputToISO(e.target.value);
                            patchRow(r.id, { shootDate: iso });
                          }}
                          className="h-7 text-xs w-[200px]"
                        />
                      </td>

                      {/* Brief / Çekim / Kurgu */}
                      <td className="px-2 py-2 text-center align-middle">
                        <CheckCell
                          checked={r.briefDone}
                          disabled={busy}
                          onChange={(v) => patchRow(r.id, { briefDone: v })}
                        />
                      </td>
                      <td className="px-2 py-2 text-center align-middle">
                        <CheckCell
                          checked={r.shootingDone}
                          disabled={busy}
                          tone="amber"
                          onChange={(v) => patchRow(r.id, { shootingDone: v })}
                        />
                      </td>
                      <td className="px-2 py-2 text-center align-middle">
                        <CheckCell
                          checked={r.editingDone}
                          disabled={busy}
                          tone="primary"
                          onChange={(v) => patchRow(r.id, { editingDone: v })}
                        />
                      </td>

                      {/* Paylaşım günü */}
                      <td className="px-3 py-2 align-middle">
                        <Input
                          type="datetime-local"
                          value={isoToLocalInput(r.publishAt)}
                          disabled={busy}
                          onChange={(e) => {
                            const iso = localInputToISO(e.target.value);
                            patchRow(r.id, { publishAt: iso });
                          }}
                          className="h-7 text-xs w-[200px]"
                        />
                      </td>

                      {/* Planlandı = APPROVED + future publishAt */}
                      <td className="px-2 py-2 text-center align-middle">
                        <CheckCell
                          checked={scheduled}
                          disabled={busy || !r.publishAt || published}
                          tone="emerald"
                          onChange={(v) => {
                            if (v) {
                              if (!r.publishAt) {
                                toast.error("Önce paylaşım günü seçin");
                                return;
                              }
                              patchRow(r.id, { status: "APPROVED" });
                            } else {
                              // Geri planned'a çek
                              patchRow(r.id, { status: "PLANNED" });
                            }
                          }}
                        />
                      </td>

                      {/* Paylaşıldı = LIVE */}
                      <td className="px-2 py-2 text-center align-middle">
                        <CheckCell
                          checked={published}
                          disabled={busy}
                          tone="emerald"
                          onChange={(v) => {
                            patchRow(r.id, { status: v ? "LIVE" : (scheduled ? "APPROVED" : "PLANNED") });
                          }}
                        />
                      </td>

                      {/* Reklam */}
                      <td className="px-2 py-2 text-center align-middle">
                        <CheckCell
                          checked={r.adPosted}
                          disabled={busy}
                          tone="destructive"
                          onChange={(v) => patchRow(r.id, { adPosted: v, adRequired: true })}
                        />
                      </td>

                      {/* İşlem */}
                      <td className="px-3 py-2 align-middle text-right whitespace-nowrap">
                        <Link
                          href={`/yayin/yeni?projectId=${r.id}`}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "h-7 gap-1 text-xs"
                          )}
                        >
                          <ExternalLink className="h-3 w-3" /> İçeriği Hazırla
                        </Link>
                      </td>

                      {/* Son müdahale eden — patchRow optimistic olarak günceller */}
                      <td className="px-3 py-2 align-middle whitespace-nowrap">
                        {r.lastActor ? (
                          <span
                            className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
                            title={`Son düzenleyen: ${r.lastActor.name}`}
                          >
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
                              {r.lastActor.name?.[0]?.toUpperCase() ?? "?"}
                            </span>
                            <span>{r.lastActor.name}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground/50">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Lejant */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <Badge variant="outline" className="gap-1">
            <span className="h-2 w-2 rounded-full bg-primary" /> Brief
          </Badge>
          <Badge variant="outline" className="gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> Çekim
          </Badge>
          <Badge variant="outline" className="gap-1">
            <span className="h-2 w-2 rounded-full bg-primary" /> Kurgu
          </Badge>
          <Badge variant="outline" className="gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Planlandı / Paylaşıldı
          </Badge>
          <Badge variant="outline" className="gap-1">
            <span className="h-2 w-2 rounded-full bg-destructive" /> Reklam çıkıldı
          </Badge>
          <span className="ml-auto text-[11px] text-muted-foreground">
            Tüm değişiklikler otomatik kaydedilir
          </span>
        </div>
      </Card>
    </div>
  );
}
