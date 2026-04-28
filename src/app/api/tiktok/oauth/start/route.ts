/**
 * TikTok OAuth 2.0 başlatıcı.
 *
 * Scope:
 *  - user.info.basic — open_id + display name
 *  - video.publish — Direct Post API (yayın)
 *  - video.upload — Inbox upload (draft) — video.publish yetkisi yoksa kullanılabilir
 *
 * **Önemli:** `video.publish` scope'u TikTok tarafından manuel app review ile
 * aktive edilir. Developer portal → Products → Content Posting API → Request
 * access (1-2 hafta alır). İncelemeden önce scope'u eklerseniz OAuth ekranında
 * "scope_not_authorized" hatası alırsınız — video.upload ile devam edip sonra
 * audit geçince publish'i açmak daha pratik.
 *
 * Sandbox modda sadece belirli test kullanıcıları bağlanabilir.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const clientId = searchParams.get("clientId");

  if (!clientId) {
    return NextResponse.json({ error: "clientId query parameter is required" }, { status: 400 });
  }

  const tiktokClientKey = process.env.TIKTOK_CLIENT_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!tiktokClientKey || !appUrl) {
    return NextResponse.json(
      { error: "TIKTOK_CLIENT_KEY veya NEXT_PUBLIC_APP_URL tanımlı değil" },
      { status: 500 }
    );
  }

  const redirectUri = `${appUrl}/api/tiktok/oauth/callback`;
  const scope = ["user.info.basic", "video.publish", "video.upload"].join(",");

  const oauthUrl = new URL("https://www.tiktok.com/v2/auth/authorize/");
  oauthUrl.searchParams.set("client_key", tiktokClientKey);
  oauthUrl.searchParams.set("response_type", "code");
  oauthUrl.searchParams.set("scope", scope);
  oauthUrl.searchParams.set("redirect_uri", redirectUri);
  oauthUrl.searchParams.set("state", clientId);

  return NextResponse.redirect(oauthUrl.toString());
}
