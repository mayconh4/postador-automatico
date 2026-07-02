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

interface TokenResult {
  accessToken: string;
  refreshToken: string | null;
  /** ISO string ou null quando o provedor não informa expiração. */
  expiresAt: string | null;
  accountId: string;
  accountName: string | null;
}

function expiresInToIso(expiresIn: unknown): string | null {
  const seconds = typeof expiresIn === "number" ? expiresIn : Number(expiresIn);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

/** Meta (Instagram/Facebook): troca o code e busca a primeira página do usuário. */
async function exchangeMeta(
  code: string,
  redirectUri: string
): Promise<TokenResult> {
  const clientId = process.env.META_APP_ID ?? "";
  const clientSecret = process.env.META_APP_SECRET ?? "";

  const tokenParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });
  const tokenRes = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token?${tokenParams.toString()}`
  );
  if (!tokenRes.ok) {
    throw new Error(`Meta respondeu ${tokenRes.status} na troca do código`);
  }
  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!tokenData.access_token) {
    throw new Error("Meta não retornou access_token");
  }

  let accountId = "";
  let accountName: string | null = null;
  try {
    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?access_token=${encodeURIComponent(tokenData.access_token)}`
    );
    if (pagesRes.ok) {
      const pages = (await pagesRes.json()) as {
        data?: { id?: string; name?: string }[];
      };
      const first = pages.data?.[0];
      if (first?.id) {
        accountId = first.id;
        accountName = first.name ?? null;
      }
    }
  } catch {
    // segue para o fallback /me
  }

  if (!accountId) {
    try {
      const meRes = await fetch(
        `https://graph.facebook.com/v19.0/me?access_token=${encodeURIComponent(tokenData.access_token)}`
      );
      if (meRes.ok) {
        const me = (await meRes.json()) as { id?: string; name?: string };
        if (me.id) {
          accountId = me.id;
          accountName = me.name ?? null;
        }
      }
    } catch {
      // sem dados de conta — falha abaixo
    }
  }

  if (!accountId) {
    throw new Error("não foi possível identificar a conta Meta");
  }

  return {
    accessToken: tokenData.access_token,
    refreshToken: null,
    expiresAt: expiresInToIso(tokenData.expires_in),
    accountId,
    accountName,
  };
}

/** Google (YouTube): troca o code e busca o canal do usuário. */
async function exchangeGoogle(
  code: string,
  redirectUri: string
): Promise<TokenResult> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });
  if (!tokenRes.ok) {
    throw new Error(`Google respondeu ${tokenRes.status} na troca do código`);
  }
  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!tokenData.access_token) {
    throw new Error("Google não retornou access_token");
  }

  let accountId = "";
  let accountName: string | null = null;
  try {
    const channelRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    if (channelRes.ok) {
      const channels = (await channelRes.json()) as {
        items?: { id?: string; snippet?: { title?: string } }[];
      };
      const first = channels.items?.[0];
      if (first?.id) {
        accountId = first.id;
        accountName = first.snippet?.title ?? null;
      }
    }
  } catch {
    // sem dados do canal — falha abaixo
  }

  if (!accountId) {
    throw new Error("não foi possível identificar o canal do YouTube");
  }

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token ?? null,
    expiresAt: expiresInToIso(tokenData.expires_in),
    accountId,
    accountName,
  };
}

/** TikTok: troca o code e busca as informações básicas do usuário. */
async function exchangeTikTok(
  code: string,
  redirectUri: string
): Promise<TokenResult> {
  const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY ?? "",
      client_secret: process.env.TIKTOK_CLIENT_SECRET ?? "",
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }).toString(),
  });
  if (!tokenRes.ok) {
    throw new Error(`TikTok respondeu ${tokenRes.status} na troca do código`);
  }
  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    open_id?: string;
  };
  if (!tokenData.access_token) {
    throw new Error("TikTok não retornou access_token");
  }

  let accountId = tokenData.open_id ?? "";
  let accountName: string | null = null;
  try {
    const userRes = await fetch(
      "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name",
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    if (userRes.ok) {
      const userData = (await userRes.json()) as {
        data?: { user?: { open_id?: string; display_name?: string } };
      };
      const tiktokUser = userData.data?.user;
      if (tiktokUser?.open_id) accountId = tiktokUser.open_id;
      accountName = tiktokUser?.display_name ?? null;
    }
  } catch {
    // mantém o open_id do token, se existir
  }

  if (!accountId) {
    throw new Error("não foi possível identificar a conta do TikTok");
  }

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token ?? null,
    expiresAt: expiresInToIso(tokenData.expires_in),
    accountId,
    accountName,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { platform: string } }
) {
  const url = new URL(request.url);
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;

  const fail = (message: string) => {
    const response = NextResponse.redirect(
      new URL(`/configuracoes?error=${encodeURIComponent(message)}`, origin)
    );
    response.cookies.delete("oauth_state");
    return response;
  };

  if (!isPlatform(params.platform)) {
    return fail("plataforma inválida");
  }
  const platform = params.platform;

  const providerError = url.searchParams.get("error");
  if (providerError) {
    return fail(`autorização negada (${providerError})`);
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return fail("código de autorização ausente");
  }

  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get("oauth_state")?.value;
  if (!state || !cookieState || state !== cookieState) {
    return fail("state inválido — tente conectar novamente");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  const redirectUri = `${origin}/api/oauth/${platform}/callback`;

  let result: TokenResult;
  try {
    if (platform === "youtube") {
      result = await exchangeGoogle(code, redirectUri);
    } else if (platform === "tiktok") {
      result = await exchangeTikTok(code, redirectUri);
    } else {
      result = await exchangeMeta(code, redirectUri);
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "falha na troca do token";
    return fail(message);
  }

  const { error: upsertError } = await supabase
    .from("oauth_connections")
    .upsert(
      {
        user_id: user.id,
        platform,
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
        expires_at: result.expiresAt,
        account_id: result.accountId,
        account_name: result.accountName,
      },
      { onConflict: "user_id,platform,account_id" }
    );

  if (upsertError) {
    return fail("falha ao salvar a conexão");
  }

  const response = NextResponse.redirect(
    new URL(`/configuracoes?connected=${platform}`, origin)
  );
  response.cookies.delete("oauth_state");
  return response;
}
