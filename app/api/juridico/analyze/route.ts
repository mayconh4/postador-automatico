import { NextResponse } from "next/server";
import type {
  AnalyzedPattern,
  AnalyzedPatternMetrics,
} from "@/components/juridico/juridico-types";

export const dynamic = "force-dynamic";

interface AnalyzeRequest {
  legal_case_id?: string;
  area?: string | null;
  publico?: string | null;
}

/** Hash simples e determinístico para variar o mock por caso/área. */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

// ===== Mock determinístico de alta qualidade =====

type PatternKey =
  | "mito"
  | "sabia"
  | "caso"
  | "erros"
  | "polemica"
  | "negado"
  | "noticia";

const PATTERN_ORDER: PatternKey[] = [
  "caso",
  "mito",
  "erros",
  "negado",
  "sabia",
  "polemica",
  "noticia",
];

const PATTERN_META: Record<
  PatternKey,
  { type: string; baseScore: number; structure: string; cta: string; analysis: string }
> = {
  mito: {
    type: "Mito vs Verdade",
    baseScore: 88,
    structure:
      "1. Abra repetindo o mito com cara de dúvida, olhando para a câmera (0-3s).\n2. Corte seco e responda: \"MITO!\" (ou \"VERDADE!\") — a revelação só vem depois do corte.\n3. Explique em 2 frases simples o que a lei realmente diz, sem juridiquês.\n4. Dê um exemplo prático do dia a dia do seu público.\n5. Encerre com o CTA de comentário.\nDuração ideal: 30-45s, com legendas grandes na tela.",
    cta: "Comenta EU ACREDITAVA se você caiu nesse mito e salva esse vídeo para consultar depois.",
    analysis:
      "Quebra de crença gera reação imediata: quem acreditava comenta, quem já sabia marca os amigos para corrigi-los. O formato binário (mito/verdade) segura o espectador até o corte da resposta — retenção alta nos primeiros segundos, exatamente o que o algoritmo premia em {area}.",
  },
  sabia: {
    type: "Você sabia?",
    baseScore: 78,
    structure:
      "1. Comece com \"Você sabia que...\" seguido do fato mais surpreendente (0-3s).\n2. Deixe a informação \"respirar\" com uma pausa curta.\n3. Explique o porquê em 3 frases curtas, citando a base legal de forma simples.\n4. Mostre quem tem esse direito e qual é o primeiro passo prático.\n5. Finalize com CTA de salvamento.\nDuração: 30-40s.",
    cta: "Salva esse vídeo e manda para alguém que precisa saber disso hoje.",
    analysis:
      "Curiosidade + benefício direto = compartilhamento. Fatos pouco conhecidos de {area} fazem o espectador se sentir \"por dentro\" e repassar a informação — salvamentos e envios por direct são os sinais mais fortes de distribuição orgânica.",
  },
  caso: {
    type: "Caso real anonimizado",
    baseScore: 91,
    structure:
      "1. Hook com o desfecho impactante do caso, sem revelar tudo (0-3s).\n2. Conte a história em 3 atos: situação → erro ou injustiça → virada com a lei.\n3. Anonimize sempre (\"um cliente\", \"uma pessoa que me procurou\").\n4. Extraia a lição prática: \"se isso acontecer com você, faça X\".\n5. CTA de comentário e seguir.\nDuração: 50-60s.",
    cta: "Comenta aqui embaixo se você conhece alguém que passou por isso — e me segue para mais casos reais.",
    analysis:
      "Storytelling é o formato de maior retenção média: a curva de curiosidade (\"o que aconteceu depois?\") segura até o fim. Casos reais de {area} geram identificação imediata e uma enxurrada de relatos nos comentários — combustível direto para o algoritmo e para pedidos de consulta no direct.",
  },
  erros: {
    type: "3 erros que te fazem perder dinheiro",
    baseScore: 85,
    structure:
      "1. Hook prometendo a lista e avisando que um dos erros é pouco conhecido (0-3s).\n2. Erro 1: o mais comum — passe rápido.\n3. Erro 2: o inesperado — aprofunde um pouco.\n4. Erro 3: o mais caro, citando valores em reais quando possível.\n5. Recapitule em 1 frase e feche com o CTA.\nUse numerais grandes na tela (1, 2, 3). Duração: 45-60s.",
    cta: "Salva agora para não cometer nenhum desses erros e comenta qual deles você já cometeu.",
    analysis:
      "Listas numeradas criam \"loop aberto\": o espectador fica até o item final para não perder nada. Associar cada erro a prejuízo financeiro concreto ativa a aversão à perda — o gatilho mais forte em {area}. É o formato campeão de salvamentos.",
  },
  polemica: {
    type: "Pergunta polêmica",
    baseScore: 74,
    structure:
      "1. Faça a pergunta polêmica olhando direto para a câmera (0-3s).\n2. Apresente o lado A com um argumento forte.\n3. Apresente o lado B com um argumento igualmente forte.\n4. Dê a resposta técnica: o que a lei e os tribunais realmente dizem.\n5. Devolva a pergunta para a audiência no CTA.\nDuração: 40-50s.",
    cta: "E você, concorda? Comenta CONCORDO ou DISCORDO — quero ver esse debate nos comentários.",
    analysis:
      "Polêmica divide a audiência em dois times e cada comentário defende um lado — a taxa de comentários explode. O algoritmo interpreta o debate como alto interesse e distribui para públicos novos. Em {area}, temas do cotidiano garantem que todo mundo tem uma opinião formada.",
  },
  negado: {
    type: "Direito negado",
    baseScore: 82,
    structure:
      "1. Hook direto apontando a negativa ou o abuso que o público sofre (0-3s).\n2. Valide a revolta: \"isso acontece todos os dias\".\n3. Explique por que a prática é ilegal ou questionável, em linguagem simples.\n4. Passo a passo do que fazer: documentar, prazos e onde reclamar.\n5. CTA de comentário + seguir.\nDuração: 50-60s.",
    cta: "Isso já aconteceu com você? Comenta JÁ PASSEI POR ISSO e me segue — seu caso pode virar o próximo vídeo.",
    analysis:
      "Injustiça gera indignação, e indignação gera engajamento: o público marca amigos que passaram pelo mesmo e desabafa nos comentários. Vídeos de \"direito negado\" em {area} posicionam o advogado como defensor do público — além de viralizar, geram pedidos de consulta.",
  },
  noticia: {
    type: "Reação a notícia",
    baseScore: 70,
    structure:
      "1. Mostre a manchete na tela (print ou recorte) junto com a sua reação (0-3s).\n2. Resuma a notícia em 1 frase.\n3. Explique o que muda na prática para o seu público, em 2-3 pontos.\n4. Dê a sua opinião técnica com personalidade.\n5. Feche com o CTA.\nPublique em até 48h após a notícia — timing é tudo. Duração: 45-60s.",
    cta: "Me segue para entender toda notícia jurídica em menos de 1 minuto — sem juridiquês.",
    analysis:
      "Newsjacking pega carona no volume de busca da notícia: a plataforma já está distribuindo o assunto e o seu vídeo entra na onda. A reação com opinião própria diferencia o perfil dos portais e o humaniza. O timing curto exige agilidade, mas o alcance de {area} em alta compensa.",
  },
};

const AREA_HOOKS: Record<string, Record<PatternKey, string>> = {
  "Direito Trabalhista": {
    mito: "MITO ou VERDADE: quem pede demissão sai sem receber nada?",
    sabia:
      "Você sabia que responder mensagens do chefe fora do horário pode virar hora extra na Justiça?",
    caso: "Ela assinou a rescisão sem ler e deixou R$ 12 mil na mesa — só percebeu quando parecia tarde demais.",
    erros:
      "3 erros na demissão que te fazem perder dinheiro — o segundo quase todo mundo comete.",
    polemica:
      "Justa causa por causa de uma publicação no Instagram: a empresa pode ou é abuso?",
    negado:
      "Se você assinou isso na demissão, pode ter perdido dinheiro — e ninguém te avisou.",
    noticia:
      "Saiu decisão nova do TST sobre home office — e isso muda o jogo para quem trabalha de casa.",
  },
  "Direito de Família": {
    mito: "MITO ou VERDADE: quem trai perde tudo no divórcio?",
    sabia:
      "Você sabia que avós podem ser obrigados a pagar pensão alimentícia pelos netos?",
    caso: "Ele pagava pensão por fora, sem recibo, há 3 anos — e quase foi preso mesmo estando \"em dia\".",
    erros:
      "3 erros no divórcio que custam caro — o terceiro pode te fazer perder até a casa.",
    polemica: "Pensão para ex que pode trabalhar: justiça ou abuso?",
    negado:
      "Estão te impedindo de ver seu filho? Isso tem nome, é grave e a lei está do seu lado.",
    noticia:
      "Nova decisão do STJ sobre guarda compartilhada — e ela muda tudo para pais separados.",
  },
  "Direito do Consumidor": {
    mito: "MITO ou VERDADE: produto em promoção não tem direito a troca?",
    sabia:
      "Você sabia que cobrança indevida pode ser devolvida em DOBRO — e com correção?",
    caso: "O nome dele foi negativado por uma dívida que nunca existiu — e a indenização passou de R$ 10 mil.",
    erros:
      "3 erros que te fazem perder dinheiro quando o voo atrasa ou é cancelado.",
    polemica:
      "Estabelecimento pode recusar pagamento em dinheiro? A resposta divide opiniões.",
    negado:
      "Plano de saúde negou seu exame ou cirurgia? Isso pode ser ilegal — e dá para reverter rápido.",
    noticia:
      "Saiu regra nova sobre o golpe do PIX — veja quando o banco é obrigado a devolver o seu dinheiro.",
  },
  "Direito Previdenciário": {
    mito: "MITO ou VERDADE: quem nunca contribuiu para o INSS não recebe nenhum benefício?",
    sabia:
      "Você sabia que o tempo de trabalho rural, mesmo sem carteira assinada, pode contar para a aposentadoria?",
    caso: "O INSS negou o benefício dela 2 vezes — na Justiça, ela recebeu todos os atrasados de uma vez.",
    erros:
      "3 erros que atrasam (ou derrubam) a sua aposentadoria — o primeiro está no seu CNIS agora.",
    polemica: "Revisão da vida toda: vale a pena para você ou é armadilha?",
    negado:
      "Auxílio-doença negado mesmo com laudo médico? Isso é mais comum — e mais reversível — do que parece.",
    noticia:
      "Mudou a fila de perícias do INSS — veja o que fazer para não ficar meses esperando.",
  },
  "Direito Penal": {
    mito: "MITO ou VERDADE: se a vítima \"retirar a queixa\", o processo acaba na hora?",
    sabia:
      "Você sabia que você NÃO é obrigado a desbloquear o seu celular para a polícia?",
    caso: "Ele foi preso por engano num sábado à noite — o que aconteceu na audiência de custódia surpreendeu todo mundo.",
    erros:
      "3 erros que as pessoas cometem numa abordagem policial — e que pioram tudo.",
    polemica:
      "Legítima defesa do patrimônio: até onde você pode ir para proteger a sua casa?",
    negado:
      "Te prenderam sem informar os seus direitos? Isso pode anular provas — e quase ninguém sabe.",
    noticia:
      "Nova lei muda as regras da prisão preventiva — entenda o que isso significa na prática.",
  },
  "Direito Civil": {
    mito: "MITO ou VERDADE: dívida \"caduca\" em 5 anos e você não precisa mais pagar?",
    sabia:
      "Você sabia que negativação por dívida prescrita pode gerar indenização por dano moral?",
    caso: "Ele emprestou dinheiro a um amigo sem contrato — e mesmo assim recuperou tudo na Justiça.",
    erros:
      "3 erros ao assinar contrato de aluguel que custam caro — o fiador precisa ouvir o segundo.",
    polemica:
      "Herança: filho que abandonou os pais deveria ter os mesmos direitos dos outros?",
    negado:
      "A seguradora negou a sua indenização citando \"letras miúdas\"? Muitas dessas cláusulas são nulas.",
    noticia:
      "Decisão nova do STJ sobre juros abusivos em empréstimos — veja se o seu contrato se encaixa.",
  },
  "Direito Tributário": {
    mito: "MITO ou VERDADE: cair na malha fina significa multa na certa?",
    sabia:
      "Você sabia que dá para recuperar impostos pagos a mais nos últimos 5 anos?",
    caso: "A empresa dele quase fechou por uma dívida tributária — um único requerimento mudou tudo.",
    erros:
      "3 erros no Imposto de Renda que te fazem perder dinheiro — e podem te levar à malha fina.",
    polemica:
      "Você sabe quantos meses por ano trabalha só para pagar impostos? O número revolta.",
    negado:
      "Bloquearam a sua conta por dívida fiscal sem avisar? Nem sempre isso é legal.",
    noticia:
      "A reforma tributária vai mexer no seu bolso — veja o que muda para você e para o seu negócio.",
  },
  "Direito Imobiliário": {
    mito: "MITO ou VERDADE: quem mora 5 anos num imóvel vira dono automaticamente?",
    sabia:
      "Você sabia que atraso na entrega do imóvel na planta pode gerar indenização e até aluguel pago pela construtora?",
    caso: "Compraram o apê dos sonhos na planta — a obra atrasou 2 anos e a construtora pagou caro por isso.",
    erros:
      "3 erros ao comprar imóvel que te fazem perder dinheiro — o primeiro acontece antes da assinatura.",
    polemica: "Inquilino que atrasa o aluguel: despejo rápido é justo ou desumano?",
    negado:
      "A construtora se recusa a devolver o seu dinheiro no distrato? A lei diz outra coisa.",
    noticia:
      "Mudança nas regras do financiamento imobiliário — veja se ainda vale a pena comprar agora.",
  },
};

const DEFAULT_HOOKS: Record<PatternKey, string> = {
  mito: "MITO ou VERDADE: quem não pode pagar advogado fica sem defesa no Brasil?",
  sabia:
    "Você sabia que a maioria dos brasileiros abre mão de direitos por pura falta de informação?",
  caso: "Ela quase desistiu de buscar os próprios direitos — uma consulta de 30 minutos mudou o rumo da história.",
  erros: "3 erros que fazem você perder dinheiro por não conhecer os seus direitos.",
  polemica:
    "Justiça brasileira: ela funciona para todo mundo ou só para quem pode pagar?",
  negado:
    "Te negaram um direito garantido por lei e você nem ficou sabendo? Isso é mais comum do que parece.",
  noticia:
    "Essa decisão recente dos tribunais afeta muito mais gente do que a mídia mostrou.",
};

function formatMil(n: number): string {
  if (n >= 1000) {
    const mi = n / 1000;
    return `${mi.toFixed(1).replace(".", ",").replace(/,0$/, "")} mi`;
  }
  return `${n} mil`;
}

function buildMockMetrics(score: number, seed: number): AnalyzedPatternMetrics {
  const low = 40 + score * 3 + (seed % 40);
  const high = low * (3 + (seed % 3));
  const er = 4 + score / 12 + ((seed >> 2) % 10) / 10;
  return {
    views_estimadas: `${formatMil(Math.round(low / 10) * 10)} a ${formatMil(Math.round(high / 10) * 10)} de visualizações`,
    er_estimado: `${er.toFixed(1).replace(".", ",")}%`,
  };
}

function buildMock(area: string, publico: string, caseId: string): AnalyzedPattern[] {
  const hooks = AREA_HOOKS[area] ?? DEFAULT_HOOKS;
  const areaLabel = area || "conteúdo jurídico";
  const seedBase = hashString(`${caseId}|${area}|${publico}`);

  return PATTERN_ORDER.map((key, i) => {
    const meta = PATTERN_META[key];
    const seed = seedBase + i * 97;
    const score = clamp(meta.baseScore + ((seed >> 3) % 9) - 4, 68, 95);
    const analysis = meta.analysis.replace(/\{area\}/g, areaLabel);
    const analysisFinal = publico
      ? `${analysis} Para o público-alvo definido (${publico.slice(0, 120)}), esse formato tende a converter atenção em seguidores qualificados.`
      : analysis;
    return {
      pattern_type: meta.type,
      hook: hooks[key],
      structure: meta.structure,
      cta: meta.cta,
      score,
      analysis: analysisFinal,
      metrics: buildMockMetrics(score, seed),
    };
  });
}

// ===== Parse robusto da resposta da IA =====

function extractJson(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates: string[] = [];
  if (fenced?.[1]) candidates.push(fenced[1]);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) candidates.push(text.slice(start, end + 1));
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // tenta o próximo candidato
    }
  }
  return null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function parseAiPatterns(parsed: Record<string, unknown>): AnalyzedPattern[] {
  if (!Array.isArray(parsed.patterns)) return [];
  const out: AnalyzedPattern[] = [];
  for (const raw of parsed.patterns as unknown[]) {
    if (!raw || typeof raw !== "object") continue;
    const p = raw as Record<string, unknown>;
    const hook = str(p.hook);
    if (!hook) continue;
    const metricsRaw =
      p.metrics && typeof p.metrics === "object"
        ? (p.metrics as Record<string, unknown>)
        : {};
    out.push({
      pattern_type: str(p.pattern_type) || "Padrão viral",
      hook,
      structure: str(p.structure),
      cta: str(p.cta),
      score: clamp(Math.round(Number(p.score) || 70), 0, 100),
      analysis: str(p.analysis),
      metrics: {
        views_estimadas:
          str(metricsRaw.views_estimadas) || "100 mil a 500 mil de visualizações",
        er_estimado: str(metricsRaw.er_estimado) || "6,5%",
      },
    });
  }
  return out.slice(0, 8);
}

export async function POST(request: Request) {
  let body: AnalyzeRequest;
  try {
    body = (await request.json()) as AnalyzeRequest;
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição inválido" },
      { status: 400 }
    );
  }

  const caseId = (body.legal_case_id ?? "").trim();
  if (!caseId) {
    return NextResponse.json(
      { error: "Informe o legal_case_id" },
      { status: 400 }
    );
  }
  const area = (body.area ?? "").trim();
  const publico = (body.publico ?? "").trim();

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      patterns: buildMock(area, publico, caseId),
      source: "mock",
    });
  }

  const prompt = [
    `Você é um estrategista de conteúdo especialista em vídeos curtos virais (Reels, Shorts, TikTok) para advogados brasileiros.`,
    ``,
    `Mapeie os padrões de vídeos jurídicos que mais viralizam no Brasil para o contexto abaixo:`,
    `- Área de atuação: ${area || "Direito (geral)"}`,
    publico ? `- Público-alvo: ${publico}` : `- Público-alvo: público leigo interessado em direitos`,
    ``,
    `Identifique de 6 a 8 padrões virais distintos. Use tipos como: "Mito vs Verdade", "Você sabia?", "Caso real anonimizado", "3 erros que te fazem perder dinheiro", "Pergunta polêmica", "Direito negado", "Reação a notícia".`,
    ``,
    `Responda APENAS com um objeto JSON válido em português do Brasil, sem texto adicional, no formato:`,
    `{"patterns": [{"pattern_type": "tipo do padrão", "hook": "gancho pronto para gravar (1 frase forte)", "structure": "estrutura passo a passo do vídeo (numerada, com tempos)", "cta": "chamada para ação de comentário ou salvamento", "score": 85, "analysis": "por que esse padrão viraliza nessa área (2-3 frases)", "metrics": {"views_estimadas": "faixa estimada de views, ex: 100 mil a 500 mil de visualizações", "er_estimado": "taxa de engajamento estimada, ex: 7,5%"}}]}`,
    ``,
    `Regras: hooks prontos para copiar e gravar, específicos da área informada e sem juridiquês; scores entre 60 e 95 refletindo o potencial viral de cada padrão; estruturas acionáveis passo a passo; CTAs que peçam comentário, salvamento ou compartilhamento.`,
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
    const patterns = parsed ? parseAiPatterns(parsed) : [];

    if (patterns.length < 4) {
      return NextResponse.json({
        patterns: buildMock(area, publico, caseId),
        source: "mock",
      });
    }
    return NextResponse.json({ patterns, source: "ai" });
  } catch {
    return NextResponse.json({
      patterns: buildMock(area, publico, caseId),
      source: "mock",
    });
  }
}
