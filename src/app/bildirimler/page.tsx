"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CheckSquare, FileImage, ThumbsUp, RefreshCw,
  AlertTriangle, Bell, CheckCheck,
} from "lucide-react";

const DEMO_NOTIFS: {
  id: string; type: string; title: string; body: string; time: string; read: boolean;
}[] = [];

const NOTIF_ICONS: Record<string, React.ElementType> = {
  CLIENT_APPROVED: ThumbsUp,
  TASK_ASSIGNED: CheckSquare,
  CLIENT_REVISION: RefreshCw,
  FILE_UPLOADED: FileImage,
  TOKEN_EXPIRING: AlertTriangle,
  INTERNAL_APPROVED: CheckSquare,
};

const NOTIF_COLORS: Record<string, string> = {
  CLIENT_APPROVED: "text-emerald-600 bg-emerald-100",
  TASK_ASSIGNED: "text-primary bg-primary/10",
  CLIENT_REVISION: "text-amber-600 bg-amber-100",
  FILE_UPLOADED: "text-blue-600 bg-blue-100",
  TOKEN_EXPIRING: "text-destructive bg-destructive/10",
  INTERNAL_APPROVED: "text-violet-600 bg-violet-100",
};

export default function BildirimlerPage() {
  const [notifs, setNotifs] = useState(DEMO_NOTIFS);

  const markAllRead = () => {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = (id: string) => {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const unreadCount = notifs.filter((n) => !n.read).length;

  return (
    <div className="space-y-5 max-w-xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bildirimler</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground">{unreadCount} okunmamış bildirim</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Tümünü okundu işaretle
          </button>
        )}
      </div>

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
            return (
              <Card
                key={n.id}
                onClick={() => markRead(n.id)}
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
                    <span className="text-[10px] text-muted-foreground shrink-0">{n.time}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.body}</p>
                </div>
                {!n.read && (
                  <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
