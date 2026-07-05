// ===== ISSUE-022 (NÚCLEO): worker de publicação, chamado pelo pg_cron =====
// verify_jwt = false no config.toml → a autenticação é validada MANUALMENTE
// aqui: o Authorization precisa ser exatamente "Bearer <SERVICE_ROLE_KEY>".
//
// Fluxo: busca scheduled_posts pendentes vencidos (publish_method=api),
// gera signed URL da mídia, delega para publish-<platform> e aplica a
// lógica de retry (até 3 tentativas, +5min entre elas).

import { errorMessage, errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { adminClient, bearerToken } from "../_shared/supabase.ts";

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  facebook: "Facebook",
};

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5 * 60 * 1000; // 5 minutos
const MEDIA_BUCKETS = ["exports", "batch-exports"];

/** Gera signed URL da mídia tentando os buckets exports e batch-exports. */
async function signedMediaUrl(supabase: any, mediaPath: string): Promise<string> {
  for (const bucket of MEDIA_BUCKETS) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(mediaPath, 3600);
      if (!error && data?.signedUrl) return data.signedUrl;
    } catch {
      // tenta o próximo bucket
    }
  }
  throw new Error(
    `Não foi possível gerar a URL do arquivo "${mediaPath}" (buckets exports/batch-exports)`,
  );
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    // ===== validação manual: só a service role key pode chamar =====
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const token = bearerToken(req);
    if (!serviceKey || !token || token !== serviceKey) {
      return errorResponse(
        "Não autorizado — esta função aceita apenas a service role key",
        401,
      );
    }

    const supabase = adminClient();
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const nowIso = new Date().toISOString();
    // Resgate: se uma execução anterior crashou/estourou o timeout no meio,
    // posts ficam presos em "processing" — a query só busca "pending" e eles
    // nunca mais seriam tentados. Processing parado há 10min volta à fila.
    const staleIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: due, error: dueError } = await supabase
      .from("scheduled_posts")
      .select("*")
      .eq("publish_method", "api")
      .lte("scheduled_at", nowIso)
      .or(`status.eq.pending,and(status.eq.processing,updated_at.lt.${staleIso})`)
      .order("scheduled_at", { ascending: true })
      .limit(10);
    if (dueError) {
      throw new Error(`Erro ao buscar posts agendados: ${dueError.message}`);
    }

    let published = 0;
    let retried = 0;
    let failed = 0;

    for (const post of due ?? []) {
      await supabase
        .from("scheduled_posts")
        .update({ status: "processing" })
        .eq("id", post.id);

      try {
        if (!PLATFORM_LABELS[post.platform]) {
          throw new Error(`Plataforma não suportada: ${post.platform}`);
        }

        // conexão OAuth do usuário na plataforma
        const { data: conns, error: connError } = await supabase
          .from("oauth_connections")
          .select("*")
          .eq("user_id", post.user_id)
          .eq("platform", post.platform)
          .order("updated_at", { ascending: false })
          .limit(1);
        if (connError) {
          throw new Error(`Erro ao buscar conexão OAuth: ${connError.message}`);
        }
        const connection = conns?.[0];
        if (!connection) {
          throw new Error(
            `Conecte sua conta ${PLATFORM_LABELS[post.platform]} em Configurações`,
          );
        }

        // mídia exportada
        if (!post.media_path) {
          throw new Error("Post sem arquivo de mídia (media_path vazio)");
        }
        const mediaUrl = await signedMediaUrl(supabase, post.media_path);

        // conexão demo (sem credenciais reais): simula a publicação para
        // manter o fluxo ponta a ponta funcional em modo demonstração
        if (
          typeof connection.access_token === "string" &&
          connection.access_token.startsWith("demo")
        ) {
          const demoResponse = {
            id: `demo-${post.id}`,
            url: null,
            demo: true,
            message: "Publicação simulada (conexão demo)",
          };
          await supabase
            .from("scheduled_posts")
            .update({
              status: "published",
              publish_response: demoResponse,
              error_message: null,
            })
            .eq("id", post.id);
          await supabase.from("publications").insert({
            scheduled_post_id: post.id,
            platform: post.platform,
            response_id: demoResponse.id,
            url: null,
            status: "sent",
          });
          published++;
          continue;
        }

        // delega para a função da plataforma
        const res = await fetch(
          `${supabaseUrl}/functions/v1/publish-${post.platform}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ post, media_url: mediaUrl, connection }),
          },
        );
        const result = await res.json().catch(() => ({} as Record<string, unknown>));
        if (!res.ok) {
          const msg = typeof (result as any)?.error === "string" && (result as any).error
            ? (result as any).error
            : `publish-${post.platform} respondeu ${res.status}`;
          throw new Error(msg);
        }

        await supabase
          .from("scheduled_posts")
          .update({
            status: "published",
            publish_response: result,
            error_message: null,
          })
          .eq("id", post.id);
        await supabase.from("publications").insert({
          scheduled_post_id: post.id,
          platform: post.platform,
          response_id: (result as any)?.id ?? (result as any)?.publish_id ?? null,
          url: (result as any)?.url ?? null,
          status: "sent",
        });
        published++;
      } catch (err) {
        // ===== lógica de retry =====
        const message = errorMessage(err, "Falha ao publicar").slice(0, 500);
        const attempts = Number(post.retry_count ?? 0) + 1;

        if (attempts < MAX_ATTEMPTS) {
          await supabase
            .from("scheduled_posts")
            .update({
              status: "pending",
              retry_count: attempts,
              scheduled_at: new Date(Date.now() + RETRY_DELAY_MS).toISOString(),
              error_message: message,
            })
            .eq("id", post.id);
          retried++;
        } else {
          await supabase
            .from("scheduled_posts")
            .update({
              status: "failed",
              retry_count: attempts,
              error_message: message,
            })
            .eq("id", post.id);
          await supabase.from("publications").insert({
            scheduled_post_id: post.id,
            platform: post.platform,
            status: "failed",
            error_message: message,
          });
          failed++;
        }
      }
    }

    return jsonResponse({
      processed: (due ?? []).length,
      published,
      retried,
      failed,
    });
  } catch (err) {
    return errorResponse(errorMessage(err, "Erro inesperado no publish-now"), 500);
  }
});
