// ===== ISSUE-009: scraping de canal do YouTube =====
// Body: { reference_id }
// Com YOUTUBE_API_KEY usa a YouTube Data API v3; sem, usa mocks determinísticos.

import { errorMessage, errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { adminClient, isServiceRoleRequest, userIdFromAuthHeader } from "../_shared/supabase.ts";
import { guessSentiment, mockComments, mockScrapedPosts } from "../_shared/mock.ts";

const YT_BASE = "https://www.googleapis.com/youtube/v3";

interface PostRow {
  platform_post_id: string | null;
  title: string | null;
  caption: string | null;
  url: string | null;
  thumbnail_url: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
  post_type: string | null;
}

async function fetchYouTubePosts(username: string, apiKey: string): Promise<PostRow[]> {
  // 1) resolve o canal a partir do @username / nome
  const chRes = await fetch(
    `${YT_BASE}/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(username)}&key=${apiKey}`,
  );
  const chJson = await chRes.json().catch(() => ({}));
  if (!chRes.ok) {
    throw new Error(
      chJson?.error?.message ?? `YouTube API respondeu ${chRes.status} na busca do canal`,
    );
  }
  const channelId: string | undefined =
    chJson?.items?.[0]?.id?.channelId ?? chJson?.items?.[0]?.snippet?.channelId;
  if (!channelId) throw new Error(`Canal "${username}" não encontrado no YouTube`);

  // 2) vídeos mais recentes do canal
  const vRes = await fetch(
    `${YT_BASE}/search?part=snippet&channelId=${channelId}&order=date&maxResults=12&type=video&key=${apiKey}`,
  );
  const vJson = await vRes.json().catch(() => ({}));
  if (!vRes.ok) {
    throw new Error(
      vJson?.error?.message ?? `YouTube API respondeu ${vRes.status} na busca de vídeos`,
    );
  }
  const videoIds: string[] = (vJson?.items ?? [])
    .map((item: any) => item?.id?.videoId)
    .filter((id: any) => typeof id === "string" && id.length > 0);
  if (videoIds.length === 0) {
    throw new Error(`Nenhum vídeo encontrado para o canal "${username}"`);
  }

  // 3) estatísticas + snippet em lote
  const sRes = await fetch(
    `${YT_BASE}/videos?part=statistics,snippet&id=${videoIds.join(",")}&key=${apiKey}`,
  );
  const sJson = await sRes.json().catch(() => ({}));
  if (!sRes.ok) {
    throw new Error(
      sJson?.error?.message ?? `YouTube API respondeu ${sRes.status} ao carregar estatísticas`,
    );
  }

  return (sJson?.items ?? []).map((v: any): PostRow => {
    const views = Number(v?.statistics?.viewCount ?? 0);
    const likes = Number(v?.statistics?.likeCount ?? 0);
    const comments = Number(v?.statistics?.commentCount ?? 0);
    return {
      platform_post_id: v?.id ?? null,
      title: v?.snippet?.title ?? null,
      caption: v?.snippet?.description ?? null,
      url: v?.id ? `https://www.youtube.com/watch?v=${v.id}` : null,
      thumbnail_url:
        v?.snippet?.thumbnails?.high?.url ??
          v?.snippet?.thumbnails?.medium?.url ??
          v?.snippet?.thumbnails?.default?.url ?? null,
      views,
      likes,
      comments,
      shares: 0,
      engagement_rate: Number(
        (((likes + comments) / Math.max(views, 1)) * 100).toFixed(2),
      ),
      post_type: "video",
    };
  });
}

async function fetchTopComments(videoId: string, apiKey: string) {
  try {
    const res = await fetch(
      `${YT_BASE}/commentThreads?part=snippet&videoId=${videoId}&maxResults=5&order=relevance&key=${apiKey}`,
    );
    if (!res.ok) return []; // comentários podem estar desativados no vídeo
    const json = await res.json();
    return (json?.items ?? [])
      .map((item: any) => {
        const c = item?.snippet?.topLevelComment?.snippet;
        const text: string = c?.textOriginal ?? c?.textDisplay ?? "";
        return {
          text,
          likes: Number(c?.likeCount ?? 0),
          sentiment: guessSentiment(text),
        };
      })
      .filter((c: any) => c.text.length > 0);
  } catch {
    return [];
  }
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const body = await req.json().catch(() => ({}));
    const referenceId: string =
      typeof body?.reference_id === "string" ? body.reference_id : "";
    if (!referenceId) {
      return errorResponse("Informe reference_id no corpo da requisição", 400);
    }

    const isService = isServiceRoleRequest(req);
    const userId = isService ? null : await userIdFromAuthHeader(req);
    if (!isService && !userId) return errorResponse("Não autenticado", 401);

    const supabase = adminClient();
    const { data: ref, error: refError } = await supabase
      .from("references")
      .select("*")
      .eq("id", referenceId)
      .maybeSingle();
    if (refError) throw new Error(`Erro ao carregar referência: ${refError.message}`);
    if (!ref) return errorResponse("Referência não encontrada", 404);
    if (userId && ref.user_id !== userId) {
      return errorResponse("Você não tem acesso a esta referência", 403);
    }

    await supabase
      .from("references")
      .update({ status: "scraping", error_message: null })
      .eq("id", referenceId);

    try {
      const apiKey = Deno.env.get("YOUTUBE_API_KEY");
      const source = apiKey ? "api" : "mock";
      const posts: PostRow[] = apiKey
        ? await fetchYouTubePosts(ref.username, apiKey)
        : mockScrapedPosts("youtube", ref.username, ref.niche);

      // limpa dados antigos (scraped_comments caem por cascade)
      const { error: delError } = await supabase
        .from("scraped_posts")
        .delete()
        .eq("reference_id", referenceId);
      if (delError) throw new Error(`Erro ao limpar posts antigos: ${delError.message}`);

      const rows = posts.map((p) => ({ ...p, reference_id: referenceId }));
      const { data: inserted, error: insError } = await supabase
        .from("scraped_posts")
        .insert(rows)
        .select("id, platform_post_id, title, views");
      if (insError) throw new Error(`Erro ao salvar posts: ${insError.message}`);

      // comentários dos 3 vídeos com mais views
      const top = [...(inserted ?? [])]
        .sort((a: any, b: any) => Number(b.views ?? 0) - Number(a.views ?? 0))
        .slice(0, 3);
      const commentRows: Record<string, unknown>[] = [];
      for (const post of top) {
        const comments = apiKey && post.platform_post_id
          ? await fetchTopComments(post.platform_post_id, apiKey)
          : mockComments(post.title ?? "");
        for (const c of comments) {
          commentRows.push({
            scraped_post_id: post.id,
            text: c.text,
            likes: c.likes,
            sentiment: c.sentiment,
          });
        }
      }
      if (commentRows.length > 0) {
        const { error: cError } = await supabase
          .from("scraped_comments")
          .insert(commentRows);
        if (cError) throw new Error(`Erro ao salvar comentários: ${cError.message}`);
      }

      await supabase
        .from("references")
        .update({ status: "completed", error_message: null })
        .eq("id", referenceId);

      return jsonResponse({
        ok: true,
        source,
        posts: (inserted ?? []).length,
        comments: commentRows.length,
      });
    } catch (err) {
      const message = errorMessage(err, "Falha ao raspar o canal do YouTube");
      await supabase
        .from("references")
        .update({ status: "failed", error_message: message.slice(0, 500) })
        .eq("id", referenceId);
      return errorResponse(message, 500);
    }
  } catch (err) {
    return errorResponse(errorMessage(err, "Erro inesperado no scrape-youtube"), 500);
  }
});
