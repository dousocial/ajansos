import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface PostResult {
  scheduledPostId: string;
  ok: boolean;
  error?: string;
  demo?: boolean;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Authorization: verify CRON_SECRET header
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const results: PostResult[] = [];

  try {
    const { prisma } = await import("@/lib/prisma");

    // Step 1: Find all pending posts scheduled at or before now
    const pendingPosts = await prisma.scheduledPost.findMany({
      where: {
        scheduledAt: { lte: new Date() },
        status: "pending",
      },
      select: { id: true },
    });

    // Step 2: Publish each post via internal API call
    for (const post of pendingPosts) {
      try {
        const res = await fetch(`${appUrl}/api/meta/post`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ scheduledPostId: post.id }),
        });

        const data = (await res.json()) as { ok: boolean; error?: string; demo?: boolean };
        results.push({
          scheduledPostId: post.id,
          ok: data.ok ?? res.ok,
          error: data.error,
          demo: data.demo,
        });
      } catch (e) {
        console.error("[cron/publish] Post publish error:", e);
        results.push({ scheduledPostId: post.id, ok: false, error: "İşlem başarısız oldu" });
      }
    }
  } catch (e) {
    console.error("[cron/publish] DB error:", e);
    return NextResponse.json({ error: "İşlem başarısız oldu" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
