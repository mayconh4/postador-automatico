// Gerador determinístico de dados mock de raspagem (fallback quando a
// edge function scrape-<platform> não está deployada em dev).

export interface MockPost {
  platform_post_id: string;
  title: string;
  caption: string;
  url: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
  post_type: string;
}

export interface MockComment {
  text: string;
  likes: number;
  sentiment: "positive" | "negative" | "neutral";
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** PRNG determinístico (mulberry32). */
function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TOPICS_BY_NICHE: Record<string, string[]> = {
  Jurídico: [
    "seus direitos na demissão sem justa causa",
    "pensão alimentícia: o que ninguém te conta",
    "golpe do PIX: como recuperar seu dinheiro",
    "hora extra não paga",
    "aposentadoria antes dos 60",
    "danos morais em voo cancelado",
    "divórcio rápido e sem briga",
    "nome negativado injustamente",
    "FGTS retido pela empresa",
    "herança: quem tem direito",
    "cobrança indevida na fatura",
    "acidente de trabalho e afastamento",
  ],
  Saúde: [
    "sinais de ansiedade que você ignora",
    "sono ruim e imunidade",
    "alimentação anti-inflamatória",
    "check-up anual: exames essenciais",
    "dor de cabeça: quando se preocupar",
    "hidratação e desempenho mental",
    "vitamina D baixa",
    "intestino e humor",
    "pressão alta silenciosa",
    "jejum: mitos e verdades",
    "postura e dor nas costas",
    "saúde mental no trabalho",
  ],
  Fitness: [
    "treino de 15 minutos em casa",
    "erro que trava sua hipertrofia",
    "cardio em jejum funciona?",
    "proteína: quanto comer por dia",
    "mobilidade para quem trabalha sentado",
    "agachamento perfeito passo a passo",
    "como voltar a treinar depois de parar",
    "suplementos que valem a pena",
    "treino de glúteo sem equipamento",
    "queimar gordura sem perder músculo",
    "descanso: o segredo do resultado",
    "constância vence motivação",
  ],
  Finanças: [
    "onde investir o primeiro salário",
    "sair das dívidas em 6 meses",
    "reserva de emergência do zero",
    "cartão de crédito sem cair em juros",
    "renda extra que realmente funciona",
    "tesouro direto para iniciantes",
    "erro que te deixa pobre todo mês",
    "aposentadoria por conta própria",
    "score de crédito: como subir rápido",
    "fundos imobiliários explicados",
    "orçamento 50/30/20 na prática",
    "inflação comendo seu dinheiro",
  ],
  Educação: [
    "técnica de estudo que aprova em concurso",
    "memorização acelerada",
    "como estudar 4h com foco total",
    "redação nota 1000: estrutura",
    "inglês fluente estudando 30 min por dia",
    "mapa mental do jeito certo",
    "procrastinação: como vencer",
    "revisão espaçada explicada",
    "ENEM: o que mais cai",
    "leitura rápida com retenção",
    "rotina de estudos realista",
    "flashcards que funcionam",
  ],
};

const GENERIC_TOPICS = [
  "o erro que 90% comete nesse nicho",
  "3 segredos que mudaram meu resultado",
  "como começar do absoluto zero",
  "a verdade que ninguém te conta",
  "rotina que transformou meus resultados",
  "ferramenta gratuita que uso todo dia",
  "antes e depois: o que mudou",
  "5 hábitos de quem tem resultado",
  "por que você está estagnado",
  "passo a passo completo",
  "mitos que te atrapalham",
  "o método dos 21 dias",
];

const HOOK_PREFIXES = [
  "PARA TUDO:",
  "Você sabia?",
  "Ninguém te conta isso:",
  "Anota aí:",
  "Cuidado!",
  "3 segundos pra mudar sua visão:",
  "POV:",
  "A real sobre",
];

const CAPTION_ENDINGS = [
  "Salva esse vídeo pra não esquecer! 📌",
  "Compartilha com alguém que precisa ver isso. 🔁",
  "Comenta \"EU QUERO\" que eu te mando o material. 👇",
  "Me segue pra mais conteúdo como esse! ✅",
  "Marca aquele amigo que precisa saber disso. 👀",
  "Deixa nos comentários a sua dúvida! 💬",
];

const POSITIVE_COMMENTS = [
  "Melhor conteúdo que já vi sobre isso, parabéns! 👏",
  "Salvou minha vida, era exatamente o que eu precisava",
  "Explicação simples e direta, ganhou um seguidor!",
  "Finalmente alguém que explica sem enrolação 🙌",
  "Conteúdo de ouro, obrigado por compartilhar!",
  "Já apliquei e funcionou, incrível!",
  "Top demais, manda mais desse assunto por favor",
  "Que aula! Compartilhei com toda minha família",
];

const NEUTRAL_COMMENTS = [
  "E no caso de quem é MEI, funciona igual?",
  "Alguém sabe se isso vale pra todo o Brasil?",
  "Qual o próximo passo depois disso?",
  "Tem vídeo explicando a parte 2?",
  "Onde encontro mais informações sobre isso?",
  "Isso serve também pra quem está começando agora?",
];

const NEGATIVE_COMMENTS = [
  "Não concordo, na prática não é bem assim...",
  "Tentei isso e não funcionou pra mim 😕",
  "Faltou falar dos casos em que não se aplica",
  "Muito genérico, esperava mais detalhes",
];

export function generateMockPosts(
  referenceId: string,
  username: string,
  platform: string,
  niche: string | null
): MockPost[] {
  const seed = hashString(`${referenceId}|${username}|${platform}`);
  const rng = createRng(seed);
  const topics = TOPICS_BY_NICHE[niche ?? ""] ?? GENERIC_TOPICS;

  const count = 8 + Math.floor(rng() * 5); // 8-12
  const posts: MockPost[] = [];

  for (let i = 0; i < count; i++) {
    const topic = topics[(seed + i) % topics.length];
    const prefix = HOOK_PREFIXES[Math.floor(rng() * HOOK_PREFIXES.length)];
    const ending = CAPTION_ENDINGS[Math.floor(rng() * CAPTION_ENDINGS.length)];

    const views = 5000 + Math.floor(rng() * 995000);
    const likeRate = 0.03 + rng() * 0.09;
    const likes = Math.floor(views * likeRate);
    const comments = Math.floor(likes * (0.02 + rng() * 0.08));
    const shares = Math.floor(likes * (0.05 + rng() * 0.2));
    const er = Number((((likes + comments + shares) / views) * 100).toFixed(2));

    const title = `${prefix} ${topic}`.slice(0, 120);
    posts.push({
      platform_post_id: `mock-${seed}-${i}`,
      title,
      caption: `${title}\n\nNesse vídeo eu te mostro, na prática, tudo sobre ${topic} — sem enrolação e do jeito que funciona de verdade.\n\n${ending}`,
      url: null,
      views,
      likes,
      comments,
      shares,
      engagement_rate: er,
      post_type: platform === "youtube" ? "short" : platform === "instagram" ? "reel" : "video",
    });
  }
  return posts;
}

export function generateMockComments(
  postSeedKey: string,
  count?: number
): MockComment[] {
  const seed = hashString(postSeedKey);
  const rng = createRng(seed);
  const total = count ?? 5 + Math.floor(rng() * 4); // 5-8
  const comments: MockComment[] = [];

  for (let i = 0; i < total; i++) {
    const roll = rng();
    let text: string;
    let sentiment: MockComment["sentiment"];
    if (roll < 0.55) {
      text = POSITIVE_COMMENTS[Math.floor(rng() * POSITIVE_COMMENTS.length)];
      sentiment = "positive";
    } else if (roll < 0.85) {
      text = NEUTRAL_COMMENTS[Math.floor(rng() * NEUTRAL_COMMENTS.length)];
      sentiment = "neutral";
    } else {
      text = NEGATIVE_COMMENTS[Math.floor(rng() * NEGATIVE_COMMENTS.length)];
      sentiment = "negative";
    }
    comments.push({ text, likes: Math.floor(rng() * 1200), sentiment });
  }
  return comments;
}
