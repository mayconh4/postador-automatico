import type { Platform } from "@/lib/types";

export interface TrendingVideo {
  id: string;
  platform: Platform;
  title: string;
  author: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;
  durationSeconds: number;
  niche: string;
  gradient: string;
  postedDaysAgo: number;
}

// PRNG determinístico (mulberry32) — seed fixa, sem Math.random
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GRADIENTS = [
  "bg-gradient-to-br from-purple-500 to-pink-500",
  "bg-gradient-to-br from-blue-500 to-cyan-400",
  "bg-gradient-to-br from-amber-500 to-orange-600",
  "bg-gradient-to-br from-emerald-500 to-teal-600",
  "bg-gradient-to-br from-rose-500 to-red-600",
  "bg-gradient-to-br from-indigo-500 to-purple-600",
  "bg-gradient-to-br from-fuchsia-500 to-pink-600",
  "bg-gradient-to-br from-sky-500 to-blue-600",
  "bg-gradient-to-br from-lime-500 to-green-600",
  "bg-gradient-to-br from-violet-500 to-indigo-600",
  "bg-gradient-to-br from-orange-500 to-rose-500",
  "bg-gradient-to-br from-teal-500 to-cyan-600",
];

// [nicho, título, autor] — 50 entradas literais, forte presença do nicho Jurídico
const ENTRIES: [string, string, string][] = [
  ["Jurídico", "Advogado revela o que fazer se você for demitido sem justa causa", "@dr.trabalhista"],
  ["Jurídico", "Você sabia que atraso de voo pode gerar indenização? Entenda seus direitos", "@advogadadoconsumidor"],
  ["Jurídico", "Pensão alimentícia: 3 erros que podem te levar à prisão", "@dra.familia"],
  ["Jurídico", "Trabalhou sem carteira assinada? Veja como garantir seus direitos", "@direitodotrabalhador"],
  ["Jurídico", "INSS negou seu benefício? Faça isso AGORA", "@dr.previdencia"],
  ["Jurídico", "Nome sujo indevidamente? Você pode receber até R$ 10 mil", "@consumidor.legal"],
  ["Jurídico", "Herança: o que acontece quando não existe testamento", "@dra.sucessoes"],
  ["Jurídico", "Fui parado numa blitz: o que a polícia PODE e NÃO PODE fazer", "@dr.penalista"],
  ["Jurídico", "Divórcio: quem fica com o quê? Advogada explica em 60 segundos", "@dra.claudia.familia"],
  ["Jurídico", "Hora extra não paga? Calcule quanto a empresa te deve", "@calculatrabalhista"],
  ["Jurídico", "Comprou online e não chegou? Seus direitos no e-commerce", "@defesadoconsumidor"],
  ["Jurídico", "Aposentadoria por tempo de contribuição ainda existe? A verdade", "@previdencia.facil"],
  ["Jurídico", "Vizinho barulhento: o que a lei diz e como resolver de vez", "@dr.civilista"],
  ["Jurídico", "Assédio moral no trabalho: como provar e quanto vale a indenização", "@advogada.talita"],
  ["Jurídico", "Golpe do PIX: o banco é obrigado a devolver seu dinheiro?", "@direitobancario"],
  ["Finanças", "Como saí das dívidas ganhando salário mínimo", "@financasnareal"],
  ["Finanças", "3 investimentos que rendem mais que a poupança", "@investidor.iniciante"],
  ["Finanças", "O erro que 90% comete no cartão de crédito", "@educafinanceira"],
  ["Finanças", "Quanto você precisa investir por mês para viver de renda", "@rumoaomilhao"],
  ["Saúde", "Médico explica: 5 sinais de que seu corpo pede ajuda", "@dr.saudeemdia"],
  ["Saúde", "O que acontece com seu corpo quando você dorme 8 horas", "@vidasaudavel.oficial"],
  ["Saúde", "Nutricionista revela o café da manhã ideal", "@nutri.carol"],
  ["Fitness", "Treino de 15 minutos para quem não tem tempo", "@personal.rafa"],
  ["Fitness", "O exercício que queima mais calorias (não é corrida)", "@fit.sem.desculpa"],
  ["Fitness", "3 erros que travam sua hipertrofia", "@maromba.cientifica"],
  ["Educação", "Técnica de estudo que me fez passar em 1º lugar", "@aprovadonaprova"],
  ["Educação", "Como memorizar qualquer coisa em 5 passos", "@estudaquepassa"],
  ["Educação", "O método pomodoro está errado? Veja o que a ciência diz", "@foco.nos.estudos"],
  ["Beleza", "Skincare noturno em 4 passos simples", "@pele.perfeita"],
  ["Beleza", "O erro que está estragando seu cabelo", "@cabelos.dos.sonhos"],
  ["Gastronomia", "Receita de brigadeiro gourmet que vende MUITO", "@doce.lucro"],
  ["Gastronomia", "Macarrão de panela só: pronto em 12 minutos", "@cozinha.pratica"],
  ["Gastronomia", "O segredo do arroz soltinho de restaurante", "@chef.emcasa"],
  ["Tecnologia", "5 funções escondidas do seu celular", "@dicas.tech"],
  ["Tecnologia", "IA gratuita que faz seu trabalho em minutos", "@futuro.digital"],
  ["Tecnologia", "Testei o gadget mais estranho de 2026", "@review.br"],
  ["Imobiliário", "Vale a pena comprar imóvel na planta? A conta real", "@corretor.sincero"],
  ["Imobiliário", "Como comprar seu primeiro apartamento com pouca entrada", "@meuprimeiroimovel"],
  ["Marketing", "O gatilho mental que dobrou minhas vendas", "@marketing.raiz"],
  ["Marketing", "Como viralizar no Instagram em 2026 (funciona mesmo)", "@social.growth"],
  ["Marketing", "Copy de 1 frase que vende sozinha", "@copy.queconverte"],
  ["Humor", "POV: você disse 'só mais um episódio' às 23h", "@rindoatoa"],
  ["Humor", "Tipos de pessoa na reunião de segunda-feira", "@humor.corporativo"],
  ["Humor", "Quando a mãe manda 'vem cá' do outro cômodo", "@familia.memes"],
  ["Jurídico", "Cobrança abusiva por telefone? Grave e ganhe indenização", "@dr.consumerista"],
  ["Jurídico", "Auxílio-doença: por que o INSS corta e como reverter", "@beneficio.garantido"],
  ["Jurídico", "Contrato de aluguel: 5 cláusulas que você NUNCA deve aceitar", "@dra.imobiliaria"],
  ["Jurídico", "Justa causa: o que a empresa precisa provar para te demitir", "@trabalhista.semjuridiques"],
  ["Finanças", "Imposto de renda: 4 deduções que quase ninguém usa", "@leao.domado"],
  ["Saúde", "Ansiedade: técnica de respiração que acalma em 2 minutos", "@mente.leve"],
];

const PLATFORM_CYCLE: Platform[] = ["instagram", "tiktok", "youtube", "facebook"];

function buildTrending(): TrendingVideo[] {
  const rand = mulberry32(42);
  return ENTRIES.map(([niche, title, author], i) => {
    const platform = PLATFORM_CYCLE[i % PLATFORM_CYCLE.length];
    const views = Math.floor(50_000 + rand() * 4_950_000);
    const likes = Math.floor(views * (0.03 + rand() * 0.09));
    const comments = Math.floor(likes * (0.02 + rand() * 0.08));
    const shares = Math.floor(likes * (0.05 + rand() * 0.25));
    const engagementRate =
      Math.round(((likes + comments + shares) / views) * 10000) / 100;
    return {
      id: `trend-${String(i + 1).padStart(2, "0")}`,
      platform,
      title,
      author,
      views,
      likes,
      comments,
      shares,
      engagementRate,
      durationSeconds: Math.floor(15 + rand() * 75),
      niche,
      gradient: GRADIENTS[i % GRADIENTS.length],
      postedDaysAgo: Math.floor(rand() * 14) + 1,
    };
  });
}

export const TRENDING_VIDEOS: TrendingVideo[] = buildTrending();
