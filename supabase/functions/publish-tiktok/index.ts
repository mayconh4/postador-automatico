// ===== ISSUE-026: publicação no TikTok via Content Posting API =====
// Contrato (chamada interna do publish-now):
//   POST { post, media_url, connection } → { publish_id, status? } | { error }
//
// Observações: o app TikTok precisa estar aprovado para Direct Post e o
// domínio da media_url verificado (PULL_FROM_URL). Sem isso a API recusa.

import {
  errorMessage,
  errorResponse,
  handleOptions,
  jsonResponse,
} from "../_shared/cors.ts";

const INIT_URL = "https://open.tiktokapis.com/v2/post/publish/video/init/";
const STATUS_URL = "https://open.tiktokapis.com/v2/post/publish/status/fetch/";
const FETCH_TIMEOUT_MS = 30000;

interface PublishBody {
  post?: {
    title?: string | null;
    caption?: string | null;
  };
  media_url?: string;
  connection?: {
    access_token?: string;
  };
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const body = (await req.json().catch(() => ({}))) as PublishBody;
    const token = body.connection?.access_token;
    const mediaUrl = body.media_url;

    if (!token) {
      return errorResponse("Conexão TikTok inválida (token ausente)", 400);
    }
    if (!mediaUrl) {
      return errorResponse("media_url é obrigatória", 400);
    }

    const title = (body.post?.caption ?? body.post?.title ?? "").slice(0, 150);

    // 1. Inicia a publicação (TikTok baixa o vídeo da URL assinada)
    const initRes = await fetch(INIT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        post_info: {
          title,
          privacy_level: "PUBLIC_TO_EVERYONE",
        },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: mediaUrl,
        },
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const init = (await initRes.json().catch(() => ({}))) as {
      data?: { publish_id?: string };
      error?: { code?: string; message?: string };
    };
    if (initRes.status === 401) {
      throw new Error("Token expirado — reconecte a conta TikTok em Configurações");
    }
    if (!initRes.ok || (init.error?.code && init.error.code !== "ok")) {
      throw new Error(
        init.error?.message ?? `TikTok respondeu ${initRes.status} ao iniciar publicação`,
      );
    }
    const publishId = init.data?.publish_id;
    if (!publishId) throw new Error("TikTok não retornou publish_id");

    // 2. Consulta o status uma vez (best effort — o processamento é assíncrono)
    let status: string | null = null;
    try {
      const statusRes = await fetch(STATUS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({ publish_id: publishId }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      const statusBody = (await statusRes.json().catch(() => ({}))) as {
        data?: { status?: string };
      };
      status = statusBody.data?.status ?? null;
      if (status === "FAILED") {
        throw new Error("TikTok reportou falha no processamento do vídeo");
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("reportou falha")) throw err;
      // consulta de status é opcional — publicação segue em processamento
    }

    return jsonResponse({ publish_id: publishId, id: publishId, status });
  } catch (err) {
    return errorResponse(errorMessage(err, "Falha ao publicar no TikTok"), 500);
  }
});
