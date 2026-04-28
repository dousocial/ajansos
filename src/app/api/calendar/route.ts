/**
 * Birleşik takvim feed'i.
 *
 * Takvim UI'ı tek endpoint'ten çoklu event tipini alır:
 *   - PUBLISH    → ScheduledPost.scheduledAt (yayın planı)
 *   - SHOOT      → Project.shootDate (çekim günü)
 *   - DEADLINE   → Task.dueDate (görev deadline)
 *   - INVOICE    → Subscription.nextInvoiceDate (fatura kesileceği gün)
 *
 * CLIENT rolü kendi müşterisine ait olmayanları görmez.
 *
 * Query: ?from=ISO&to=ISO&types=PUBLISH,SHOOT,DEADLINE,INVOICE (varsayılan hepsi)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type EventType = "PUBLISH" | "SHOOT" | "DEADLINE" | "INVOICE";
const ALL_TYPES: EventType[] = ["PUBLISH", "SHOOT", "DEADLINE", "INVOICE"];

interface CalendarEvent {
  id: string;
  type: EventType;
  date: string; // ISO
  title: string;
  subtitle?: string;
  // Gerekirse UI'da link kurmak için bağlamsal id'ler
  refId: string;
  projectId?: string;
  clientId?: string;
  // PUBLISH için
  platform?: string;
  postStatus?: string;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const typesParam = searchParams.get("types");

  if (!fromParam || !toParam) {
    return NextResponse.json(
      { error: "from ve to parametreleri zorunlu" },
      { status: 400 }
    );
  }
  const from = new Date(fromParam);
  const to = new Date(toParam);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return NextResponse.json({ error: "Geçersiz tarih" }, { status: 400 });
  }

  const types = typesParam
    ? (typesParam.split(",").filter((t) => ALL_TYPES.includes(t as EventType)) as EventType[])
    : ALL_TYPES;

  // CLIENT rol kısıtı: kendi müşterisi.
  let clientIdFilter: string | undefined;
  if (session.user.role === "CLIENT") {
    if (!session.user.email) {
      return NextResponse.json({ data: [] });
    }
    const client = await prisma.client.findFirst({
      where: { contactEmail: session.user.email, deletedAt: null },
      select: { id: true },
    });
    if (!client) return NextResponse.json({ data: [] });
    clientIdFilter = client.id;
  }

  const events: CalendarEvent[] = [];

  // ─── PUBLISH (ScheduledPost) ──────────────────────────────────────
  if (types.includes("PUBLISH")) {
    const posts = await prisma.scheduledPost.findMany({
      where: {
        scheduledAt: { gte: from, lte: to },
        project: {
          deletedAt: null,
          ...(clientIdFilter ? { clientId: clientIdFilter } : {}),
        },
      },
      select: {
        id: true,
        platform: true,
        scheduledAt: true,
        status: true,
        project: {
          select: {
            id: true,
            title: true,
            clientId: true,
            client: { select: { name: true } },
          },
        },
      },
    });
    for (const p of posts) {
      events.push({
        id: `publish:${p.id}`,
        type: "PUBLISH",
        date: p.scheduledAt.toISOString(),
        title: p.project.title,
        subtitle: `${p.project.client.name} · ${p.platform}`,
        refId: p.id,
        projectId: p.project.id,
        clientId: p.project.clientId,
        platform: p.platform,
        postStatus: p.status,
      });
    }
  }

  // ─── SHOOT (Project.shootDate) ────────────────────────────────────
  if (types.includes("SHOOT")) {
    const projects = await prisma.project.findMany({
      where: {
        shootDate: { gte: from, lte: to },
        deletedAt: null,
        isQuickPublish: false,
        ...(clientIdFilter ? { clientId: clientIdFilter } : {}),
      },
      select: {
        id: true,
        title: true,
        shootDate: true,
        shootLocation: true,
        clientId: true,
        client: { select: { name: true } },
      },
    });
    for (const pr of projects) {
      if (!pr.shootDate) continue;
      events.push({
        id: `shoot:${pr.id}`,
        type: "SHOOT",
        date: pr.shootDate.toISOString(),
        title: pr.title,
        subtitle: pr.shootLocation
          ? `${pr.client.name} · ${pr.shootLocation}`
          : pr.client.name,
        refId: pr.id,
        projectId: pr.id,
        clientId: pr.clientId,
      });
    }
  }

  // ─── DEADLINE (Task.dueDate) ──────────────────────────────────────
  if (types.includes("DEADLINE")) {
    const tasks = await prisma.task.findMany({
      where: {
        dueDate: { gte: from, lte: to },
        completedAt: null,
        project: {
          deletedAt: null,
          ...(clientIdFilter ? { clientId: clientIdFilter } : {}),
        },
        // CLIENT görev deadline'ını görmez (iç süreç).
        ...(session.user.role === "CLIENT" ? { id: "__never__" } : {}),
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        project: {
          select: {
            id: true,
            title: true,
            clientId: true,
            client: { select: { name: true } },
          },
        },
        assignedTo: { select: { name: true } },
      },
    });
    for (const t of tasks) {
      if (!t.dueDate) continue;
      events.push({
        id: `deadline:${t.id}`,
        type: "DEADLINE",
        date: t.dueDate.toISOString(),
        title: t.title,
        subtitle: `${t.project.title}${
          t.assignedTo ? ` · ${t.assignedTo.name}` : ""
        }`,
        refId: t.id,
        projectId: t.project.id,
        clientId: t.project.clientId,
      });
    }
  }

  // ─── INVOICE (Subscription.nextInvoiceDate) ──────────────────────
  // CLIENT rolü iç fatura cron'unu görmez.
  if (types.includes("INVOICE") && session.user.role !== "CLIENT") {
    const subs = await prisma.subscription.findMany({
      where: {
        nextInvoiceDate: { gte: from, lte: to },
        status: "ACTIVE",
        deletedAt: null,
        OR: [{ endDate: null }, { endDate: { gte: from } }],
      },
      select: {
        id: true,
        name: true,
        nextInvoiceDate: true,
        amount: true,
        currency: true,
        clientId: true,
        client: { select: { name: true } },
      },
    });
    for (const s of subs) {
      events.push({
        id: `invoice:${s.id}`,
        type: "INVOICE",
        date: s.nextInvoiceDate.toISOString(),
        title: s.name,
        subtitle: `${s.client.name} · ${s.amount} ${s.currency}`,
        refId: s.id,
        clientId: s.clientId,
      });
    }
  }

  // Tarihe göre sırala
  events.sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({ data: events });
}
