/**
 * Yayın Planlayıcı — ana liste.
 *
 * İki süreci ayırma kararının arayüz tarafı:
 *  • /icerikler → ÜRETİM (brief, çekim, kurgu, onay akışı)
 *  • /yayin     → YAYIN (platform, caption, scheduledAt, gerçek post önizlemesi)
 *
 * Bu sayfa şunları gösterir:
 *  1. "Yayına hazır" kuyruğu — status >= APPROVED ama henüz ScheduledPost'u yok
 *  2. "Planlandı" — pending ScheduledPost'lar
 *  3. "Yayında / Geçti" — published ScheduledPost'lar (son 30 gün)
 */

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Camera,
  Globe2,
  Briefcase,
  Video as VideoIcon,
  PlaySquare,
  Plus,
  Zap,
  Play,
  Trash2,
  Pencil,
} from "lucide-react";

interface ReadyProject {
  id: string;
  title: string;
  status: string;
  postType: string;
  client: { id: string; name: string };
  files: { publicUrl: string; mimeType: string }[];
  caption: string | null;
}

interface ScheduledPostListItem {
  id: string;
  platform: string;
  scheduledAt: string;
  publishedAt: string | null;
  status: string;
  caption: string | null;
  hashtags: string[];
  lastError: string | null;
  retryCount: number;
  project: {
    id: string;
    title: string;
    postType: string;
    status: string;
    client: { id: string; name: string };
  };
}

const PLATFORM_ICON: Record<string, React.ElementType> = {
  INSTAGRAM: Camera,
  FACEBOOK: Globe2,
  TIKTOK: VideoIcon,
  LINKEDIN: Briefcase,
  YOUTUBE: PlaySquare,
};

const STATUS_BADGE: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
  pending: { label: "Planlandı", cls: "bg-blue-100 text-blue-700", Icon: Clock },
  publishing: { label: "Yayınlanıyor", cls: "bg-amber-100 text-amber-700", Icon: Loader2 },
  published: { label: "Yayında", cls: "bg-emerald-100 text-emerald-700", Icon: CheckCircle2 },
  failed: { label: "Hata", cls: "bg-rose-100 text-rose-700", Icon: AlertCircle },
};

export default function YayinPage() {
  const [ready, setReady] = useState<ReadyProject[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledPostListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Yayına hazır kartını listeden çıkar — soft-delete (deletedAt set).
  // Optimistic UI: önce listeden düşür, hata olursa geri al.
  async function deleteReady(p: ReadyProject) {
    if (!confirm(`"${p.title}" içeriğini silmek istiyor musun?\n\nBu işlem üretimi de kaldırır (soft-delete).`)) {
      return;
    }
    const prev = ready;
    setReady((rs) => rs.filter((r) => r.id !== p.id));
    setDeletingId(p.id);
    try {
      const res = await fetch(`/api/projects/${p.id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "Silme başarısız");
      toast.success(`"${p.title}" silindi`);
    } catch (e) {
      setReady(prev); // rollback
      toast.error(e instanceof Error ? e.message : "Silme başarısız");
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    Promise.all([
      // Yayına hazır: APPROVED+ statüsündeki projeler. Backend filtre: status,
      // sonra client-side scheduledPosts.length === 0 kontrolü yapıyoruz çünkü
      // /api/projects ScheduledPost ilişkisini include etmiyor — bu sayfadan
      // istenen "platform takıldı mı?" kontrolü için daha sade kalmasını seçtim.
      fetch("/api/projects?limit=100&status=APPROVED&includeQuickPublish=1").then((r) => r.json()),
      fetch("/api/scheduled-posts").then((r) => r.json()),
    ])
      .then(
        ([proj, sched]: [
          { data?: ReadyProject[] },
          { data?: ScheduledPostListItem[] },
        ]) => {
          // ScheduledPost'u olan projeleri "ready" listesinden çıkar
          const scheduledProjectIds = new Set((sched.data ?? []).map((s) => s.project.id));
          const filtered = (proj.data ?? []).filter((p) => !scheduledProjectIds.has(p.id));
          setReady(filtered);
          setScheduled(sched.data ?? []);
        }
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ScheduledPost'ları kategoriye ayır
  const upcoming = scheduled.filter((s) => s.status === "pending" || s.status === "publishing");
  const published = scheduled.filter((s) => s.status === "published");
  const failed = scheduled.filter((s) => s.status === "failed");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Send className="h-6 w-6" /> Yayın Planlayıcı
          </h1>
          <p className="text-sm text-muted-foreground">
            Onaylanmış içerikleri platformlara dağıt, gerçek post önizlemesiyle planla.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            href="/yayin/hizli"
            className={cn(
              buttonVariants({ variant: "default" }),
              "gap-1.5 bg-primary text-white hover:bg-primary/90"
            )}
            title="Üretim kaydı olmadan doğrudan yayın oluştur"
          >
            <Zap className="h-4 w-4" /> Hızlı Yayın
          </Link>
          <Link
            href="/yayin/yeni"
            className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
            title="Onaylı bir üretimden yayın planla"
          >
            <Plus className="h-4 w-4" /> Üretimden Planla
          </Link>
        </div>
      </div>

      {/* Yayına Hazır Kuyruğu */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Yayına Hazır
            <Badge variant="secondary" className="ml-1">
              {ready.length}
            </Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Üretimi tamamlanıp onaylanmış, henüz planlanmamış içerikler.
          </p>
        </CardHeader>
        <CardContent>
          {ready.length === 0 ? (
            <div className="py-6 text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Yayına hazır üretim yok.
              </p>
              <p className="text-xs text-muted-foreground">
                <Link href="/yayin/hizli" className="text-primary underline">
                  Hızlı Yayın
                </Link>{" "}
                ile üretim kaydı olmadan doğrudan yayın oluşturabilir, ya da{" "}
                <Link href="/icerikler/yeni" className="text-primary underline">
                  yeni bir üretim
                </Link>{" "}
                açıp APPROVED statüsüne getirebilirsin.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ready.map((p) => {
                // API bazı projelerde files alanını döndürmeyebilir
                // (legacy/eksik include) → defansif boş array.
                const thumb = (p.files ?? []).find((f) => f.mimeType.startsWith("image/"));
                const isDeleting = deletingId === p.id;
                return (
                  <div
                    key={p.id}
                    className="group relative rounded-xl border bg-card hover:border-primary hover:shadow-sm transition-all overflow-hidden"
                  >
                    <Link
                      href={`/yayin/yeni?projectId=${p.id}`}
                      className="block"
                    >
                      <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumb.publicUrl}
                            alt={p.title}
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground text-xs">
                            medya yok
                          </div>
                        )}
                        <div className="absolute top-2 right-2 rounded-md bg-background/90 backdrop-blur px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                          {p.postType}
                        </div>
                      </div>
                      <div className="p-3 space-y-1">
                        <div className="text-xs text-muted-foreground">{p.client.name}</div>
                        <div className="text-sm font-medium line-clamp-1 group-hover:text-primary">
                          {p.title}
                        </div>
                        <div className="flex items-center gap-1 pt-1 text-[11px] text-primary font-medium">
                          Yayına Hazırla →
                        </div>
                      </div>
                    </Link>

                    {/* Sil butonu — Link dışında, hover'da belirir */}
                    <button
                      type="button"
                      onClick={() => deleteReady(p)}
                      disabled={isDeleting}
                      title="İçeriği sil"
                      aria-label={`${p.title} içeriğini sil`}
                      className={cn(
                        "absolute top-2 left-2 inline-flex h-7 w-7 items-center justify-center",
                        "rounded-md bg-rose-600/90 text-white shadow-sm",
                        "opacity-0 group-hover:opacity-100 hover:bg-rose-700",
                        "transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                      )}
                    >
                      {isDeleting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Planlandı */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-blue-600" />
            Planlandı / Yayınlanıyor
            <Badge variant="secondary" className="ml-1">
              {upcoming.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Yaklaşan planlı yayın yok.
            </p>
          ) : (
            <ScheduledList items={upcoming} selectable />
          )}
        </CardContent>
      </Card>

      {/* Hatalı */}
      {failed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-4 w-4 text-rose-600" />
              Hatalı
              <Badge variant="secondary" className="ml-1">
                {failed.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScheduledList items={failed} selectable />
          </CardContent>
        </Card>
      )}

      {/* Yayında */}
      {published.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Yayında
              <Badge variant="secondary" className="ml-1">
                {published.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScheduledList items={published} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ScheduledList({
  items,
  selectable = false,
}: {
  items: ScheduledPostListItem[];
  selectable?: boolean;
}) {
  // Manuel tetikleme için "Şimdi gönder" — pending ve failed durumlarda görünür.
  // dispatchPublish atomic-claim yapıyor, cron aynı anda gelse bile çift
  // yayın olmaz. Dev'de cron hiç çalışmıyor, production'da en kötü 5dk
  // gecikme olabilir → bu buton iki ortamda da işe yarıyor.
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ScheduledPostListItem | null>(null);
  // Ref guard: setState async — iki hızlı tıklama React re-render etmeden
  // ikisi de busyId === null gördüğü için iki API çağrısı gidebilir.
  // ref synchronous update edilir → ikinci tıklama erken çıkar.
  const busyRef = useRef<string | null>(null);
  // Bulk selection: checkbox açıldığında seçilen id'ler. Sadece pending/failed
  // satırlar seçilebilir; published/publishing satırlar checkbox göstermez.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  async function bulkCancel() {
    if (selected.size === 0) return;
    if (
      !confirm(`${selected.size} yayın iptal edilecek. Devam edilsin mi?`)
    )
      return;
    setBulkBusy(true);
    try {
      const r = await fetch("/api/scheduled-posts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", ids: Array.from(selected) }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        deleted?: number;
        skipped?: { id: string; reason: string }[];
        error?: string;
      };
      if (!r.ok || !j.ok) throw new Error(j.error ?? "İşlem başarısız");
      const skipMsg = j.skipped && j.skipped.length > 0
        ? ` (${j.skipped.length} atlandı)`
        : "";
      toast.success(`${j.deleted ?? 0} yayın iptal edildi${skipMsg}`);
      window.location.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hata");
    } finally {
      setBulkBusy(false);
    }
  }

  async function publishNow(id: string, platform: string) {
    if (busyRef.current) return;
    busyRef.current = id;
    setBusyId(id);
    try {
      const r = await fetch("/api/meta/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledPostId: id }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (j.ok) {
        toast.success(`${platform}: yayınlandı`);
        // Listeyi tazele — basit yol: sayfa reload.
        window.location.reload();
      } else {
        toast.error(`${platform}: ${j.error ?? "yayınlanamadı"}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hata");
    } finally {
      busyRef.current = null;
      setBusyId(null);
    }
  }

  async function cancel(id: string, platform: string) {
    if (busyRef.current) return;
    if (!confirm(`${platform} yayınını iptal etmek istiyor musun?`)) return;
    busyRef.current = id;
    setBusyId(id);
    try {
      const r = await fetch(`/api/scheduled-posts/${id}`, { method: "DELETE" });
      const j = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (r.ok && j.ok) {
        toast.success(`${platform}: iptal edildi`);
        window.location.reload();
      } else {
        toast.error(j.error ?? "İptal edilemedi");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hata");
    } finally {
      busyRef.current = null;
      setBusyId(null);
    }
  }

  return (
    <div>
      {selectable && selected.size > 0 && (
        <div className="sticky top-0 z-10 -mx-2 mb-2 flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <div className="text-sm">
            <span className="font-medium">{selected.size}</span> yayın seçildi
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Seçimi temizle
            </button>
            <button
              type="button"
              onClick={bulkCancel}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {bulkBusy ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
              Toplu iptal
            </button>
          </div>
        </div>
      )}
      <div className="divide-y">
      {items.map((s) => {
        const Icon = PLATFORM_ICON[s.platform] ?? Send;
        const badge = STATUS_BADGE[s.status] ?? STATUS_BADGE.pending;
        const canTrigger = s.status === "pending" || s.status === "failed";
        return (
          <div key={s.id}>
          <div
            className="flex items-center gap-3 py-2.5 -mx-2 px-2 rounded transition-colors hover:bg-muted/40"
          >
            {selectable && canTrigger && (
              <input
                type="checkbox"
                checked={selected.has(s.id)}
                onChange={() => toggleSelect(s.id)}
                className="h-4 w-4 shrink-0 cursor-pointer rounded border-input accent-primary"
                aria-label={`${s.platform} yayınını seç`}
              />
            )}
            <Link
              href={`/icerikler/${s.project.id}`}
              className="flex flex-1 items-center gap-3 min-w-0"
            >
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{s.project.title}</div>
                <div className="text-xs text-muted-foreground">
                  {s.project.client.name} · {s.platform}
                </div>
              </div>
            </Link>
            <div className="text-right shrink-0">
              <div className="text-xs font-medium">
                {new Date(s.scheduledAt).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium mt-0.5",
                  badge.cls
                )}
              >
                <badge.Icon
                  className={cn("h-3 w-3", s.status === "publishing" && "animate-spin")}
                />
                {badge.label}
              </span>
            </div>
            {canTrigger && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => publishNow(s.id, s.platform)}
                  disabled={busyId === s.id}
                  title={
                    s.status === "failed"
                      ? "Yeniden dene"
                      : "Cron'u beklemeden hemen yayınla"
                  }
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-muted hover:border-primary/40 transition-colors disabled:opacity-50"
                >
                  {busyId === s.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                  Şimdi gönder
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(s)}
                  disabled={busyId === s.id}
                  title="Düzenle (caption / zaman)"
                  className="inline-flex items-center justify-center rounded-md border border-border bg-background p-1.5 text-muted-foreground hover:bg-muted hover:border-primary/40 hover:text-foreground transition-colors disabled:opacity-50"
                  aria-label="Düzenle"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => cancel(s.id, s.platform)}
                  disabled={busyId === s.id}
                  title="Bu yayını iptal et"
                  className="inline-flex items-center justify-center rounded-md border border-border bg-background p-1.5 text-muted-foreground hover:bg-rose-50 hover:border-rose-300 hover:text-rose-600 transition-colors disabled:opacity-50"
                  aria-label="İptal"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
          {s.status === "failed" && s.lastError && (
            <ErrorRow msg={s.lastError} retryCount={s.retryCount} />
          )}
          </div>
        );
      })}
      </div>
      {editing && (
        <EditScheduledPostModal
          post={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

// ─── lastError satırı ──────────────────────────────────────────────────────
// Failed durumdaki postlar için satırın altında hata mesajını gösterir.
// 200 karakterden uzunsa kısaltılır, hover'da tam metin tooltip'te durur.
function ErrorRow({ msg, retryCount }: { msg: string; retryCount: number }) {
  const short = msg.length > 200 ? msg.slice(0, 200) + "…" : msg;
  return (
    <div
      title={msg}
      className="ml-11 mr-2 mb-2 -mt-1 rounded border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-800 leading-snug"
    >
      <span className="font-medium">Hata{retryCount > 0 && ` (${retryCount}. deneme)`}:</span>{" "}
      {short}
    </div>
  );
}

// ─── Düzenleme modal'ı ─────────────────────────────────────────────────────
// PATCH /api/scheduled-posts/:id ile caption/hashtags/scheduledAt günceller.
function EditScheduledPostModal({
  post,
  onClose,
  onSaved,
}: {
  post: ScheduledPostListItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [caption, setCaption] = useState(post.caption ?? "");
  const [hashtags, setHashtags] = useState(post.hashtags.join(" "));
  const [scheduledAt, setScheduledAt] = useState(() => {
    // ISO → datetime-local formatı (YYYY-MM-DDTHH:mm yerel saat)
    const d = new Date(post.scheduledAt);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const tags = hashtags
        .split(/\s+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => (t.startsWith("#") ? t : `#${t}`));
      const r = await fetch(`/api/scheduled-posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption,
          hashtags: tags,
          scheduledAt: new Date(scheduledAt).toISOString(),
        }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        data?: unknown;
        error?: string;
      };
      if (!r.ok) throw new Error(j.error ?? "Güncellenemedi");
      toast.success("Güncellendi");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hata");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-card border shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <div className="text-sm font-semibold">{post.platform} · Yayını Düzenle</div>
            <div className="text-xs text-muted-foreground">{post.project.title}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Kapat"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium" htmlFor="ed-caption">
              Caption
            </label>
            <textarea
              id="ed-caption"
              rows={5}
              maxLength={2200}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <div className="text-[10px] text-muted-foreground text-right">
              {caption.length}/2200
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium" htmlFor="ed-tags">
              Hashtag&apos;ler (boşlukla ayır)
            </label>
            <input
              id="ed-tags"
              type="text"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="#etiket1 #etiket2"
              className="w-full h-8 rounded-md border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium" htmlFor="ed-sched">
              Yayın Tarihi & Saati
            </label>
            <input
              id="ed-sched"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full h-8 rounded-md border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className={cn(
              buttonVariants({ variant: "default", size: "sm" }),
              "bg-primary text-white hover:bg-primary/90"
            )}
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
