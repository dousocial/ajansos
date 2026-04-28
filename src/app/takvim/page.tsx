"use client";

/**
 * Takvim — birleşik etkinlik görünümü.
 *
 * /api/calendar tek endpoint'ten 4 farklı event tipi alınır:
 *   - PUBLISH  → ScheduledPost.scheduledAt (platform rengi)
 *   - SHOOT    → Project.shootDate (kırmızı)
 *   - DEADLINE → Task.dueDate (sarı)
 *   - INVOICE  → Subscription.nextInvoiceDate (yeşil)
 *
 * Üst tarafta filter chip'leri ile kullanıcı sadece istediği tipleri görebilir.
 * Detaylı tip bağlamına göre tıklanan event farklı sayfaya yönlendirir.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Camera,
  Globe2,
  TrendingUp,
  PlaySquare,
  Briefcase,
  Loader2,
  Clock,
  DollarSign,
  Send,
} from "lucide-react";

const PLATFORM_COLORS: Record<string, string> = {
  INSTAGRAM: "#E1306C",
  FACEBOOK: "#1877F2",
  TIKTOK: "#000000",
  LINKEDIN: "#0A66C2",
  YOUTUBE: "#FF0000",
};

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  INSTAGRAM: Camera,
  FACEBOOK: Globe2,
  TIKTOK: TrendingUp,
  LINKEDIN: Briefcase,
  YOUTUBE: PlaySquare,
};

type EventType = "PUBLISH" | "SHOOT" | "DEADLINE" | "INVOICE";

interface CalendarEvent {
  id: string;
  type: EventType;
  date: string;
  title: string;
  subtitle?: string;
  refId: string;
  projectId?: string;
  clientId?: string;
  platform?: string;
  postStatus?: string;
}

const TYPE_META: Record<
  EventType,
  { label: string; color: string; Icon: React.ElementType }
> = {
  PUBLISH: { label: "Yayın", color: "#6366f1", Icon: Send },
  SHOOT: { label: "Çekim", color: "#ef4444", Icon: Camera },
  DEADLINE: { label: "Deadline", color: "#f59e0b", Icon: Clock },
  INVOICE: { label: "Fatura", color: "#10b981", Icon: DollarSign },
};

function colorForEvent(ev: CalendarEvent): string {
  if (ev.type === "PUBLISH" && ev.platform) {
    return PLATFORM_COLORS[ev.platform] ?? TYPE_META.PUBLISH.color;
  }
  return TYPE_META[ev.type].color;
}

function IconForEvent({ ev }: { ev: CalendarEvent }) {
  if (ev.type === "PUBLISH" && ev.platform) {
    const Icon = PLATFORM_ICONS[ev.platform] ?? Send;
    return <Icon className="h-3.5 w-3.5" />;
  }
  const Icon = TYPE_META[ev.type].Icon;
  return <Icon className="h-3.5 w-3.5" />;
}

function hrefForEvent(ev: CalendarEvent): string {
  switch (ev.type) {
    case "PUBLISH":
      return ev.projectId ? `/yayin` : "#";
    case "SHOOT":
      return ev.projectId ? `/icerikler/${ev.projectId}` : "#";
    case "DEADLINE":
      return ev.projectId ? `/icerikler/${ev.projectId}` : "/gorevlerim";
    case "INVOICE":
      return `/odemeler/abonelikler/${ev.refId}`;
    default:
      return "#";
  }
}

const MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const DAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

const ALL_TYPES: EventType[] = ["PUBLISH", "SHOOT", "DEADLINE", "INVOICE"];

export default function TakvimPage() {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTypes, setActiveTypes] = useState<Set<EventType>>(
    new Set(ALL_TYPES)
  );

  const daysInMonth = getDaysInMonth(year, month);
  const firstDow = getFirstDayOfWeek(year, month);

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) =>
    cells.slice(i * 7, i * 7 + 7)
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = new Date(year, month, 1, 0, 0, 0).toISOString();
      const to = new Date(year, month + 1, 0, 23, 59, 59, 999).toISOString();
      const url = `/api/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Takvim verileri yüklenemedi");
      const json = (await res.json()) as { data: CalendarEvent[] };
      setEvents(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    load();
  }, [load]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
    setSelectedDay(null);
  };

  const visibleEvents = events.filter((e) => activeTypes.has(e.type));
  const eventsForDay = (day: number) =>
    visibleEvents.filter((e) => {
      const d = new Date(e.date);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });

  const selectedEvents = selectedDay ? eventsForDay(selectedDay) : [];
  const todayDay = now.getDate();
  const upcoming = visibleEvents
    .filter((e) => {
      const d = new Date(e.date);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() >= todayDay;
    })
    .slice(0, 5);

  function toggleType(t: EventType) {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      // En az bir tip aktif kalsın — tümünü kapatınca tekrar hepsini aç.
      if (next.size === 0) return new Set(ALL_TYPES);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Takvim</h1>
          <p className="text-sm text-muted-foreground">
            Yayın, çekim, deadline ve fatura tarihleri
          </p>
        </div>
        <Link
          href="/icerikler/yeni"
          className={cn(buttonVariants(), "gap-2 bg-primary text-white hover:bg-primary/90")}
        >
          <Plus className="h-4 w-4" /> Yeni İçerik
        </Link>
      </div>

      {/* Tip filtre çipleri */}
      <div className="flex items-center gap-2 flex-wrap">
        {ALL_TYPES.map((t) => {
          const meta = TYPE_META[t];
          const active = activeTypes.has(t);
          const count = events.filter((e) => e.type === t).length;
          const TypeIcon = meta.Icon;
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggleType(t)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                active
                  ? "text-white"
                  : "bg-background text-muted-foreground hover:bg-muted"
              )}
              style={
                active
                  ? { background: meta.color, borderColor: meta.color }
                  : undefined
              }
            >
              <TypeIcon className="h-3 w-3" />
              {meta.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  active ? "bg-white/20" : "bg-muted"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive font-medium">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        {/* Takvim */}
        <Card className="p-4 relative">
          {loading && (
            <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-10 rounded-xl">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="font-bold text-base">
              {MONTHS[month]} {year}
            </h2>
            <button onClick={nextMonth} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-[11px] font-semibold text-muted-foreground py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="space-y-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1">
                {week.map((day, di) => {
                  if (!day) return <div key={di} />;
                  const dayEvents = eventsForDay(day);
                  const isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
                  const isSelected = day === selectedDay;
                  return (
                    <button
                      key={di}
                      onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                      className={cn(
                        "min-h-[52px] rounded-lg p-1 text-left transition-all border",
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-transparent hover:border-border hover:bg-muted/50"
                      )}
                    >
                      <span
                        className={cn(
                          "text-xs font-semibold inline-flex h-5 w-5 items-center justify-center rounded-full mb-0.5",
                          isToday && "bg-primary text-white",
                          !isToday && "text-foreground"
                        )}
                      >
                        {day}
                      </span>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 2).map((ev) => {
                          const c = colorForEvent(ev);
                          return (
                            <div
                              key={ev.id}
                              className="rounded text-[9px] px-1 py-0.5 truncate font-medium leading-tight"
                              style={{ background: c + "22", color: c }}
                            >
                              {ev.title}
                            </div>
                          );
                        })}
                        {dayEvents.length > 2 && (
                          <div className="text-[9px] text-muted-foreground px-1">+{dayEvents.length - 2}</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>

        {/* Sağ panel — seçili gün / etkinlikler */}
        <div className="space-y-3">
          {selectedDay ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">
                  {selectedDay} {MONTHS[month]}
                </h3>
                <button onClick={() => setSelectedDay(null)} className="text-xs text-muted-foreground hover:text-foreground">
                  Kapat
                </button>
              </div>
              {selectedEvents.length === 0 ? (
                <Card className="p-4 text-center text-muted-foreground text-xs">
                  Bu gün için etkinlik yok
                </Card>
              ) : (
                <div className="space-y-2">
                  {selectedEvents.map((ev) => {
                    const c = colorForEvent(ev);
                    const meta = TYPE_META[ev.type];
                    return (
                      <Link key={ev.id} href={hrefForEvent(ev)}>
                        <Card className="p-3 hover:border-primary/40 transition-all cursor-pointer">
                          <div className="flex items-start gap-2">
                            <div
                              className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                              style={{ background: c + "22", color: c }}
                            >
                              <IconForEvent ev={ev} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold leading-tight truncate">{ev.title}</p>
                              {ev.subtitle && (
                                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                  {ev.subtitle}
                                </p>
                              )}
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span
                                  className="text-[9px] font-medium rounded-full px-1.5 py-0.5"
                                  style={{ background: c + "22", color: c }}
                                >
                                  {meta.label}
                                </span>
                                <span className="text-[9px] text-muted-foreground">
                                  {new Date(ev.date).toLocaleTimeString("tr-TR", {
                                    hour: "2-digit", minute: "2-digit",
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              <h3 className="font-semibold text-sm">Bu Ay</h3>
              <Card className="p-3">
                {ALL_TYPES.map((t) => {
                  const meta = TYPE_META[t];
                  const count = events.filter((e) => e.type === t).length;
                  const TypeIcon = meta.Icon;
                  return (
                    <div
                      key={t}
                      className="flex items-center justify-between py-1.5 border-b border-border last:border-0"
                    >
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                        <TypeIcon className="h-3 w-3" style={{ color: meta.color }} />
                        {meta.label}
                      </span>
                      <span className="text-sm font-bold">{count}</span>
                    </div>
                  );
                })}
              </Card>

              <h3 className="font-semibold text-sm">Yaklaşanlar</h3>
              {upcoming.length === 0 ? (
                <Card className="p-3 text-center text-[11px] text-muted-foreground">
                  Bu ay için etkinlik yok
                </Card>
              ) : (
                <div className="space-y-2">
                  {upcoming.map((ev) => {
                    const c = colorForEvent(ev);
                    const d = new Date(ev.date);
                    return (
                      <Link key={ev.id} href={hrefForEvent(ev)}>
                        <Card className="p-3 hover:border-primary/40 transition-all cursor-pointer">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
                              style={{ background: c + "22", color: c }}
                            >
                              <IconForEvent ev={ev} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{ev.title}</p>
                              {ev.subtitle && (
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {ev.subtitle}
                                </p>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {d.getDate()} {MONTHS[month].slice(0, 3)}
                            </span>
                          </div>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
