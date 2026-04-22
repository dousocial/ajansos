"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";
import {
  ChevronLeft, ChevronRight, Plus, Camera,
  Globe2, TrendingUp, Globe,
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
  LINKEDIN: Globe,
};

const DEMO_EVENTS: {
  id: string; day: number; title: string; platform: string; status: string; client: string;
}[] = [];

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

export default function TakvimPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

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

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const eventsForDay = (day: number) =>
    DEMO_EVENTS.filter((e) => e.day === day);

  const selectedEvents = selectedDay ? eventsForDay(selectedDay) : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Takvim</h1>
          <p className="text-sm text-muted-foreground">İçerik yayın planı</p>
        </div>
        <Link
          href="/icerikler/yeni"
          className={cn(buttonVariants(), "gap-2 bg-primary text-white hover:bg-primary/90")}
        >
          <Plus className="h-4 w-4" /> Yeni İçerik
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        {/* Takvim */}
        <Card className="p-4">
          {/* Navigasyon */}
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

          {/* Gün isimleri */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-[11px] font-semibold text-muted-foreground py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Haftalar */}
          <div className="space-y-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1">
                {week.map((day, di) => {
                  if (!day) return <div key={di} />;
                  const events = eventsForDay(day);
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
                          : "border-transparent hover:border-border hover:bg-muted/50",
                      )}
                    >
                      <span
                        className={cn(
                          "text-xs font-semibold inline-flex h-5 w-5 items-center justify-center rounded-full mb-0.5",
                          isToday && "bg-primary text-white",
                          !isToday && "text-foreground",
                        )}
                      >
                        {day}
                      </span>
                      <div className="space-y-0.5">
                        {events.slice(0, 2).map((ev) => (
                          <div
                            key={ev.id}
                            className="rounded text-[9px] px-1 py-0.5 truncate font-medium leading-tight"
                            style={{
                              background: PLATFORM_COLORS[ev.platform] + "22",
                              color: PLATFORM_COLORS[ev.platform],
                            }}
                          >
                            {ev.title.split("—")[1]?.trim() ?? ev.title}
                          </div>
                        ))}
                        {events.length > 2 && (
                          <div className="text-[9px] text-muted-foreground px-1">+{events.length - 2}</div>
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
                  Bu gün için içerik yok
                </Card>
              ) : (
                <div className="space-y-2">
                  {selectedEvents.map((ev) => {
                    const Icon = PLATFORM_ICONS[ev.platform] ?? Globe;
                    return (
                      <Link key={ev.id} href={`/icerikler/${ev.id}`}>
                        <Card className="p-3 hover:border-primary/40 transition-all cursor-pointer">
                          <div className="flex items-start gap-2">
                            <div
                              className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                              style={{ background: PLATFORM_COLORS[ev.platform] + "22" }}
                            >
                              <Icon className="h-3.5 w-3.5" style={{ color: PLATFORM_COLORS[ev.platform] }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold leading-tight truncate">{ev.title}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{ev.client}</p>
                              <Badge
                                className="mt-1 text-[10px] h-4 px-1.5"
                                style={{
                                  background: STATUS_COLORS[ev.status] + "22",
                                  color: STATUS_COLORS[ev.status],
                                  border: "none",
                                }}
                              >
                                {STATUS_LABELS[ev.status]}
                              </Badge>
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
                {[
                  { label: "Toplam Paylaşım", value: DEMO_EVENTS.length },
                  { label: "Onay Bekliyor", value: DEMO_EVENTS.filter((e) => e.status === "CLIENT_REVIEW").length },
                  { label: "Onaylandı", value: DEMO_EVENTS.filter((e) => e.status === "APPROVED").length },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className="text-sm font-bold">{value}</span>
                  </div>
                ))}
              </Card>

              <h3 className="font-semibold text-sm">Yaklaşan İçerikler</h3>
              <div className="space-y-2">
                {DEMO_EVENTS.filter((e) => e.day >= now.getDate()).slice(0, 5).map((ev) => {
                  const Icon = PLATFORM_ICONS[ev.platform] ?? Globe;
                  return (
                    <Link key={ev.id} href={`/icerikler/${ev.id}`}>
                      <Card className="p-3 hover:border-primary/40 transition-all cursor-pointer">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
                            style={{ background: PLATFORM_COLORS[ev.platform] + "22" }}
                          >
                            <Icon className="h-3 w-3" style={{ color: PLATFORM_COLORS[ev.platform] }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{ev.title}</p>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {ev.day} {MONTHS[month].slice(0, 3)}
                          </span>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
