/**
 * Aktivite akışı — ekibin platform üzerinde yaptığı işlemlerin tarihçesi.
 *
 * ActivityLog tablosundan beslenir. Filtre: action prefix (project.* / publish.*)
 * + sayfalama. CLIENT rolü erişemez.
 *
 * MVP: read-only stream. İleride export (CSV) + entity-spesifik filtreler eklenebilir.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  Send,
  FileEdit,
  Trash2,
  Plus,
  Loader2,
  ChevronDown,
} from "lucide-react";

interface ActivityItem {
  id: string;
  action: string;
  details: Record<string, unknown> | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
  project: { id: string; title: string } | null;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const ACTION_FILTERS: { label: string; value: string }[] = [
  { label: "Tümü", value: "" },
  { label: "İçerik", value: "project." },
  { label: "Yayın", value: "publish." },
  { label: "Müşteri", value: "client." },
  { label: "Fatura", value: "invoice." },
  { label: "Görev", value: "task." },
];

function actionMeta(action: string) {
  if (action.endsWith(".created"))
    return { Icon: Plus, color: "text-emerald-600", bg: "bg-emerald-50" };
  if (action.endsWith(".updated"))
    return { Icon: FileEdit, color: "text-blue-600", bg: "bg-blue-50" };
  if (action.endsWith(".deleted"))
    return { Icon: Trash2, color: "text-rose-600", bg: "bg-rose-50" };
  if (action.startsWith("publish."))
    return { Icon: Send, color: "text-indigo-600", bg: "bg-indigo-50" };
  if (action.includes("approved"))
    return { Icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" };
  if (action.includes("failed"))
    return { Icon: AlertCircle, color: "text-rose-600", bg: "bg-rose-50" };
  return { Icon: Activity, color: "text-muted-foreground", bg: "bg-muted" };
}

function relTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "az önce";
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} saat önce`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} gün önce`;
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AktivitePage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (filter) params.set("action", filter);
    fetch(`/api/activity?${params.toString()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((j: { data: ActivityItem[]; meta: Meta }) => {
        setItems(j.data);
        setMeta(j.meta);
      })
      .catch(() => toast.error("Aktivite akışı yüklenemedi"))
      .finally(() => setLoading(false));
  }, [filter, page]);

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Activity className="h-5 w-5" /> Aktivite Akışı
        </h1>
        <p className="text-sm text-muted-foreground">
          Ekibin platform üzerinde yaptığı işlemler. Audit trail için kullanılır.
        </p>
      </div>

      {/* Filtre çipleri */}
      <div className="flex items-center gap-2 flex-wrap">
        {ACTION_FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <button
              key={f.value || "all"}
              type="button"
              onClick={() => {
                setFilter(f.value);
                setPage(1);
              }}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Olaylar</span>
            {meta && (
              <span className="text-xs font-normal text-muted-foreground">
                Toplam {meta.total}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Bu filtreyle eşleşen aktivite yok.
            </div>
          ) : (
            <ol className="divide-y">
              {items.map((it) => {
                const meta = actionMeta(it.action);
                const Icon = meta.Icon;
                return (
                  <li key={it.id} className="py-2.5 flex items-start gap-3">
                    <div
                      className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                        meta.bg
                      )}
                    >
                      <Icon className={cn("h-4 w-4", meta.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">
                        <span className="font-medium">
                          {it.user?.name ?? it.user?.email ?? "Sistem"}
                        </span>{" "}
                        <span className="text-muted-foreground">
                          {humanAction(it.action)}
                        </span>
                        {it.project && (
                          <>
                            {" "}
                            <Link
                              href={`/icerikler/${it.project.id}`}
                              className="text-primary hover:underline"
                            >
                              {it.project.title}
                            </Link>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{relTime(it.createdAt)}</span>
                        <code className="font-mono text-[10px] bg-muted px-1 rounded">
                          {it.action}
                        </code>
                      </div>
                      {it.details && Object.keys(it.details).length > 0 && (
                        <details className="mt-1.5 text-xs">
                          <summary className="cursor-pointer inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                            <ChevronDown className="h-3 w-3" /> detaylar
                          </summary>
                          <pre className="mt-1 p-2 bg-muted rounded text-[10px] overflow-x-auto max-w-full">
                            {JSON.stringify(it.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* Sayfalama */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Sayfa {meta.page} / {meta.totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={meta.page <= 1 || loading}
              className="text-xs border rounded px-3 py-1 disabled:opacity-50 hover:bg-muted"
            >
              ← Önceki
            </button>
            <button
              type="button"
              onClick={() =>
                setPage((p) => Math.min(meta.totalPages, p + 1))
              }
              disabled={meta.page >= meta.totalPages || loading}
              className="text-xs border rounded px-3 py-1 disabled:opacity-50 hover:bg-muted"
            >
              Sonraki →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// action string'lerini insan dilinde TR'ye çevir.
function humanAction(action: string): string {
  const map: Record<string, string> = {
    "project.created": "yeni içerik oluşturdu:",
    "project.updated": "içeriği güncelledi:",
    "project.deleted": "içeriği sildi:",
    "project.status_changed": "içerik durumunu değiştirdi:",
    "publish.created": "yayın planladı:",
    "publish.published": "yayını gönderdi:",
    "publish.failed": "yayını başarısız oldu:",
    "publish.cancelled": "yayını iptal etti:",
    "client.created": "yeni müşteri ekledi:",
    "client.updated": "müşteriyi güncelledi:",
    "invoice.created": "fatura oluşturdu:",
    "invoice.sent": "fatura gönderdi:",
    "invoice.paid": "faturayı ödendi olarak işaretledi:",
    "task.created": "yeni görev oluşturdu:",
    "task.completed": "görevi tamamladı:",
  };
  return map[action] ?? action.replace(/\./g, " ");
}
