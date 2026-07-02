// ===== ISSUE-025: publicação no YouTube (Shorts/vídeo) via upload resumable =====
// Contrato (chamada interna do publish-now):
//   POST { post, media_url, connection } → { id, url } | { error }

import {
  errorMessage,
  errorResponse,
  handleOptions,
  jsonResponse,
} from "../_shared/cors.ts";

const UPLOAD_ENDPOINT =
  "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";
const FETCH_TIMEOUT_MS = 30000;
const UPLOAD_TIMEOUT_MS = 180000;

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
      return errorResponse("Conexão YouTube inválida (token ausente)", 400);
    }
    if (!mediaUrl) {
      return errorResponse("media_url é obrigatória", 400);
    }

    // 1. Baixa o vídeo exportado
    const mediaRes = await fetch(mediaUrl, {
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    });
    if (!mediaRes.ok) {
      throw new Error(`Falha ao baixar a mídia (${mediaRes.status})`);
    }
    const videoBytes = await mediaRes.arrayBuffer();

    // 2. Inicia a sessão de upload resumable
    const initRes = await fetch(UPLOAD_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": String(videoBytes.byteLength),
      },
      body: JSON.stringify({
        snippet: {
          title: body.post?.title?.trim() || "Short",
          description: body.post?.caption ?? "",
        },
        status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (initRes.status === 401) {
      throw new Error("Token expirado — reconecte a conta YouTube em Configurações");
    }
    if (!initRes.ok) {
      const err = await initRes.json().catch(() => ({} as Record<string, unknown>));
      const msg = (err as { error?: { message?: string } })?.error?.message;
      throw new Error(msg ?? `YouTube respondeu ${initRes.status} ao iniciar upload`);
    }
    const uploadUrl = initRes.headers.get("Location");
    if (!uploadUrl) {
      throw new Error("YouTube não retornou a URL de upload (header Location)");
    }

    // 3. Envia os bytes do vídeo
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(videoBytes.byteLength),
      },
      body: videoBytes,
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    });
    const uploaded = (await uploadRes.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!uploadRes.ok) {
      const msg = (uploaded as { error?: { message?: string } })?.error?.message;
      throw new Error(msg ?? `Upload falhou (${uploadRes.status})`);
    }

    const videoId = uploaded.id as string | undefined;
    if (!videoId) throw new Error("YouTube não retornou o id do vídeo");

    return jsonResponse({
      id: videoId,
      url: `https://youtube.com/shorts/${videoId}`,
    });
  } catch (err) {
    return errorResponse(errorMessage(err, "Falha ao publicar no YouTube"), 500);
  }
});
