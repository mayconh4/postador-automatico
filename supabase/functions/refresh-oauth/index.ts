// ===== ISSUE-022 (apoio): renovação de tokens OAuth prestes a expirar =====
// Sem body. Varre oauth_connections com expires_at < now()+30min e
// refresh_token não nulo, renova por plataforma e retorna {refreshed, failed[]}.
// Chamada com service role renova todas as conexões; com JWT de usuário,
// apenas as conexões do próprio usuário.

import { errorMessage, errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { adminClient, isServiceRoleRequest, userIdFromAuthHeader } from "../_shared/supabase.ts";

interface RefreshResult {
  access_token: string;
  refresh_token: string | null;
  expires_in: number; // segundos
}

async function refreshConnection(conn: any): Promise<RefreshResult> {
  switch (conn.platform) {
    case "youtube": {
      const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
      const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
      if (!clientId || !clientSecret) {
        throw new Error("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET não configuradas");
      }
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: conn.refresh_token,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.access_token) {
        throw new Error(
          json?.error_description ?? json?.error ?? `Google respondeu ${res.status}`,
        );
      }
      return {
        access_token: json.access_token,
        // o Google normalmente não devolve novo refresh_token — mantém o atual
        refresh_token: json.refresh_token ?? null,
        expires_in: Number(json.expires_in ?? 3600),
      };
    }

    case "instagram":
    case "facebook": {
      const appId = Deno.env.get("META_APP_ID");
      const appSecret = Deno.env.get("META_APP_SECRET");
      if (!appId || !appSecret) {
        throw new Error("META_APP_ID/META_APP_SECRET não configuradas");
      }
      // A Meta não usa refresh_token clássico: troca um token long-lived
      // válido por outro (fb_exchange_token). Guardamos o long-lived também
      // em refresh_token para passar no filtro.
      const params = new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: conn.refresh_token ?? conn.access_token,
      });
      const res = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${params}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.access_token) {
        throw new Error(json?.error?.message ?? `Graph API respondeu ${res.status}`);
      }
      return {
        access_token: json.access_token,
        refresh_token: json.access_token, // novo long-lived vira o "refresh"
        expires_in: Number(json.expires_in ?? 60 * 24 * 60 * 60), // padrão ~60 dias
      };
    }

    case "tiktok": {
      const clientKey = Deno.env.get("TIKTOK_CLIENT_KEY");
      const clientSecret = Deno.env.get("TIKTOK_CLIENT_SECRET");
      if (!clientKey || !clientSecret) {
        throw new Error("TIKTOK_CLIENT_KEY/TIKTOK_CLIENT_SECRET não configuradas");
      }
      const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: conn.refresh_token,
          client_key: clientKey,
          client_secret: clientSecret,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.access_token) {
        throw new Error(
          json?.error_description ?? json?.error ?? `TikTok respondeu ${res.status}`,
        );
      }
      return {
        access_token: json.access_token,
        refresh_token: json.refresh_token ?? null,
        expires_in: Number(json.expires_in ?? 24 * 60 * 60),
      };
    }

    default:
      throw new Error(`Plataforma desconhecida: ${conn.platform}`);
  }
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const isService = isServiceRoleRequest(req);
    const userId = isService ? null : await userIdFromAuthHeader(req);
    if (!isService && !userId) return errorResponse("Não autenticado", 401);

    const supabase = adminClient();
    const threshold = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    let query = supabase
      .from("oauth_connections")
      .select("*")
      .not("refresh_token", "is", null)
      .lt("expires_at", threshold);
    if (userId) query = query.eq("user_id", userId);

    const { data: connections, error } = await query;
    if (error) throw new Error(`Erro ao listar conexões: ${error.message}`);

    let refreshed = 0;
    const failed: { id: string; platform: string; error: string }[] = [];

    for (const conn of connections ?? []) {
      // conexões demo não têm o que renovar
      if (typeof conn.access_token === "string" && conn.access_token.startsWith("demo")) {
        continue;
      }
      try {
        const result = await refreshConnection(conn);
        const updates: Record<string, unknown> = {
          access_token: result.access_token,
          expires_at: new Date(Date.now() + result.expires_in * 1000).toISOString(),
        };
        if (result.refresh_token) updates.refresh_token = result.refresh_token;

        const { error: upError } = await supabase
          .from("oauth_connections")
          .update(updates)
          .eq("id", conn.id);
        if (upError) throw new Error(`Erro ao salvar token: ${upError.message}`);
        refreshed++;
      } catch (err) {
        failed.push({
          id: conn.id,
          platform: conn.platform,
          error: errorMessage(err, "Falha ao renovar token"),
        });
      }
    }

    return jsonResponse({ refreshed, failed });
  } catch (err) {
    return errorResponse(errorMessage(err, "Erro inesperado no refresh-oauth"), 500);
  }
});
