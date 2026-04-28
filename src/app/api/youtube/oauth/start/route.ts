/**
 * Google/YouTube OAuth 2.0 başlatıcı (Authorization Code + offline access).
 *
 * Scope: `youtube.upload` — video yükleme. `youtube.readonly` ekleyince channel
 * listesi de çekilebilir (callback'te yapıyoruz).
 *
 * Önemli: `access_type=offline` + `prompt=consent` ile refresh_token garanti
 * alınır. Aksi halde kullanıcı ikinci kez bağlanınca Google refresh_token
 * göndermez — ve Google access_token 1 saatte expire eder.
 *
 * Google Cloud Console → OAuth consent screen → YouTube Data API v3 enable.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const clientId = searchParams.get("clientId");

  if (!clientId) {
    return NextResponse.json({ error: "clientId query parameter is required" }, { status: 400 });
  }

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!googleClientId || !appUrl) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID veya NEXT_PUBLIC_APP_URL tanımlı değil" },
      { status: 500 }
    );
  }

  const redirectUri = `${appUrl}/api/youtube/oauth/callback`;
  const scope = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/userinfo.profile",
  ].join(" ");

  const oauthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  oauthUrl.searchParams.set("response_type", "code");
  oauthUrl.searchParams.set("client_id", googleClientId);
  oauthUrl.searchParams.set("redirect_uri", redirectUri);
  oauthUrl.searchParams.set("scope", scope);
  oauthUrl.searchParams.set("access_type", "offline");
  oauthUrl.searchParams.set("prompt", "consent");
  oauthUrl.searchParams.set("state", clientId);
  oauthUrl.searchParams.set("include_granted_scopes", "true");

  return NextResponse.redirect(oauthUrl.toString());
}
