"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  CheckSquare, FileImage, ThumbsUp, RefreshCw,
  AlertTriangle, Bell, CheckCheck, Loader2,
  XCircle, Clock,
} from "lucide-react";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  read: boolean;
  createdAt: string;
}

const NOTIF_ICONS: Record<string, React.ElementType> = {
  CLIENT_APPROVED: ThumbsUp,
  TASK_ASSIGNED: CheckSquare,
  CLIENT_REVISION: RefreshCw,
  FILE_UPLOADED: FileImage,
  TOKEN_EXPIRING: AlertTriangle,
  INTERNAL_APPROVED: CheckSquare,
  POST_FAILED: XCircle,
  REMINDER: Clock,
};

const NOTIF_COLORS: Record<string, string> = {
  CLIENT_APPROVED: "text-emerald-600 bg-emerald-100",
  TASK_ASSIGNED: "text-primary bg-primary/10",
  CLIENT_REVISION: "text-amber-600 bg-amber-100",
  FILE_UPLOADED: "text-blue-600 bg-blue-100",
  TOKEN_EXPIRING: "text-destructive bg-destructive/10",
  INTERNAL_APPROVED: "text-violet-600 bg-violet-100",
  POST_FAILED: "text-destructive bg-destructive/10",
  REMINDER: "text-muted-foreground bg-muted",
};

function relativeTime(iso: string): string {
  const d = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((now - d) / 1000);
  if (diffSec < 60) return "az önce";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} dk önce`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} sa önce`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD} gün önce`;
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}

function linkForEntity(entityType: string | null, entityId: string | null): string | null {
  if (!entityType || !entityId) return null;
  switch (entityType) {
    case "project":
    case "Project":
      return `/icerikler/${entityId}`;
    case "client":
    case "Client":
      return `/musteriler/${entityId}`;
    case "task":
    case "Task":
      return `/gorevlerim`;
    default:
      return null;
  }
}

export default function BildirimlerPage() {
  const [notifs, setNotifs] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=100", { cache: "no-store" });
      if (!res.ok) throw new Error("Bildirimler yüklenemedi");
      const json = (await res.json()) as { data: NotificationRow[] };
      setNotifs(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markRead(id: string) {
    const current = notifs.find((n) => n.id === id);
    if (!current || current.read) return;

    // Optimistic
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      if (!res.ok) throw new Error("İşaretlenemedi");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bilinmeyen hata");
      await load();
    }
  }

  async function markAllRead() {
    const hasUnread = notifs.some((n) => !n.read);
    if (!hasUnread) return;
    setMarkingAll(true);
    // Optimistic
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      const res = await fetch("/api/notifications", { method: "PATCH" });
      if (!res.ok) throw new Error("İşaretlenemedi");
      toast.success("Tüm bildirimler okundu");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bilinmeyen hata");
      await load();
    } finally {
      setMarkingAll(false);
    }
  }

  const unreadCount = notifs.filter((n) => !n.read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Bildirimler yükleniyor…
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bildirimler</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground">{unreadCount} okunmamış bildirim</p>
          )}
          {unreadCount === 0 && notifs.length > 0 && (
            <p className="text-sm text-muted-foreground">Hepsi okundu</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={markingAll}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium disabled:opacity-60"
          >
            {markingAll ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCheck className="h-3.5 w-3.5" />
            )}
            Tümünü okundu işaretle
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive font-medium">{error}</p>
        </div>
      )}

      {notifs.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <Bell className="h-8 w-8 mx-auto mb-2" />
          <p>Bildirim yok</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifs.map((n) => {
            const Icon = NOTIF_ICONS[n.type] ?? Bell;
            const colorClass = NOTIF_COLORS[n.type] ?? "text-muted-foreground bg-muted";
            const href = linkForEntity(n.entityType, n.entityId);

            const cardContent = (
              <Card
                className={cn(
                  "p-3 flex items-start gap-3 cursor-pointer hover:border-primary/30 transition-all",
                  !n.read && "bg-primary/5 border-primary/20"
                )}
              >
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", colorClass)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn("text-sm font-medium", !n.read && "font-semibold")}>{n.title}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {relativeTime(n.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.body}</p>
                </div>
                {!n.read && (
                  <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />
                )}
              </Card>
            );

            return href ? (
              <Link key={n.id} href={href} onClick={() => markRead(n.id)}>
                {cardContent}
              </Link>
            ) : (
              <div key={n.id} onClick={() => markRead(n.id)}>
                {cardContent}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
