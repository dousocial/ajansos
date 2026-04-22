import { NextRequest, NextResponse } from "next/server";
import { decryptToken } from "@/lib/crypto";

export const runtime = "nodejs";

interface PostRequestBody {
  scheduledPostId: string;
}

interface GraphApiResponse {
  id?: string;
  error?: {
    message: string;
    type: string;
    code: number;
  };
}

async function publishInstagram(
  accessToken: string,
  instagramId: string,
  caption: string,
  mediaUrls: string[]
): Promise<string> {
  const imageUrl = mediaUrls[0];

  // Step 1: Create media container
  const containerUrl = new URL(`https://graph.facebook.com/v19.0/${instagramId}/media`);
  const containerRes = await fetch(containerUrl.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: imageUrl,
      caption,
      access_token: accessToken,
    }),
  });

  const containerData = (await containerRes.json()) as GraphApiResponse;
  if (!containerRes.ok || containerData.error) {
    throw new Error(containerData.error?.message ?? "Failed to create Instagram media container");
  }

  const containerId = containerData.id!;

  // Step 2: Publish media container
  const publishUrl = new URL(`https://graph.facebook.com/v19.0/${instagramId}/media_publish`);
  const publishRes = await fetch(publishUrl.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      creation_id: containerId,
      access_token: accessToken,
    }),
  });

  const publishData = (await publishRes.json()) as GraphApiResponse;
  if (!publishRes.ok || publishData.error) {
    throw new Error(publishData.error?.message ?? "Failed to publish Instagram media");
  }

  return publishData.id!;
}

async function publishFacebook(
  accessToken: string,
  pageId: string,
  caption: string,
  mediaUrls: string[]
): Promise<string> {
  const imageUrl = mediaUrls[0];
  const endpoint = `https://graph.facebook.com/v19.0/${pageId}/photos`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: imageUrl,
      caption,
      access_token: accessToken,
    }),
  });

  const data = (await res.json()) as GraphApiResponse;
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? "Failed to publish Facebook post");
  }

  return data.id!;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: PostRequestBody;

  try {
    body = (await request.json()) as PostRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { scheduledPostId } = body;

  if (!scheduledPostId) {
    return NextResponse.json({ error: "scheduledPostId is required" }, { status: 400 });
  }

  try {
    const { prisma } = await import("@/lib/prisma");

    // Step 1: Fetch ScheduledPost + SocialAccount
    const scheduledPost = await prisma.scheduledPost.findUnique({
      where: { id: scheduledPostId },
      include: { socialAccount: true },
    });

    if (!scheduledPost) {
      return NextResponse.json({ error: "ScheduledPost not found" }, { status: 404 });
    }

    const { socialAccount } = scheduledPost;

    // Step 2: Decrypt token
    const accessToken = decryptToken(socialAccount.accessTokenEnc);

    const caption = [scheduledPost.caption, ...scheduledPost.hashtags].filter(Boolean).join("\n\n");

    // Step 3: Publish based on platform
    let externalId: string;

    if (scheduledPost.platform === "INSTAGRAM") {
      if (!socialAccount.instagramId) {
        throw new Error("instagramId is not set on SocialAccount");
      }
      externalId = await publishInstagram(
        accessToken,
        socialAccount.instagramId,
        caption,
        scheduledPost.mediaUrls
      );
    } else if (scheduledPost.platform === "FACEBOOK") {
      if (!socialAccount.pageId) {
        throw new Error("pageId is not set on SocialAccount");
      }
      externalId = await publishFacebook(
        accessToken,
        socialAccount.pageId,
        caption,
        scheduledPost.mediaUrls
      );
    } else {
      throw new Error(`Unsupported platform: ${scheduledPost.platform}`);
    }

    // Step 4: Mark as published
    await prisma.scheduledPost.update({
      where: { id: scheduledPostId },
      data: {
        status: "published",
        publishedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, externalId });
  } catch (e) {
    // Attempt to record failure in DB if possible
    try {
      const { prisma } = await import("@/lib/prisma");
      const errMsg = e instanceof Error ? e.message : String(e);

      await prisma.scheduledPost.update({
        where: { id: scheduledPostId },
        data: {
          status: "failed",
          retryCount: { increment: 1 },
          lastError: errMsg,
        },
      });
    } catch {
      // DB unavailable — still return error
    }

    console.error("[meta/post] Error:", e);
    return NextResponse.json({ ok: false, error: "İşlem başarısız oldu" }, { status: 500 });
  }
}
