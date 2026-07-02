// ===== ISSUE-027: publicação no Facebook (Reels/vídeo de página) =====
// Contrato (chamada interna do publish-now):
//   POST { post, media_url, connection } → { id, url? } | { error }
//
// connection.account_id = id da PÁGINA; connection.access_token = page token.

import {
  errorMessage,
  errorResponse,
  handleOptions,
  jsonResponse,
} from "../_shared/cors.ts";

const GRAPH = "https://graph.facebook.com/v19.0";
const FETCH_TIMEOUT_MS = 30000;

interface PublishBody {
  post?: {
    post_type?: string;
    title?: string | null;
    caption?: string | null;
  };
  media_url?: string;
  connection?: {
    access_token?: string;
    account_id?: string;
  };
}

async function graphFetch(
  url: string,
  init?: RequestInit,
): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = body?.error as Record<string, unknown> | undefined;
    const msg = typeof err?.message === "string"
      ? err.message
      : `Graph API respondeu ${res.status}`;
    if (res.status === 401 || err?.code === 190) {
      throw new Error("Token expirado — reconecte a conta Facebook em Configurações");
    }
    throw new Error(msg);
  }
  return body;
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const body = (await req.json().catch(() => ({}))) as PublishBody;
    const token = body.connection?.access_token;
    const pageId = body.connection?.account_id;
    const mediaUrl = body.media_url;

    if (!token || !pageId) {
      return errorResponse("Conexão Facebook inválida (token/página ausentes)", 400);
    }
    if (!mediaUrl) {
      return errorResponse("media_url é obrigatória", 400);
    }

    const caption = body.post?.caption ?? "";

    if (body.post?.post_type === "reel") {
      // ===== Reels: fluxo em fases (start → upload por URL → finish) =====
      const start = await graphFetch(`${GRAPH}/${pageId}/video_reels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upload_phase: "start",
          access_token: token,
        }),
      });
      const videoId = start.video_id as string | undefined;
      const uploadUrl = start.upload_url as string | undefined;
      if (!videoId || !uploadUrl) {
        throw new Error("Facebook não retornou video_id/upload_url na fase start");
      }

      // upload hospedado: o Facebook baixa o arquivo da URL assinada
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `OAuth ${token}`,
          file_url: mediaUrl,
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!uploadRes.ok) {
        const err = (await uploadRes.json().catch(() => ({}))) as {
          debug_info?: { message?: string };
        };
        throw new Error(
          err.debug_info?.message ?? `Upload do reel falhou (${uploadRes.status})`,
        );
      }

      const finishParams = new URLSearchParams({
        upload_phase: "finish",
        video_id: videoId,
        video_state: "PUBLISHED",
        description: caption,
        access_token: token,
      });
      await graphFetch(
        `${GRAPH}/${pageId}/video_reels?${finishParams.toString()}`,
        { method: "POST" },
      );

      return jsonResponse({
        id: videoId,
        url: `https://www.facebook.com/reel/${videoId}`,
      });
    }

    // ===== Vídeo comum de página (feed): file_url =====
    const published = await graphFetch(`${GRAPH}/${pageId}/videos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_url: mediaUrl,
        description: caption,
        title: body.post?.title ?? undefined,
        access_token: token,
      }),
    });
    const videoId = published.id as string | undefined;
    if (!videoId) throw new Error("Facebook não retornou o id do vídeo");

    return jsonResponse({
      id: videoId,
      url: `https://www.facebook.com/${videoId}`,
    });
  } catch (err) {
    return errorResponse(errorMessage(err, "Falha ao publicar no Facebook"), 500);
  }
});
