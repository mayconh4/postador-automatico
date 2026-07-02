// ===== ISSUE-011: scraping de perfil do TikTok =====
// Body: { reference_id }
// A API oficial do TikTok (Research API / Display API) exige app aprovado pelo
// TikTok — por spec, esta função usa mocks determinísticos, com a estrutura
// pronta e comentada para plugar a API oficial no futuro.

import { errorMessage, errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { adminClient, isServiceRoleRequest, userIdFromAuthHeader } from "../_shared/supabase.ts";
import { mockComments, mockScrapedPosts } from "../_shared/mock.ts";

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

// ===== FUTURO: API oficial do TikTok (exige app aprovado) =====
// Quando o app for aprovado no TikTok for Developers, configure
// TIKTOK_RESEARCH_TOKEN e implemente aqui:
//
// async function fetchTikTokPosts(username: string, token: string): Promise<PostRow[]> {
//   // 1) Research API — vídeos públicos por username:
//   //    POST https://open.tiktokapis.com/v2/research/video/query/
//   //         ?fields=id,video_description,like_count,comment_count,share_count,view_count,create_time
//   //    Authorization: Bearer <TIKTOK_RESEARCH_TOKEN>
//   //    body: { query: { and: [{ operation: "EQ", field_name: "username", field_values: [username] }] },
//   //            max_count: 12 }
//   // 2) Mapear cada vídeo para PostRow:
//   //    engagement_rate = (like_count + comment_count) / max(view_count, 1) * 100
//   //    url = `https://www.tiktok.com/@${username}/video/${id}`
//   // 3) Comentários (top 5 dos 3 vídeos com mais views):
//   //    POST https://open.tiktokapis.com/v2/research/video/comment/list/
//   //         ?fields=text,like_count  body: { video_id, max_count: 5 }
//   throw new Error("API oficial do TikTok ainda não configurada");
// }

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
      // Por enquanto sempre mock — veja o bloco comentado acima para a API oficial.
      const source = "mock";
      const posts: PostRow[] = mockScrapedPosts("tiktok", ref.username, ref.niche);

      const { error: delError } = await supabase
        .from("scraped_posts")
        .delete()
        .eq("reference_id", referenceId);
      if (delError) throw new Error(`Erro ao limpar posts antigos: ${delError.message}`);

      const rows = posts.map((p) => ({ ...p, reference_id: referenceId }));
      const { data: inserted, error: insError } = await supabase
        .from("scraped_posts")
        .insert(rows)
        .select("id, title, views");
      if (insError) throw new Error(`Erro ao salvar posts: ${insError.message}`);

      const top = [...(inserted ?? [])]
        .sort((a: any, b: any) => Number(b.views ?? 0) - Number(a.views ?? 0))
        .slice(0, 3);
      const commentRows: Record<string, unknown>[] = [];
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
      const message = errorMessage(err, "Falha ao raspar o perfil do TikTok");
      await supabase
        .from("references")
        .update({ status: "failed", error_message: message.slice(0, 500) })
        .eq("id", referenceId);
      return errorResponse(message, 500);
    }
  } catch (err) {
    return errorResponse(errorMessage(err, "Erro inesperado no scrape-tiktok"), 500);
  }
});
