import { NextRequest, NextResponse } from "next/server";
import { encryptToken } from "@/lib/crypto";

export const runtime = "nodejs";

interface FacebookTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface FacebookUserResponse {
  id: string;
  name: string;
}

interface FacebookErrorResponse {
  error: {
    message: string;
    type: string;
    code: number;
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const clientId = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    const errorDesc = searchParams.get("error_description") ?? "OAuth denied";
    return NextResponse.json({ error: errorDesc }, { status: 400 });
  }

  if (!code || !clientId) {
    return NextResponse.json(
      { error: "Missing code or state parameter" },
      { status: 400 }
    );
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!appId || !appSecret || !appUrl) {
    return NextResponse.json(
      { error: "Meta environment variables are not configured" },
      { status: 500 }
    );
  }

  const redirectUri = `${appUrl}/api/meta/oauth/callback`;

  // Step 1: Exchange code for access_token
  const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("code", code);

  const tokenRes = await fetch(tokenUrl.toString());
  const tokenData = (await tokenRes.json()) as FacebookTokenResponse | FacebookErrorResponse;

  if (!tokenRes.ok || "error" in tokenData) {
    const errMsg = "error" in tokenData ? tokenData.error.message : "Failed to exchange token";
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }

  const { access_token, expires_in } = tokenData as FacebookTokenResponse;

  // Step 2: Fetch user/account info to get accountId and accountName
  const meUrl = new URL("https://graph.facebook.com/v19.0/me");
  meUrl.searchParams.set("fields", "id,name");
  meUrl.searchParams.set("access_token", access_token);

  const meRes = await fetch(meUrl.toString());
  const meData = (await meRes.json()) as FacebookUserResponse | FacebookErrorResponse;

  if (!meRes.ok || "error" in meData) {
    const errMsg = "error" in meData ? meData.error.message : "Failed to fetch user info";
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }

  const { id: accountId, name: accountName } = meData as FacebookUserResponse;

  // Step 3: Encrypt the token
  const accessTokenEnc = encryptToken(access_token);

  const tokenExpiresAt = expires_in
    ? new Date(Date.now() + expires_in * 1000)
    : null;

  // Step 4: Save to DB
  try {
    const { prisma } = await import("@/lib/prisma");

    await prisma.socialAccount.upsert({
      where: {
        clientId_platform_accountId: {
          clientId,
          platform: "FACEBOOK",
          accountId,
        },
      },
      create: {
        clientId,
        platform: "FACEBOOK",
        accountId,
        accountName,
        accessTokenEnc,
        tokenExpiresAt,
      },
      update: {
        accountName,
        accessTokenEnc,
        tokenExpiresAt,
      },
    });
  } catch (e) {
    console.error("[meta/oauth/callback] DB error:", e);
    return NextResponse.json({ error: "İşlem başarısız oldu" }, { status: 500 });
  }

  // Step 5: Redirect to client page
  const appUrlFinal = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return NextResponse.redirect(`${appUrlFinal}/musteriler/${clientId}`);
}
