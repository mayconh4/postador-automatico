// ===== ISSUE-026: publicação no TikTok via Content Posting API =====
// Contrato (chamada interna do publish-now):
//   POST { post, media_url, connection } → { publish_id, status? } | { error }
//
// Estratégia: FILE_UPLOAD (baixa o vídeo e sobe em chunks). O método
// PULL_FROM_URL exige domínio verificado no TikTok Developer Portal — o que é
// inviável para signed URLs do Supabase Storage.
//
// Privacidade: apps NÃO auditados pelo TikTok só podem publicar como
// SELF_ONLY (privado). A função consulta creator_info e usa o nível mais
// público permitido; force um nível com a env TIKTOK_PRIVACY_LEVEL.

import {
  errorMessage,
  errorResponse,
  handleOptions,
  jsonResponse,
} from "../_shared/cors.ts";

const INIT_URL = "https://open.tiktokapis.com/v2/post/publish/video/init/";
const STATUS_URL = "https://open.tiktokapis.com/v2/post/publish/status/fetch/";
const CREATOR_INFO_URL =
  "https://open.tiktokapis.com/v2/post/publish/creator_info/query/";
const FETCH_TIMEOUT_MS = 30000;
const UPLOAD_TIMEOUT_MS = 180000;
// Regras do TikTok: chunks de 5–64MB (o último pode ser menor);
// vídeo menor que o chunk vai inteiro em 1 chunk.
const CHUNK_SIZE = 10 * 1024 * 1024;

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

interface TikTokEnvelope<T> {
  data?: T;
  error?: { code?: string; message?: string };
}

async function tiktokPost<T>(
  url: string,
  token: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const parsed = (await res.json().catch(() => ({}))) as TikTokEnvelope<T>;
  if (res.status === 401) {
    throw new Error("Token expirado — reconecte a conta TikTok em Configurações");
  }
  if (!res.ok || (parsed.error?.code && parsed.error.code !== "ok")) {
    throw new Error(parsed.error?.message ?? `TikTok respondeu ${res.status}`);
  }
  return (parsed.data ?? {}) as T;
}

/** Nível de privacidade: env > mais público permitido pelo criador > SELF_ONLY. */
async function resolvePrivacyLevel(token: string): Promise<string> {
  const forced = Deno.env.get("TIKTOK_PRIVACY_LEVEL");
  if (forced) return forced;
  try {
    const info = await tiktokPost<{ privacy_level_options?: string[] }>(
      CREATOR_INFO_URL,
      token,
      {},
    );
    const options = info.privacy_level_options ?? [];
    for (const level of ["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "SELF_ONLY"]) {
      if (options.includes(level)) return level;
    }
  } catch {
    // segue com o padrão seguro
  }
  // Apps não auditados só podem SELF_ONLY — padrão seguro
  return "SELF_ONLY";
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
    const privacyLevel = await resolvePrivacyLevel(token);

    // 1. Baixa o vídeo exportado
    const mediaRes = await fetch(mediaUrl, {
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    });
    if (!mediaRes.ok) {
      throw new Error(`Falha ao baixar a mídia (${mediaRes.status})`);
    }
    const videoBytes = new Uint8Array(await mediaRes.arrayBuffer());
    const videoSize = videoBytes.byteLength;

    // 2. Inicia a publicação (FILE_UPLOAD)
    const chunkSize = videoSize <= CHUNK_SIZE ? videoSize : CHUNK_SIZE;
    const totalChunks = Math.max(1, Math.floor(videoSize / chunkSize));

    const init = await tiktokPost<{ publish_id?: string; upload_url?: string }>(
      INIT_URL,
      token,
      {
        post_info: {
          title,
          privacy_level: privacyLevel,
        },
        source_info: {
          source: "FILE_UPLOAD",
          video_size: videoSize,
          chunk_size: chunkSize,
          total_chunk_count: totalChunks,
        },
      },
    );
    const publishId = init.publish_id;
    const uploadUrl = init.upload_url;
    if (!publishId || !uploadUrl) {
      throw new Error("TikTok não retornou publish_id/upload_url");
    }

    // 3. Sobe os chunks (o último absorve o resto)
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = i === totalChunks - 1 ? videoSize : (i + 1) * chunkSize;
      const chunk = videoBytes.slice(start, end);
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "video/mp4",
          "Content-Length": String(chunk.byteLength),
          "Content-Range": `bytes ${start}-${end - 1}/${videoSize}`,
        },
        body: chunk,
        signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
      });
      if (!uploadRes.ok && uploadRes.status !== 201) {
        throw new Error(`Upload do chunk ${i + 1}/${totalChunks} falhou (${uploadRes.status})`);
      }
    }

    // 4. Consulta o status uma vez (best effort — processamento é assíncrono)
    let status: string | null = null;
    try {
      const statusData = await tiktokPost<{ status?: string; fail_reason?: string }>(
        STATUS_URL,
        token,
        { publish_id: publishId },
      );
      status = statusData.status ?? null;
      if (status === "FAILED") {
        throw new Error(
          `TikTok reportou falha no processamento${statusData.fail_reason ? `: ${statusData.fail_reason}` : ""}`,
        );
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("reportou falha")) throw err;
      // consulta de status é opcional
    }

    return jsonResponse({
      publish_id: publishId,
      id: publishId,
      status,
      privacy_level: privacyLevel,
    });
  } catch (err) {
    return errorResponse(errorMessage(err, "Falha ao publicar no TikTok"), 500);
  }
});
