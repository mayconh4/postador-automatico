// ===== ISSUE-040: geração de conteúdo jurídico replicando padrão viral =====
// Contrato: POST { legal_case_id, pattern, tema, quantidade, area, publico }
//        → { contents: [{title, hook, body, cta, full_script, caption, hashtags[]}], source }

import {
  errorMessage,
  errorResponse,
  handleOptions,
  jsonResponse,
} from "../_shared/cors.ts";
import { chatJSON } from "../_shared/openrouter.ts";

const DISCLAIMER =
  "⚠️ Conteúdo informativo — não substitui consulta com advogado(a).";

interface PatternInput {
  pattern_type?: string | null;
  hook?: string | null;
  structure?: string | null;
  cta?: string | null;
}

interface GenerateBody {
  legal_case_id?: string;
  pattern?: PatternInput | null;
  tema?: string | null;
  quantidade?: number;
  area?: string;
  publico?: string;
}

interface Content {
  title: string;
  hook: string;
  body: string;
  cta: string;
  full_script: string;
  caption: string;
  hashtags: string[];
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

interface MockTema {
  titulo: string;
  hook: string;
  pontos: [string, string, string];
  cta: string;
  tags: string[];
}

const TEMAS: Record<string, MockTema[]> = {
  "Direito Trabalhista": [
    {
      titulo: "Demissão sem justa causa: o cálculo que ninguém confere",
      hook: "Se você foi demitido e só conferiu o valor final, provavelmente perdeu dinheiro.",
      pontos: [
        "Aviso prévio proporcional: 3 dias a mais por ano trabalhado — quase ninguém confere.",
        "Multa de 40% do FGTS incide sobre TODOS os depósitos, inclusive os que o patrão atrasou.",
        "Férias proporcionais + 1/3 entram na conta mesmo com menos de 1 ano de casa.",
      ],
      cta: "Comente CÁLCULO que eu explico como conferir o seu.",
      tags: ["#direitotrabalhista", "#demissao", "#fgts", "#clt", "#direitos"],
    },
    {
      titulo: "Horas extras não pagas: a prova que vale ouro",
      hook: "Trabalhou até tarde e não recebeu? Existe uma prova que os juízes aceitam quase sempre.",
      pontos: [
        "Mensagens de WhatsApp com horário valem como início de prova da jornada.",
        "O registro de ponto britânico (sempre igual) joga a favor do trabalhador.",
        "Testemunha que trabalhou com você no mesmo turno fecha o conjunto probatório.",
      ],
      cta: "Salva esse vídeo — você pode precisar dele um dia.",
      tags: ["#horasextras", "#trabalhista", "#clt", "#justicadotrabalho"],
    },
  ],
  "Direito do Consumidor": [
    {
      titulo: "Voo cancelado: o que a companhia não te conta",
      hook: "Cancelaram seu voo? Você tem mais direitos do que o balcão informa.",
      pontos: [
        "Reacomodação gratuita no próximo voo — mesmo de outra companhia.",
        "Assistência material: comunicação em 1h, alimentação em 2h, hospedagem em 4h.",
        "Dano moral quando há perda de compromisso comprovada.",
      ],
      cta: "Compartilha com aquele amigo que vive viajando.",
      tags: ["#direitodoconsumidor", "#voocancelado", "#anac", "#consumidor"],
    },
    {
      titulo: "Produto com defeito: os 3 prazos que resolvem tudo",
      hook: "A loja disse que não troca? Ela está contando com a sua desistência.",
      pontos: [
        "30 dias para reclamar de produto não durável; 90 para durável.",
        "Fornecedor tem 30 dias para consertar — depois disso você escolhe: troca, dinheiro ou abatimento.",
        "Vício oculto: o prazo conta da descoberta do defeito, não da compra.",
      ],
      cta: "Comente PRAZO e te explico qual vale pro seu caso.",
      tags: ["#consumidor", "#cdc", "#trocadeproduto", "#direitos"],
    },
  ],
  "Direito de Família": [
    {
      titulo: "Pensão alimentícia: 3 verdades que evitam briga",
      hook: "Pensão não é castigo — e esses 3 pontos acabam com 90% das discussões.",
      pontos: [
        "O valor segue o binômio necessidade x possibilidade — não existe tabela fixa.",
        "Desemprego não zera a pensão: ela pode ser fixada em % do salário mínimo.",
        "Atraso autoriza prisão civil — mas o acordo revisional evita chegar lá.",
      ],
      cta: "Manda esse vídeo pra quem precisa ouvir isso hoje.",
      tags: ["#direitodefamilia", "#pensaoalimenticia", "#guarda", "#familia"],
    },
  ],
  "Direito Previdenciário": [
    {
      titulo: "Aposentadoria negada: o erro que o INSS mais comete",
      hook: "O INSS negou seu benefício? Em muitos casos o erro é deles — e é corrigível.",
      pontos: [
        "Vínculos antigos sem registro no CNIS podem ser comprovados com carteira e testemunha.",
        "Tempo especial (insalubridade) é convertido e acelera a aposentadoria.",
        "O recurso administrativo tem prazo de 30 dias — mas a via judicial continua aberta.",
      ],
      cta: "Comente INSS que eu explico o primeiro passo do recurso.",
      tags: ["#previdenciario", "#inss", "#aposentadoria", "#beneficio"],
    },
  ],
};

const GENERIC: MockTema[] = [
  {
    titulo: "O documento que você assina sem ler (e não devia)",
    hook: "Esse papel que te empurram para assinar rápido pode custar caro.",
    pontos: [
      "Cláusulas abusivas são nulas — mas provar é mais fácil antes de assinar.",
      "Foto do documento antes de assinar é hábito que salva processos.",
      "Dúvida na hora? Você tem direito de levar para analisar.",
    ],
    cta: "Segue o perfil pra assinar menos roubada.",
    tags: ["#direito", "#advogado", "#contratos", "#dicasjuridicas"],
  },
  {
    titulo: "Acordo verbal vale? A resposta surpreende",
    hook: "Apertaram as mãos e combinaram tudo. E agora, isso vale na justiça?",
    pontos: [
      "Acordo verbal é contrato válido — o problema é a prova.",
      "Áudios e mensagens reconstruindo o combinado viram prova documental.",
      "Testemunha presencial do acerto tem peso decisivo.",
    ],
    cta: "Salva pra lembrar antes do próximo 'fica combinado assim'.",
    tags: ["#direitocivil", "#contratos", "#acordo", "#advogado"],
  },
];

function mockContents(req: {
  caseId: string;
  area: string;
  tema: string;
  quantidade: number;
  pattern: PatternInput;
}): Content[] {
  const bank = TEMAS[req.area] ?? GENERIC;
  const seed = hashString(
    `${req.caseId}|${req.area}|${req.tema}|${req.pattern.pattern_type ?? ""}`,
  );
  const out: Content[] = [];

  for (let i = 0; i < req.quantidade; i++) {
    const base = bank[(seed + i) % bank.length];
    const titulo = req.tema
      ? `${req.tema.charAt(0).toUpperCase()}${req.tema.slice(1)}: o que a lei realmente garante`
      : base.titulo;
    const hook = req.pattern.hook && i % 2 === 0 ? req.pattern.hook : base.hook;
    const cta = req.pattern.cta && i % 2 === 1 ? req.pattern.cta : base.cta;
    const corpo = base.pontos
      .map((p, idx) => `${idx + 1}. ${p}`)
      .join("\n");
    const script = [
      `[GANCHO — 0-3s]\n${hook}`,
      `[CORPO — 3-45s]\n${corpo}`,
      `[CTA — 45-55s]\n${cta}`,
    ].join("\n\n");

    out.push({
      title: titulo,
      hook,
      body: corpo,
      cta,
      full_script: script,
      caption: `${titulo}\n\n${cta}\n\n${DISCLAIMER}`,
      hashtags: base.tags,
    });
  }
  return out;
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const body = (await req.json().catch(() => ({}))) as GenerateBody;
    const area = (body.area ?? "").trim();
    const publico = (body.publico ?? "").trim();
    const tema = (body.tema ?? "").trim();
    const pattern = body.pattern ?? {};
    const quantidade = Math.min(5, Math.max(1, Math.round(Number(body.quantidade) || 1)));

    const system =
      "Você é um roteirista de vídeos curtos virais para advogados brasileiros. Todo conteúdo deve ser informativo, ético (OAB) e nunca prometer resultado. Responda APENAS com JSON válido.";
    const user = `Gere ${quantidade} roteiro(s) de vídeo curto (45-60s) replicando o padrão viral abaixo.
Área: ${area || "Direito em geral"}
Público: ${publico || "público geral"}
Tema específico: ${tema || "(livre, escolha temas de alta demanda)"}
Padrão: ${JSON.stringify(pattern)}

Cada roteiro: hook de até 3 segundos, corpo com 3 pontos práticos, CTA de engajamento.
A caption DEVE terminar com: "${DISCLAIMER}"
Retorne JSON: {"contents":[{"title":string,"hook":string,"body":string,"cta":string,"full_script":string,"caption":string,"hashtags":string[]}]}`;

    const ai = await chatJSON(system, user);
    if (ai && Array.isArray(ai.contents) && ai.contents.length > 0) {
      const contents = (ai.contents as Content[]).map((c) => ({
        ...c,
        caption: c.caption?.includes(DISCLAIMER)
          ? c.caption
          : `${c.caption ?? ""}\n\n${DISCLAIMER}`.trim(),
      }));
      return jsonResponse({ contents, source: "ai" });
    }

    return jsonResponse({
      contents: mockContents({
        caseId: (body.legal_case_id ?? "").trim(),
        area,
        tema,
        quantidade,
        pattern,
      }),
      source: "mock",
    });
  } catch (err) {
    return errorResponse(errorMessage(err, "Falha na geração de conteúdo"), 500);
  }
});
