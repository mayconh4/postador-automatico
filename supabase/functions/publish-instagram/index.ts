// ===== ISSUE-024: publicação no Instagram (Reels/Stories) via Graph API =====
// Contrato (chamada interna do publish-now):
//   POST { post, media_url, connection } → { id, url? } | { error }

import {
  errorMessage,
  errorResponse,
  handleOptions,
  jsonResponse,
} from "../_shared/cors.ts";

const GRAPH = "https://graph.facebook.com/v19.0";
const POLL_ATTEMPTS = 20;
const POLL_DELAY_MS = 3000;
const FETCH_TIMEOUT_MS = 30000;

interface PublishBody {
  post?: {
    post_type?: string;
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
      throw new Error("Token expirado — reconecte a conta Instagram em Configurações");
    }
    throw new Error(msg);
  }
  return body;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const body = (await req.json().catch(() => ({}))) as PublishBody;
    const token = body.connection?.access_token;
    const igUserId = body.connection?.account_id;
    const mediaUrl = body.media_url;

    if (!token || !igUserId) {
      return errorResponse("Conexão Instagram inválida (token/conta ausentes)", 400);
    }
    if (!mediaUrl) {
      return errorResponse("media_url é obrigatória", 400);
    }

    const mediaType = body.post?.post_type === "story" ? "STORIES" : "REELS";
    const caption = body.post?.caption ?? "";

    // 1. Cria o container de mídia
    const containerParams = new URLSearchParams({
      media_type: mediaType,
      video_url: mediaUrl,
      access_token: token,
    });
    if (mediaType === "REELS") containerParams.set("caption", caption);

    const container = await graphFetch(
      `${GRAPH}/${igUserId}/media?${containerParams.toString()}`,
      { method: "POST" },
    );
    const creationId = container.id as string | undefined;
    if (!creationId) {
      throw new Error("Graph API não retornou o id do container de mídia");
    }

    // 2. Aguarda o processamento do vídeo
    let ready = false;
    for (let i = 0; i < POLL_ATTEMPTS; i++) {
      const status = await graphFetch(
        `${GRAPH}/${creationId}?fields=status_code&access_token=${encodeURIComponent(token)}`,
      );
      const code = status.status_code as string | undefined;
      if (code === "FINISHED") {
        ready = true;
        break;
      }
      if (code === "ERROR") {
        throw new Error("Instagram rejeitou o vídeo (status ERROR no container)");
      }
      await sleep(POLL_DELAY_MS);
    }
    if (!ready) {
      throw new Error("Tempo esgotado aguardando o Instagram processar o vídeo");
    }

    // 3. Publica o container
    const publishParams = new URLSearchParams({
      creation_id: creationId,
      access_token: token,
    });
    const published = await graphFetch(
      `${GRAPH}/${igUserId}/media_publish?${publishParams.toString()}`,
      { method: "POST" },
    );
    const mediaId = published.id as string | undefined;
    if (!mediaId) throw new Error("media_publish não retornou id");

    // 4. Permalink (best effort)
    let url: string | null = null;
    try {
      const info = await graphFetch(
        `${GRAPH}/${mediaId}?fields=permalink&access_token=${encodeURIComponent(token)}`,
      );
      url = (info.permalink as string | undefined) ?? null;
    } catch {
      // permalink é opcional
    }

    return jsonResponse({ id: mediaId, url });
  } catch (err) {
    return errorResponse(errorMessage(err, "Falha ao publicar no Instagram"), 500);
  }
});
