"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";
import {
  CheckCircle2, Circle, Clock, AlertTriangle,
  ChevronRight, Loader2,
} from "lucide-react";

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  completedAt: string | null;
  project: {
    id: string;
    title: string;
    client: { id: string; name: string; slug: string };
  };
}

function isUrgent(task: TaskRow): boolean {
  if (task.completedAt || !task.dueDate) return false;
  const due = new Date(task.dueDate).getTime();
  const now = Date.now();
  // Kalan süre <= 48 saat
  return due - now <= 48 * 60 * 60 * 1000;
}

export default function GorevlerimPage() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks?mine=true&limit=100", { cache: "no-store" });
      if (!res.ok) throw new Error("Görevler yüklenemedi");
      const json = (await res.json()) as { data: TaskRow[] };
      setTasks(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleTask(id: string, nextCompleted: boolean) {
    setTogglingId(id);
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, completedAt: nextCompleted ? new Date().toISOString() : null }
          : t
      )
    );
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: nextCompleted }),
      });
      if (!res.ok) throw new Error("Güncellenemedi");
      toast.success(nextCompleted ? "Görev tamamlandı" : "Görev geri açıldı");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bilinmeyen hata");
      await load(); // rollback
    } finally {
      setTogglingId(null);
    }
  }

  const pending = tasks.filter((t) => !t.completedAt);
  const done = tasks.filter((t) => t.completedAt);
  const urgent = pending.filter(isUrgent);

  const progress = tasks.length > 0 ? Math.round((done.length / tasks.length) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Görevler yükleniyor…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Görevlerim</h1>
        <p className="text-sm text-muted-foreground">
          {pending.length} bekleyen · {done.length} tamamlandı
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive font-medium">{error}</p>
        </div>
      )}

      {/* İlerleme */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Bu Hafta İlerlemesi</span>
          <span className="text-sm font-bold text-primary">{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          {done.length}/{tasks.length} görev tamamlandı
        </p>
      </Card>

      {/* Boş state */}
      {tasks.length === 0 && (
        <Card className="p-10 text-center border-dashed border-2">
          <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
          <p className="text-sm font-medium mb-1">Görev yok</p>
          <p className="text-xs text-muted-foreground">
            Size atanmış görev bulunmuyor.
          </p>
        </Card>
      )}

      {/* Acil görevler */}
      {urgent.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            Acil — 48 Saat İçinde Biten
          </div>
          {urgent.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onToggle={toggleTask}
              toggling={togglingId === task.id}
            />
          ))}
        </div>
      )}

      {/* Bekleyen görevler */}
      {pending.filter((t) => !isUrgent(t)).length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Bekleyenler ({pending.filter((t) => !isUrgent(t)).length})
          </h3>
          {pending.filter((t) => !isUrgent(t)).map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onToggle={toggleTask}
              toggling={togglingId === task.id}
            />
          ))}
        </div>
      )}

      {/* Tamamlananlar */}
      {done.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5 text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" />
            Tamamlananlar ({done.length})
          </h3>
          {done.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onToggle={toggleTask}
              toggling={togglingId === task.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskCard({
  task,
  onToggle,
  toggling,
}: {
  task: TaskRow;
  onToggle: (id: string, next: boolean) => void;
  toggling?: boolean;
}) {
  const now = new Date();
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const done = !!task.completedAt;
  const isOverdue = !done && due !== null && due < now;
  const urgent = !done && isUrgent(task);

  return (
    <Card
      className={cn(
        "p-3 flex items-start gap-3 hover:border-primary/30 transition-all",
        done && "opacity-60",
        urgent && !done && "border-amber-200 bg-amber-50/50",
      )}
    >
      <button
        onClick={() => onToggle(task.id, !done)}
        disabled={toggling}
        className="mt-0.5 shrink-0 transition-colors disabled:opacity-60"
      >
        {toggling ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : done ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground hover:text-primary" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium leading-snug", done && "line-through")}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-[10px] text-muted-foreground">{task.project.client.name}</span>
          <span className="text-border">·</span>
          <span className="text-[10px] text-muted-foreground truncate">{task.project.title}</span>
        </div>
        {due && (
          <div className="flex items-center gap-2 mt-1">
            <span
              className={cn(
                "text-[10px] font-medium flex items-center gap-0.5",
                isOverdue ? "text-destructive" : "text-muted-foreground"
              )}
            >
              <Clock className="h-2.5 w-2.5" />
              {formatDate(due)}
            </span>
            {isOverdue && (
              <Badge className="text-[9px] h-4 px-1 bg-destructive/10 text-destructive border-0">
                Gecikti
              </Badge>
            )}
          </div>
        )}
      </div>

      <Link
        href={`/icerikler/${task.project.id}`}
        className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
    </Card>
  );
}
