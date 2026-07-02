// ===== ISSUE-039: análise de padrões virais do nicho jurídico =====
// Contrato: POST { legal_case_id, area, publico }
//        → { patterns: [{pattern_type, hook, structure, cta, score, analysis, metrics}], source }

import {
  errorMessage,
  errorResponse,
  handleOptions,
  jsonResponse,
} from "../_shared/cors.ts";
import { chatJSON } from "../_shared/openrouter.ts";

interface AnalyzeBody {
  legal_case_id?: string;
  area?: string;
  publico?: string;
}

interface Pattern {
  pattern_type: string;
  hook: string;
  structure: string;
  cta: string;
  score: number;
  analysis: string;
  metrics: { views_estimadas: string; er_estimado: string };
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function mockPatterns(area: string, seedInput: string): Pattern[] {
  const seed = hashString(seedInput || area || "juridico");
  const areaLabel = area || "Direito";
  const base: Pattern[] = [
    {
      pattern_type: "Mito vs Verdade",
      hook: `"Todo mundo acredita nisso sobre ${areaLabel.toLowerCase()} — e está errado."`,
      structure:
        "1) Apresenta o mito popular; 2) Quebra com a regra real citando a lei; 3) Exemplo prático de 10s; 4) CTA.",
      cta: "Comente MITO se você também acreditava nisso.",
      score: 92,
      analysis:
        "Contraste mito/verdade gera dissonância cognitiva imediata — o espectador fica até o fim para confirmar se estava certo. Alta taxa de compartilhamento para 'corrigir' amigos.",
      metrics: { views_estimadas: "250K–800K", er_estimado: "9–14%" },
    },
    {
      pattern_type: "Você sabia?",
      hook: `"Você sabia que pode ter direito a isso e ninguém te contou?"`,
      structure:
        "1) Pergunta direta com benefício oculto; 2) Requisitos em 3 bullets falados; 3) Prazo/urgência real; 4) CTA de salvamento.",
      cta: "Salva esse vídeo antes que você precise.",
      score: 88,
      analysis:
        "Descoberta de direito desconhecido ativa ganho pessoal imediato. Salvamentos altos sinalizam relevância ao algoritmo e geram alcance composto.",
      metrics: { views_estimadas: "150K–500K", er_estimado: "8–12%" },
    },
    {
      pattern_type: "Caso real anonimizado",
      hook: `"Um cliente chegou no meu escritório chorando. Saiu com R$ 47 mil."`,
      structure:
        "1) Cena emocional em 1 frase; 2) O problema jurídico por trás; 3) A virada (o que a lei garantiu); 4) Moral prática.",
      cta: "Conhece alguém passando por isso? Marca aqui.",
      score: 85,
      analysis:
        "Storytelling com números concretos une emoção e prova social. Marcações em comentários expandem o alcance para o público exato.",
      metrics: { views_estimadas: "120K–400K", er_estimado: "7–11%" },
    },
    {
      pattern_type: "3 erros que custam caro",
      hook: `"3 erros em ${areaLabel.toLowerCase()} que te fazem perder dinheiro — o 2º quase todo mundo comete."`,
      structure:
        "1) Promessa numerada; 2) Erro + consequência + correção (x3, ritmo rápido); 3) Recapitulação de 5s; 4) CTA.",
      cta: "Segue o perfil pra não cair no próximo.",
      score: 82,
      analysis:
        "Listas numeradas criam loop de retenção ('qual é o 2º?'). Formato replicável em série — sustenta calendário semanal.",
      metrics: { views_estimadas: "100K–350K", er_estimado: "6–10%" },
    },
    {
      pattern_type: "Pergunta polêmica",
      hook: `"O patrão pode fazer isso? A resposta divide opiniões."`,
      structure:
        "1) Situação-limite cotidiana; 2) Enquete implícita (pode/não pode); 3) Resposta com base legal; 4) CTA de debate.",
      cta: "Discorda? Escreve nos comentários por quê.",
      score: 79,
      analysis:
        "Polêmica controlada maximiza comentários — o sinal mais pesado nos algoritmos de distribuição. Exige moderação da seção de comentários.",
      metrics: { views_estimadas: "90K–300K", er_estimado: "8–13%" },
    },
    {
      pattern_type: "Direito negado",
      hook: `"Te negaram isso? Saiba o que fazer nos próximos 30 dias."`,
      structure:
        "1) Dor específica (negativa); 2) Passo a passo de reação (3 passos); 3) Documento/prova essencial; 4) CTA.",
      cta: "Compartilha com quem recebeu um NÃO injusto.",
      score: 76,
      analysis:
        "Fala com quem já sofreu o problema — intenção altíssima. Conversão forte para contato direto/consulta.",
      metrics: { views_estimadas: "60K–200K", er_estimado: "6–9%" },
    },
    {
      pattern_type: "Reação a notícia",
      hook: `"Saiu decisão nova e muda tudo para você que é CLT."`,
      structure:
        "1) Manchete recente; 2) Tradução em linguagem simples; 3) Quem é afetado e como agir; 4) CTA.",
      cta: "Ativa o sininho — te aviso da próxima mudança.",
      score: 73,
      analysis:
        "Surfe de trending: relevância temporal dá impulso inicial ao vídeo. Posiciona o advogado como fonte de atualidade confiável.",
      metrics: { views_estimadas: "50K–180K", er_estimado: "5–8%" },
    },
  ];
  // Variação determinística de score (0..4) para diferenciar execuções por caso
  return base.map((p, i) => ({
    ...p,
    score: Math.min(95, p.score + ((seed >> (i * 3)) % 5)),
  }));
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const body = (await req.json().catch(() => ({}))) as AnalyzeBody;
    const area = (body.area ?? "").trim();
    const publico = (body.publico ?? "").trim();
    const caseId = (body.legal_case_id ?? "").trim();

    const system =
      "Você é um estrategista de conteúdo viral especializado no nicho jurídico brasileiro. Responda APENAS com JSON válido.";
    const user = `Analise o nicho jurídico e retorne os padrões de vídeo curto que mais viralizam.
Área: ${area || "Direito em geral"}
Público-alvo: ${publico || "público geral"}

Retorne JSON: {"patterns":[{"pattern_type":string,"hook":string,"structure":string,"cta":string,"score":number 0-100,"analysis":string,"metrics":{"views_estimadas":string,"er_estimado":string}}]} com 6 a 8 padrões, hooks em PT-BR prontos para gravação.`;

    const ai = await chatJSON(system, user);
    if (ai && Array.isArray(ai.patterns) && ai.patterns.length > 0) {
      return jsonResponse({ patterns: ai.patterns, source: "ai" });
    }

    return jsonResponse({
      patterns: mockPatterns(area, `${caseId}|${area}|${publico}`),
      source: "mock",
    });
  } catch (err) {
    return errorResponse(errorMessage(err, "Falha na análise de padrões"), 500);
  }
});
