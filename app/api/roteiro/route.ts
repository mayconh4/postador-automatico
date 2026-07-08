import { NextResponse } from "next/server";
import { extractJson } from "@/lib/ai/json";
import type { Roteiro } from "@/lib/types";

export const dynamic = "force-dynamic";

interface RoteiroRequest {
  tema?: string;
  tom?: string;
  duracao?: string;
  modelo?: string;
  cta?: string;
  contexto?: string;
}

/** Hash simples e determinístico para variar o mock conforme o tema. */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function buildMock(req: Required<Pick<RoteiroRequest, "tema" | "tom" | "duracao">> & RoteiroRequest): Roteiro {
  const { tema, tom, duracao, cta } = req;
  const seed = hashString(`${tema}|${tom}|${duracao}|${cta ?? ""}|${req.contexto ?? ""}`);

  const hooksByTom: Record<string, string[]> = {
    Educativo: [
      `Você sabia que a maioria das pessoas erra quando o assunto é ${tema}? Em ${duracao} eu te explico o que ninguém te contou.`,
      `3 coisas sobre ${tema} que deveriam ter te ensinado na escola — a terceira muda tudo.`,
      `Se você quer entender ${tema} de uma vez por todas, assiste até o final.`,
    ],
    "Polêmico": [
      `Vou falar o que ninguém tem coragem de falar sobre ${tema} — e muita gente vai discordar.`,
      `Tudo o que te falaram sobre ${tema} está errado. E eu vou provar em ${duracao}.`,
      `Opinião impopular: ${tema} não funciona do jeito que você acha.`,
    ],
    Storytelling: [
      `Era uma terça-feira comum quando eu descobri algo sobre ${tema} que mudou completamente a minha visão.`,
      `Deixa eu te contar a história de como ${tema} virou o divisor de águas na minha rotina.`,
      `Ninguém acreditou quando eu comecei com ${tema}. Hoje a história é outra.`,
    ],
    Urgente: [
      `PARA TUDO: se você lida com ${tema}, precisa saber disso AGORA.`,
      `Atenção! Isso sobre ${tema} pode te custar caro se você ignorar.`,
      `Últimos dias para você agir em relação a ${tema} — não deixa pra depois.`,
    ],
    Humor: [
      `Eu tentando explicar ${tema} pra minha família no almoço de domingo... segura essa.`,
      `POV: você descobre ${tema} depois de anos fazendo tudo errado.`,
      `Se ${tema} fosse uma pessoa, com certeza seria aquele parente que só aparece no fim do ano.`,
    ],
  };

  const hooks = hooksByTom[tom] ?? hooksByTom["Educativo"];
  const hook = hooks[seed % hooks.length];

  const corpoVariations = [
    `Primeiro ponto: entenda o contexto de ${tema} antes de agir — a maioria pula essa etapa e paga o preço depois.\n\nSegundo ponto: aplique a regra dos 80/20. Foque no que realmente gera resultado em ${tema} e ignore o resto.\n\nTerceiro ponto: consistência vence intensidade. Pequenos passos diários com ${tema} valem mais do que um esforço gigante uma vez por mês.`,
    `O erro número 1 em ${tema} é começar sem um objetivo claro. Defina onde você quer chegar.\n\nDepois, monte um plano simples: uma ação por dia relacionada a ${tema}. Nada de complicar.\n\nPor fim, meça os resultados semanalmente. O que não é medido em ${tema}, não é melhorado.`,
    `Existem 3 níveis quando falamos de ${tema}: o iniciante, que só consome conteúdo; o intermediário, que testa sem método; e o avançado, que executa com estratégia.\n\nPara subir de nível, você precisa de clareza, repetição e feedback.\n\nE o atalho? Aprender com quem já passou pelo caminho de ${tema} — é isso que encurta anos de tentativa e erro.`,
  ];
  const corpo = corpoVariations[(seed >> 3) % corpoVariations.length];

  const ctaFinal =
    cta && cta.trim().length > 0
      ? cta.trim()
      : [
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
    new Set([
      ...baseTags,
      "#viral",
      "#reels",
      "#dicas",
      "#conteudodevalor",
      "#foryou",
    ])
  ).slice(0, 8);

  return {
    hook,
    corpo,
    cta: ctaFinal,
    hashtags,
    duracao_estimada: duracao,
  };
}

/** Extrai o primeiro objeto JSON válido de um texto (com ou sem cercas de código). */

export async function POST(request: Request) {
  let body: RoteiroRequest;
  try {
    body = (await request.json()) as RoteiroRequest;
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  const tema = (body.tema ?? "").trim();
  if (!tema) {
    return NextResponse.json({ error: "Informe o tema do roteiro" }, { status: 400 });
  }
  const tom = body.tom?.trim() || "Educativo";
  const duracao = body.duracao?.trim() || "60s";
  const modelo = body.modelo?.trim() || "anthropic/claude-sonnet-4.5";
  const cta = body.cta?.trim() || "";
  const contexto = body.contexto?.trim() || "";

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    const roteiro = buildMock({ tema, tom, duracao, cta, contexto });
    return NextResponse.json({ roteiro, source: "mock" });
  }

  const prompt = [
    `Você é um roteirista especialista em vídeos curtos virais (Reels, Shorts, TikTok) para o público brasileiro.`,
    ``,
    `Crie um roteiro de vídeo curto em português do Brasil com as seguintes especificações:`,
    `- Tema/ideia: ${tema}`,
    `- Tom: ${tom}`,
    `- Duração alvo: ${duracao} (o texto falado deve caber nessa duração)`,
    cta ? `- CTA desejado: ${cta}` : `- CTA: sugira um CTA forte e natural`,
    contexto ? `- Contexto adicional: ${contexto}` : ``,
    ``,
    `Responda APENAS com um objeto JSON válido, sem comentários nem texto adicional, no formato:`,
    `{"hook": "frase de abertura impactante (1-2 frases)", "corpo": "desenvolvimento do roteiro, texto falado, pode ter quebras de linha", "cta": "chamada para ação final", "hashtags": ["#tag1", "#tag2", "..."]}`,
    ``,
    `Regras: o hook precisa prender a atenção nos primeiros 3 segundos; o corpo deve ser direto e falado em linguagem natural; inclua de 5 a 8 hashtags relevantes em português.`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelo,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenRouter respondeu ${res.status}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(content);

    if (!parsed || typeof parsed.hook !== "string" || typeof parsed.corpo !== "string") {
      // resposta fora do formato — usa fallback determinístico
      const roteiro = buildMock({ tema, tom, duracao, cta, contexto });
      return NextResponse.json({ roteiro, source: "mock" });
    }

    const roteiro: Roteiro = {
      hook: parsed.hook,
      corpo: parsed.corpo,
      cta: typeof parsed.cta === "string" && parsed.cta ? parsed.cta : cta || "Me segue para mais conteúdos como esse!",
      hashtags: Array.isArray(parsed.hashtags)
        ? (parsed.hashtags as unknown[]).filter((h): h is string => typeof h === "string").slice(0, 10)
        : [],
      duracao_estimada: duracao,
    };
    return NextResponse.json({ roteiro, source: "ai" });
  } catch {
    const roteiro = buildMock({ tema, tom, duracao, cta, contexto });
    return NextResponse.json({ roteiro, source: "mock" });
  }
}
