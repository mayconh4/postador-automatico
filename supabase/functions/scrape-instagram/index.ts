// ===== ISSUE-010: scraping de perfil do Instagram =====
// Body: { reference_id }
// Com IG_GRAPH_TOKEN + IG_BUSINESS_ID usa a Graph API (business_discovery —
// exige conta business própria; veja o README); sem, usa mocks determinísticos.

import { errorMessage, errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { adminClient, isServiceRoleRequest, userIdFromAuthHeader } from "../_shared/supabase.ts";
import { mockComments, mockScrapedPosts } from "../_shared/mock.ts";

const GRAPH = "https://graph.facebook.com/v19.0";

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

/**
 * business_discovery: permite ler a mídia pública de OUTRA conta business a
 * partir da SUA conta business (IG_BUSINESS_ID). Views e comentários de
 * terceiros não são expostos — o engagement usa followers como base.
 */
async function fetchInstagramPosts(
  username: string,
  token: string,
  businessId: string,
): Promise<PostRow[]> {
  const cleanUser = username.replace(/^@/, "");
  const fields =
    `business_discovery.username(${cleanUser})` +
    `{followers_count,media_count,media.limit(12)` +
    `{id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,like_count,comments_count,timestamp}}`;
  const res = await fetch(
    `${GRAPH}/${businessId}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`,
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) {
    throw new Error(
      json?.error?.message ?? `Graph API respondeu ${res.status} no business_discovery`,
    );
  }

  const discovery = json?.business_discovery;
  const followers = Number(discovery?.followers_count ?? 0);
  const media: any[] = discovery?.media?.data ?? [];
  if (media.length === 0) {
    throw new Error(`Nenhuma mídia pública encontrada para @${cleanUser}`);
  }

  return media.map((m: any): PostRow => {
    const likes = Number(m?.like_count ?? 0);
    const comments = Number(m?.comments_count ?? 0);
    const caption: string = m?.caption ?? "";
    return {
      platform_post_id: m?.id ?? null,
      title: caption ? caption.split("\n")[0].slice(0, 120) : null,
      caption: caption || null,
      url: m?.permalink ?? null,
      thumbnail_url: m?.thumbnail_url ?? m?.media_url ?? null,
      views: 0, // business_discovery não expõe views de terceiros
      likes,
      comments,
      shares: 0,
      // sem views disponíveis, o engagement usa a base de seguidores
      engagement_rate: Number(
        (((likes + comments) / Math.max(followers, 1)) * 100).toFixed(2),
      ),
      post_type: m?.media_product_type === "REELS"
        ? "reel"
        : String(m?.media_type ?? "").toLowerCase() || null,
    };
  });
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
      const token = Deno.env.get("IG_GRAPH_TOKEN");
      const businessId = Deno.env.get("IG_BUSINESS_ID");
      const useApi = Boolean(token && businessId);
      const source = useApi ? "api" : "mock";

      const posts: PostRow[] = useApi
        ? await fetchInstagramPosts(ref.username, token as string, businessId as string)
        : mockScrapedPosts("instagram", ref.username, ref.niche);

      const { error: delError } = await supabase
        .from("scraped_posts")
        .delete()
        .eq("reference_id", referenceId);
      if (delError) throw new Error(`Erro ao limpar posts antigos: ${delError.message}`);

      const rows = posts.map((p) => ({ ...p, reference_id: referenceId }));
      const { data: inserted, error: insError } = await supabase
        .from("scraped_posts")
        .insert(rows)
        .select("id, title, views, likes");
      if (insError) throw new Error(`Erro ao salvar posts: ${insError.message}`);

      // A Graph API não permite ler comentários de contas de terceiros —
      // comentários só são gerados em modo mock.
      const commentRows: Record<string, unknown>[] = [];
      if (!useApi) {
        const top = [...(inserted ?? [])]
          .sort((a: any, b: any) => Number(b.views ?? 0) - Number(a.views ?? 0))
          .slice(0, 3);
        for (const post of top) {
          for (const c of mockComments(post.title ?? "")) {
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
      const message = errorMessage(err, "Falha ao raspar o perfil do Instagram");
      await supabase
        .from("references")
        .update({ status: "failed", error_message: message.slice(0, 500) })
        .eq("id", referenceId);
      return errorResponse(message, 500);
    }
  } catch (err) {
    return errorResponse(errorMessage(err, "Erro inesperado no scrape-instagram"), 500);
  }
});
