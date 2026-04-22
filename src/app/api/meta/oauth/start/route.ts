import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const clientId = searchParams.get("clientId");

  if (!clientId) {
    return NextResponse.json({ error: "clientId query parameter is required" }, { status: 400 });
  }

  const appId = process.env.META_APP_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!appId || !appUrl) {
    return NextResponse.json(
      { error: "META_APP_ID or NEXT_PUBLIC_APP_URL environment variable is not set" },
      { status: 500 }
    );
  }

  const redirectUri = `${appUrl}/api/meta/oauth/callback`;
  const scope = [
    "pages_manage_posts",
    "instagram_basic",
    "instagram_content_publish",
    "pages_read_engagement",
  ].join(",");

  const oauthUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
  oauthUrl.searchParams.set("client_id", appId);
  oauthUrl.searchParams.set("redirect_uri", redirectUri);
  oauthUrl.searchParams.set("scope", scope);
  oauthUrl.searchParams.set("state", clientId);

  return NextResponse.redirect(oauthUrl.toString());
}
