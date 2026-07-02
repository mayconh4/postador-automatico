import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Platform } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_PLATFORMS: Platform[] = [
  "instagram",
  "youtube",
  "tiktok",
  "facebook",
];

function isPlatform(value: string): value is Platform {
  return (VALID_PLATFORMS as string[]).includes(value);
}

/** Env necessária para o OAuth real de cada plataforma. */
function getClientId(platform: Platform): string | undefined {
  switch (platform) {
    case "instagram":
    case "facebook":
      return process.env.META_APP_ID;
    case "youtube":
      return process.env.GOOGLE_CLIENT_ID;
    case "tiktok":
      return process.env.TIKTOK_CLIENT_KEY;
  }
}

function buildAuthUrl(
  platform: Platform,
  clientId: string,
  redirectUri: string,
  state: string
): string {
  switch (platform) {
    case "instagram":
    case "facebook": {
      const scopes = [
        "instagram_basic",
        "instagram_content_publish",
        "pages_show_list",
        "pages_read_engagement",
      ];
      if (platform === "facebook") scopes.push("business_management");
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: scopes.join(","),
        state,
      });
      return `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
    }
    case "youtube": {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "https://www.googleapis.com/auth/youtube.upload",
        access_type: "offline",
        prompt: "consent",
        state,
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }
    case "tiktok": {
      const params = new URLSearchParams({
        client_key: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "video.publish,user.info.basic",
        state,
      });
      return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
    }
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { platform: string } }
) {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  if (!isPlatform(params.platform)) {
    return NextResponse.redirect(
      new URL(
        `/configuracoes?error=${encodeURIComponent("plataforma inválida")}`,
        origin
      )
    );
  }
  const platform = params.platform;

  const clientId = getClientId(platform);
  const redirectUri = `${origin}/api/oauth/${platform}/callback`;

  // ===== MODO DEMO: sem credenciais no servidor, cria uma conexão simulada =====
  if (!clientId) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/login", origin));
    }

    const expiresAt = new Date(
      Date.now() + 60 * 24 * 60 * 60 * 1000 // +60 dias
    ).toISOString();

    const { error } = await supabase.from("oauth_connections").upsert(
      {
        user_id: user.id,
        platform,
        account_id: `demo-${platform}`,
        account_name: "Conta Demo",
        access_token: "demo-token",
        refresh_token: null,
        expires_at: expiresAt,
      },
      { onConflict: "user_id,platform,account_id" }
    );

    if (error) {
      return NextResponse.redirect(
        new URL(
          `/configuracoes?error=${encodeURIComponent("falha ao criar conexão demo")}`,
          origin
        )
      );
    }

    return NextResponse.redirect(
      new URL(`/configuracoes?demo=1&platform=${platform}`, origin)
    );
  }

  // ===== FLUXO REAL: redireciona ao provedor com state anti-CSRF =====
  const state = crypto.randomUUID();
  const authUrl = buildAuthUrl(platform, clientId, redirectUri, state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutos
  });
  return response;
}
