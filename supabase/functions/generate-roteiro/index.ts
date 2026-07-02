// ===== Gerador de roteiro IA (hook / corpo / CTA / hashtags) =====
// Body: { tema, tom?, duracao?, contexto?, cta?, modelo? }
// Com OPENROUTER_API_KEY usa IA; sem, retorna mock determinístico em PT-BR.

import { errorMessage, errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { chatJSON } from "../_shared/openrouter.ts";
import { hashString } from "../_shared/mock.ts";

interface Roteiro {
  hook: string;
  corpo: string;
  cta: string;
  hashtags: string[];
  duracao_estimada: string;
}

const HOOKS_POR_TOM: Record<string, ((tema: string, duracao: string) => string)[]> = {
  Educativo: [
    (t, d) => `Você sabia que a maioria das pessoas erra quando o assunto é ${t}? Em ${d} eu te explico o que ninguém te contou.`,
    (t) => `3 coisas sobre ${t} que deveriam ter te ensinado na escola — a terceira muda tudo.`,
    (t) => `Se você quer entender ${t} de uma vez por todas, assiste até o final.`,
  ],
  "Polêmico": [
    (t) => `Vou falar o que ninguém tem coragem de falar sobre ${t} — e muita gente vai discordar.`,
    (t, d) => `Tudo o que te falaram sobre ${t} está errado. E eu vou provar em ${d}.`,
    (t) => `Opinião impopular: ${t} não funciona do jeito que você acha.`,
  ],
  Storytelling: [
    (t) => `Era uma terça-feira comum quando eu descobri algo sobre ${t} que mudou completamente a minha visão.`,
    (t) => `Deixa eu te contar a história de como ${t} virou o divisor de águas na minha rotina.`,
    (t) => `Ninguém acreditou quando eu comecei com ${t}. Hoje a história é outra.`,
  ],
  Urgente: [
    (t) => `PARA TUDO: se você lida com ${t}, precisa saber disso AGORA.`,
    (t) => `Atenção! Isso sobre ${t} pode te custar caro se você ignorar.`,
    (t) => `Últimos dias para você agir em relação a ${t} — não deixa pra depois.`,
  ],
  Humor: [
    (t) => `Eu tentando explicar ${t} pra minha família no almoço de domingo... segura essa.`,
    (t) => `POV: você descobre ${t} depois de anos fazendo tudo errado.`,
    (t) => `Se ${t} fosse uma pessoa, seria aquele parente que só aparece no fim do ano.`,
  ],
};

function buildMock(
  tema: string,
  tom: string,
  duracao: string,
  cta: string,
  contexto: string,
): Roteiro {
  const seed = hashString(`${tema}|${tom}|${duracao}|${cta}|${contexto}`);
  const hooks = HOOKS_POR_TOM[tom] ?? HOOKS_POR_TOM["Educativo"];
  const hook = hooks[seed % hooks.length](tema, duracao);

  const corpos = [
    `Primeiro ponto: entenda o contexto de ${tema} antes de agir — a maioria pula essa etapa e paga o preço depois.\n\nSegundo ponto: aplique a regra dos 80/20. Foque no que realmente gera resultado em ${tema} e ignore o resto.\n\nTerceiro ponto: consistência vence intensidade. Pequenos passos diários com ${tema} valem mais do que um esforço gigante uma vez por mês.`,
    `O erro número 1 em ${tema} é começar sem um objetivo claro. Defina onde você quer chegar.\n\nDepois, monte um plano simples: uma ação por dia relacionada a ${tema}. Nada de complicar.\n\nPor fim, meça os resultados semanalmente. O que não é medido em ${tema}, não é melhorado.`,
    `Existem 3 níveis quando falamos de ${tema}: o iniciante, que só consome conteúdo; o intermediário, que testa sem método; e o avançado, que executa com estratégia.\n\nPara subir de nível, você precisa de clareza, repetição e feedback.\n\nE o atalho? Aprender com quem já passou pelo caminho de ${tema}.`,
  ];
  const corpo = corpos[(seed >> 3) % corpos.length];

  const ctaFinal = cta || [
    `Se esse conteúdo sobre ${tema} te ajudou, salva esse vídeo e compartilha com alguém que precisa ver isso.`,
    `Me segue para mais conteúdos como esse sobre ${tema} — toda semana tem novidade por aqui.`,
    `Comenta aqui embaixo a sua maior dúvida sobre ${tema} que eu respondo no próximo vídeo.`,
  ][(seed >> 5) % 3];

  const baseTags = tema
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 3)
    .map((w) => `#${w}`);
  const hashtags = Array.from(
    new Set([...baseTags, "#viral", "#reels", "#dicas", "#conteudodevalor", "#foryou"]),
  ).slice(0, 8);

  return { hook, corpo, cta: ctaFinal, hashtags, duracao_estimada: duracao };
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const body = await req.json().catch(() => ({}));
    const tema: string = typeof body?.tema === "string" ? body.tema.trim() : "";
    if (!tema) return errorResponse("Informe o tema do roteiro", 400);

    const tom: string = (typeof body?.tom === "string" && body.tom.trim()) || "Educativo";
    const duracao: string =
      (typeof body?.duracao === "string" && body.duracao.trim()) || "60s";
    const contexto: string =
      (typeof body?.contexto === "string" && body.contexto.trim()) || "";
    const cta: string = (typeof body?.cta === "string" && body.cta.trim()) || "";
    const modelo: string | undefined =
      typeof body?.modelo === "string" && body.modelo.trim()
        ? body.modelo.trim()
        : undefined;

    const system =
      "Você é um roteirista especialista em vídeos curtos virais (Reels, Shorts, TikTok) " +
      "para o público brasileiro. Responda APENAS com um objeto JSON válido, sem texto adicional.";
    const user = [
      "Crie um roteiro de vídeo curto em português do Brasil:",
      `- Tema/ideia: ${tema}`,
      `- Tom: ${tom}`,
      `- Duração alvo: ${duracao} (o texto falado deve caber nessa duração)`,
      cta ? `- CTA desejado: ${cta}` : "- CTA: sugira um CTA forte e natural",
      contexto ? `- Contexto adicional: ${contexto}` : "",
      "",
      'Formato exato: {"hook": "abertura impactante (1-2 frases)", "corpo": "desenvolvimento falado, pode ter quebras de linha", "cta": "chamada para ação final", "hashtags": ["#tag1", "#tag2"]}',
      "Regras: o hook precisa prender nos primeiros 3 segundos; corpo direto e em linguagem falada; 5 a 8 hashtags relevantes em português.",
    ].filter(Boolean).join("\n");

    const parsed = await chatJSON(system, user, modelo);

    if (parsed && typeof parsed.hook === "string" && typeof parsed.corpo === "string") {
      const roteiro: Roteiro = {
        hook: parsed.hook,
        corpo: parsed.corpo,
        cta: typeof parsed.cta === "string" && parsed.cta
          ? parsed.cta
          : cta || "Me segue para mais conteúdos como esse!",
        hashtags: Array.isArray(parsed.hashtags)
          ? (parsed.hashtags as unknown[])
            .filter((h): h is string => typeof h === "string")
            .slice(0, 10)
          : [],
        duracao_estimada: duracao,
      };
      return jsonResponse({ roteiro, source: "ai" });
    }

    const roteiro = buildMock(tema, tom, duracao, cta, contexto);
    return jsonResponse({ roteiro, source: "mock" });
  } catch (err) {
    return errorResponse(errorMessage(err, "Erro ao gerar o roteiro"), 500);
  }
});
