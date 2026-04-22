"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";
import {
  CheckCircle2, Circle, Clock, AlertTriangle,
  ChevronRight,
} from "lucide-react";

const DEMO_TASKS: {
  id: string; title: string; project: string; client: string;
  dueDate: string; done: boolean; urgent: boolean; projectId: string;
}[] = [];

export default function GorevlerimPage() {
  const [tasks, setTasks] = useState(DEMO_TASKS);

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  const pending = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  const urgent = pending.filter((t) => t.urgent);

  const progress = tasks.length > 0 ? Math.round((done.length / tasks.length) * 100) : 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Görevlerim</h1>
        <p className="text-sm text-muted-foreground">
          {pending.length} bekleyen · {done.length} tamamlandı
        </p>
      </div>

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

      {/* Acil görevler */}
      {urgent.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            Acil — Bugün/Yarın Biten
          </div>
          {urgent.map((task) => (
            <TaskCard key={task.id} task={task} onToggle={toggleTask} />
          ))}
        </div>
      )}

      {/* Bekleyen görevler */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Bekleyenler ({pending.filter((t) => !t.urgent).length})
        </h3>
        {pending.filter((t) => !t.urgent).map((task) => (
          <TaskCard key={task.id} task={task} onToggle={toggleTask} />
        ))}
      </div>

      {/* Tamamlananlar */}
      {done.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5 text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" />
            Tamamlananlar ({done.length})
          </h3>
          {done.map((task) => (
            <TaskCard key={task.id} task={task} onToggle={toggleTask} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskCard({
  task,
  onToggle,
}: {
  task: (typeof DEMO_TASKS)[0];
  onToggle: (id: string) => void;
}) {
  const now = new Date();
  const due = new Date(task.dueDate);
  const isOverdue = !task.done && due < now;

  return (
    <Card
      className={cn(
        "p-3 flex items-start gap-3 hover:border-primary/30 transition-all",
        task.done && "opacity-60",
        task.urgent && !task.done && "border-amber-200 bg-amber-50/50",
      )}
    >
      <button
        onClick={() => onToggle(task.id)}
        className="mt-0.5 shrink-0 transition-colors"
      >
        {task.done ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground hover:text-primary" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium leading-snug", task.done && "line-through")}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-[10px] text-muted-foreground">{task.client}</span>
          <span className="text-border">·</span>
          <span className="text-[10px] text-muted-foreground truncate">{task.project}</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span
            className={cn(
              "text-[10px] font-medium flex items-center gap-0.5",
              isOverdue ? "text-destructive" : "text-muted-foreground"
            )}
          >
            <Clock className="h-2.5 w-2.5" />
            {formatDate(task.dueDate)}
          </span>
          {isOverdue && (
            <Badge className="text-[9px] h-4 px-1 bg-destructive/10 text-destructive border-0">
              Gecikti
            </Badge>
          )}
        </div>
      </div>

      <Link
        href={`/icerikler/${task.projectId}`}
        className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
    </Card>
  );
}
