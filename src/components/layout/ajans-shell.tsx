"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard, Users, CalendarDays, BarChart3,
  Bell, Settings, LogOut, Menu, X, Sparkles,
  CheckSquare, FileImage, CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",    href: "/dashboard",  icon: LayoutDashboard, roles: ["ADMIN", "TEAM"] },
  { label: "Müşteriler",   href: "/musteriler", icon: Users,           roles: ["ADMIN"] },
  { label: "İçerikler",    href: "/icerikler",  icon: FileImage,       roles: ["ADMIN", "TEAM"] },
  { label: "Görevlerim",   href: "/gorevlerim", icon: CheckSquare,     roles: ["TEAM"] },
  { label: "Takvim",       href: "/takvim",     icon: CalendarDays,    roles: ["ADMIN", "TEAM"] },
  { label: "Raporlar",     href: "/raporlar",   icon: BarChart3,       roles: ["ADMIN"] },
  { label: "Ödemeler",     href: "/odemeler",   icon: CreditCard,      roles: ["ADMIN"] },
];

const PORTAL_ITEMS: NavItem[] = [
  { label: "İçeriklerim",  href: "/portal",          icon: FileImage,       roles: ["CLIENT"] },
  { label: "Takvim",       href: "/portal/takvim",   icon: CalendarDays,    roles: ["CLIENT"] },
  { label: "Performans",   href: "/portal/performans", icon: BarChart3,     roles: ["CLIENT"] },
];

function getInitials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export function AjansShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const role = (session?.user as { role?: string })?.role ?? "TEAM";

  const items = role === "CLIENT" ? PORTAL_ITEMS : NAV_ITEMS.filter((i) => i.roles.includes(role));

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar — masaüstü */}
      <aside
        className={cn(
          "hidden lg:flex flex-col border-r border-border bg-card transition-all duration-200",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Logo */}
        <div className={cn("flex items-center gap-3 px-4 py-4 border-b border-border", collapsed && "justify-center")}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <span className="text-base font-bold text-foreground tracking-tight">
              Ajans<span className="text-primary">OS</span>
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary border-l-[3px] border-primary ml-0 pl-[9px]"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  collapsed && "justify-center px-2"
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Alt: profil + ayarlar */}
        <div className="border-t border-border p-2 space-y-1">
          <Link
            href="/ayarlar"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
              collapsed && "justify-center px-2"
            )}
          >
            <Settings className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Ayarlar</span>}
          </Link>

          <div className={cn("flex items-center gap-3 px-3 py-2", collapsed && "justify-center px-2")}>
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {getInitials(session?.user?.name)}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{session?.user?.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{session?.user?.email}</p>
              </div>
            )}
            {!collapsed && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Collapse butonu */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute left-[calc(var(--sidebar-width)-12px)] top-[72px] hidden lg:flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card shadow-sm hover:bg-muted transition-colors"
          style={{ "--sidebar-width": collapsed ? "64px" : "240px" } as React.CSSProperties}
        >
          {collapsed ? <Menu className="h-3 w-3" /> : <X className="h-3 w-3" />}
        </button>
      </aside>

      {/* Ana içerik */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 lg:px-6">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-bold">
              Ajans<span className="text-primary">OS</span>
            </span>
          </div>

          <div className="hidden lg:block" />

          <div className="flex items-center gap-2">
            <Link href="/bildirimler" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative h-8 w-8")}>
              <Bell className="h-4 w-4" />
              <Badge className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full p-0 text-[10px] flex items-center justify-center bg-destructive text-white border-0">
                3
              </Badge>
            </Link>

            <Avatar className="h-8 w-8 cursor-pointer">
              <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
                {getInitials(session?.user?.name)}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Sayfa içeriği */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>

        {/* Bottom nav — mobil */}
        <nav className="lg:hidden flex border-t border-border bg-card pb-safe">
          {items.slice(0, 5).map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
                {active && <div className="h-0.5 w-4 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
