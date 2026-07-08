import { NextResponse } from "next/server";
import { extractJson } from "@/lib/ai/json";
import type { ReferenceInsights } from "@/lib/types";

export const dynamic = "force-dynamic";

interface InsightPostInput {
  title?: string | null;
  caption?: string | null;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  engagement_rate?: number;
  post_type?: string | null;
}

interface InsightCommentInput {
  text?: string;
  likes?: number;
  sentiment?: string | null;
}

interface InsightsRequest {
  reference_id?: string;
  username?: string;
  platform?: string;
  niche?: string | null;
  posts?: InsightPostInput[];
  comments?: InsightCommentInput[];
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function pick<T>(arr: T[], seed: number, count: number): T[] {
  const out: T[] = [];
  for (let i = 0; i < count && i < arr.length; i++) {
    out.push(arr[(seed + i * 7) % arr.length]);
  }
  return Array.from(new Set(out));
}

function buildMock(req: InsightsRequest): ReferenceInsights {
  const posts = req.posts ?? [];
  const seed = hashString(
    `${req.reference_id ?? ""}|${req.username ?? ""}|${posts.length}`
  );

  const totalViews = posts.reduce((s, p) => s + (p.views ?? 0), 0);
  const avgEr =
    posts.length > 0
      ? posts.reduce((s, p) => s + Number(p.engagement_rate ?? 0), 0) /
        posts.length
      : 0;
  const topTitle = [...posts].sort(
    (a, b) => Number(b.engagement_rate ?? 0) - Number(a.engagement_rate ?? 0)
  )[0]?.title;

  const niche = req.niche || "do nicho";

  const viralPatterns = [
    "Vídeos curtos (30-60s) com promessa clara no título têm engajamento acima da média do perfil",
    "Ganchos com números ('3 segredos', '5 erros') aparecem nos posts de maior alcance",
    "Conteúdo que resolve uma dor específica gera mais comentários e salvamentos",
    "CTAs pedindo comentário ('comenta EU QUERO') multiplicam a taxa de comentários",
    "Posts com tom de urgência ou alerta ('cuidado', 'para tudo') têm mais compartilhamentos",
    "Storytelling pessoal no início prende a retenção nos primeiros segundos",
    "Listas e passo a passo são os formatos mais salvos pela audiência",
  ];

  const hooks = [
    "PARA TUDO: você precisa saber disso antes de continuar...",
    "Ninguém te conta isso, mas...",
    "3 erros que estão te impedindo de ter resultado",
    "Se você faz isso, pare AGORA",
    "A verdade sobre [tema] que escondem de você",
    "Você sabia que 90% das pessoas erra nisso?",
    "Anota aí porque isso vai mudar seu jogo",
  ];

  const formats = [
    "Vídeo falado direto para a câmera com legendas grandes",
    "Lista rápida (3-5 itens) com cortes dinâmicos",
    "Storytelling curto com virada no final",
    "Antes e depois com prova social",
    "Reação/dueto comentando casos reais",
  ];

  const recommendations = [
    `Replique a estrutura do post de maior engajamento${topTitle ? ` ("${topTitle}")` : ""} trocando o tema, mantendo gancho + desenvolvimento + CTA`,
    "Use ganchos com números e promessa específica nos 3 primeiros segundos",
    "Termine sempre com CTA de comentário ou salvamento — é o que mais pesa no algoritmo",
    "Poste de 4 a 6 vezes por semana em horários consistentes",
    "Responda os comentários mais curtidos com novos vídeos (loop de conteúdo)",
    `Adapte os temas campeões desse perfil para a sua audiência ${niche !== "do nicho" ? `de ${niche}` : ""}`.trim(),
  ];

  return {
    summary: `Análise de ${posts.length} posts do perfil${req.username ? ` @${req.username}` : ""}: média de engajamento de ${avgEr.toFixed(2)}% e ${totalViews.toLocaleString("pt-BR")} visualizações somadas. O perfil cresce apoiado em ganchos fortes, conteúdo que resolve dores específicas ${niche !== "do nicho" ? `do nicho de ${niche}` : "do nicho"} e CTAs que incentivam comentários. Os posts de melhor performance combinam títulos com promessa clara e formato curto e dinâmico.`,
    viral_patterns: pick(viralPatterns, seed, 4),
    hooks: pick(hooks, seed + 3, 5),
    best_formats: pick(formats, seed + 5, 3),
    posting_frequency: "4 a 6 posts por semana, com picos de engajamento entre 12h e 14h e após as 19h",
    tone: "Direto, próximo e didático, com senso de urgência nos ganchos",
    recommendations: pick(recommendations, seed + 1, 5),
  };
}

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const arr = v.filter((x): x is string => typeof x === "string");
  return arr.length > 0 ? arr : undefined;
}

export async function POST(request: Request) {
  let body: InsightsRequest;
  try {
    body = (await request.json()) as InsightsRequest;
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição inválido" },
      { status: 400 }
    );
  }

  if (!body.reference_id) {
    return NextResponse.json(
      { error: "Informe o reference_id" },
      { status: 400 }
    );
  }

  const posts = (body.posts ?? []).slice(0, 15);
  const comments = (body.comments ?? []).slice(0, 30);

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ insights: buildMock(body), source: "mock" });
  }

  const prompt = [
    `Você é um estrategista de conteúdo especialista em vídeos curtos virais (Reels, Shorts, TikTok) para o mercado brasileiro.`,
    ``,
    `Analise os dados raspados do perfil ${body.username ? `@${body.username}` : "de referência"} (plataforma: ${body.platform ?? "desconhecida"}${body.niche ? `, nicho: ${body.niche}` : ""}).`,
    ``,
    `TOP POSTS (título, caption, métricas):`,
    JSON.stringify(
      posts.map((p) => ({
        titulo: p.title,
        caption: p.caption?.slice(0, 300),
        views: p.views,
        likes: p.likes,
        comentarios: p.comments,
        compartilhamentos: p.shares,
        taxa_engajamento: p.engagement_rate,
        formato: p.post_type,
      }))
    ),
    ``,
    `COMENTÁRIOS MAIS CURTIDOS:`,
    JSON.stringify(
      comments.map((c) => ({
        texto: c.text,
        likes: c.likes,
        sentimento: c.sentiment,
      }))
    ),
    ``,
    `Responda APENAS com um objeto JSON válido em português do Brasil, sem texto adicional, no formato:`,
    `{"summary": "resumo estratégico do que faz esse perfil crescer (3-5 frases)", "viral_patterns": ["padrão viral identificado", "..."], "hooks": ["gancho pronto para usar", "..."], "best_formats": ["formato que mais funciona", "..."], "posting_frequency": "frequência de postagem recomendada", "tone": "tom de voz do perfil", "recommendations": ["recomendação acionável", "..."]}`,
    ``,
    `Regras: 3-5 itens em cada lista; ganchos prontos para copiar e usar; recomendações práticas e específicas.`,
  ].join("\n");

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4.5",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter respondeu ${res.status}`);

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(content);

    if (!parsed || typeof parsed.summary !== "string") {
      return NextResponse.json({ insights: buildMock(body), source: "mock" });
    }

    const insights: ReferenceInsights = {
      summary: parsed.summary,
      viral_patterns: asStringArray(parsed.viral_patterns),
      hooks: asStringArray(parsed.hooks),
      best_formats: asStringArray(parsed.best_formats),
      posting_frequency:
        typeof parsed.posting_frequency === "string"
          ? parsed.posting_frequency
          : undefined,
      tone: typeof parsed.tone === "string" ? parsed.tone : undefined,
      recommendations: asStringArray(parsed.recommendations),
    };
    return NextResponse.json({ insights, source: "ai" });
  } catch {
    return NextResponse.json({ insights: buildMock(body), source: "mock" });
  }
}
