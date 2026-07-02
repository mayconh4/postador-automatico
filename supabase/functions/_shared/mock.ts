// ===== Geradores mock determinísticos (mesma entrada → mesma saída) =====
// Usados quando as APIs externas (YouTube, Meta, TikTok, OpenRouter) não
// estão configuradas — mantêm o produto 100% navegável em modo demo.

export interface MockScrapedPost {
  platform_post_id: string;
  title: string;
  caption: string;
  url: string;
  thumbnail_url: string;
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

/** Hash simples e determinístico para variar os mocks conforme a entrada. */
export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

const TITLE_TEMPLATES: ((tema: string) => string)[] = [
  (t) => `3 erros que estão sabotando você em ${t}`,
  (t) => `O segredo de ${t} que ninguém te conta`,
  (t) => `Como eu mudei minha rotina com ${t} em 30 dias`,
  (t) => `PARE de fazer isso em ${t} (urgente)`,
  (t) => `${t}: o guia definitivo em 60 segundos`,
  (t) => `A verdade sobre ${t} que vai te surpreender`,
  (t) => `5 dicas de ${t} que funcionam de verdade`,
  (t) => `Por que 90% das pessoas falham em ${t}`,
  (t) => `Testei ${t} por uma semana — olha o resultado`,
  (t) => `O que eu faria diferente se começasse ${t} hoje`,
  (t) => `Mitos e verdades sobre ${t}`,
  (t) => `Antes e depois: ${t} na prática`,
];

function mockUrl(platform: string, username: string, postId: string): string {
  switch (platform) {
    case "youtube":
      return `https://www.youtube.com/shorts/${postId}`;
    case "instagram":
      return `https://www.instagram.com/reel/${postId}/`;
    case "tiktok":
      return `https://www.tiktok.com/@${username}/video/${postId}`;
    case "facebook":
      return `https://www.facebook.com/reel/${postId}`;
    default:
      return `https://example.com/${postId}`;
  }
}

function defaultPostType(platform: string): string {
  switch (platform) {
    case "youtube":
      return "short";
    case "instagram":
      return "reel";
    default:
      return "video";
  }
}

/**
 * Gera de 8 a 12 posts raspados mock em PT-BR com métricas plausíveis.
 * engagement_rate = (likes + comments) / max(views, 1) * 100
 */
export function mockScrapedPosts(
  platform: string,
  username: string,
  niche?: string | null,
): MockScrapedPost[] {
  const tema = (niche ?? "").trim() || "conteúdo digital";
  const cleanUser = username.replace(/^@/, "");
  const seed = hashString(
    `${platform}|${cleanUser.toLowerCase()}|${tema.toLowerCase()}`,
  );
  const count = 8 + (seed % 5); // 8 a 12 posts
  const posts: MockScrapedPost[] = [];

  for (let i = 0; i < count; i++) {
    const s = hashString(`${seed}:${i}`);
    const title = TITLE_TEMPLATES[s % TITLE_TEMPLATES.length](tema);
    const views = 8000 + (s % 992000); // 8 mil a ~1 milhão
    const likes = Math.floor(views * (0.03 + ((s >> 4) % 9) / 100)); // 3% a 11%
    const comments = Math.max(3, Math.floor(likes * (0.04 + ((s >> 8) % 8) / 100)));
    const shares = Math.floor(likes * (0.02 + ((s >> 12) % 6) / 100));
    const engagementRate = Number(
      (((likes + comments) / Math.max(views, 1)) * 100).toFixed(2),
    );
    const postId = `mock${(s % 46655).toString(36)}${i}`;
    const tag = tema
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 20);

    posts.push({
      platform_post_id: `${platform}-${postId}`,
      title,
      caption:
        `${title}\n\nConteúdo de @${cleanUser} sobre ${tema}. ` +
        `Salva esse post e compartilha com alguém que precisa ver!\n\n` +
        `#${tag || "dicas"} #viral #foryou`,
      url: mockUrl(platform, cleanUser, postId),
      thumbnail_url: `https://picsum.photos/seed/${platform}-${postId}/540/960`,
      views,
      likes,
      comments,
      shares,
      engagement_rate: engagementRate,
      post_type: defaultPostType(platform),
    });
  }
  return posts;
}

const COMMENT_TEMPLATES: {
  build: (title: string) => string;
  sentiment: MockComment["sentiment"];
}[] = [
  { build: (t) => `Melhor conteúdo sobre isso que já vi! "${t}" resume tudo 👏`, sentiment: "positive" },
  { build: () => "Salvei na hora, muito bom!", sentiment: "positive" },
  { build: () => "Finalmente alguém explicando isso de forma simples 🙌", sentiment: "positive" },
  { build: () => "Conteúdo de valor demais, obrigado por compartilhar!", sentiment: "positive" },
  { build: () => "Não concordo com tudo, mas o vídeo é bom.", sentiment: "neutral" },
  { build: () => "Alguém sabe se isso vale para todos os casos?", sentiment: "neutral" },
  { build: () => "Vim pelo For You e fiquei pela qualidade.", sentiment: "positive" },
  { build: () => "Achei meio raso, esperava mais detalhes.", sentiment: "negative" },
  { build: () => "Já tentei isso e não funcionou pra mim 😕", sentiment: "negative" },
  { build: (t) => `Faz um vídeo aprofundando "${t}", por favor!`, sentiment: "neutral" },
  { build: () => "Mandei pro grupo da família inteiro kkkk", sentiment: "positive" },
  { build: () => "Primeira vez que vejo esse perfil, já segui!", sentiment: "positive" },
];

/** Gera de 5 a 8 comentários mock em PT-BR com sentimento. */
export function mockComments(postTitle: string): MockComment[] {
  const title = postTitle || "esse post";
  const seed = hashString(title);
  const count = 5 + (seed % 4); // 5 a 8 comentários
  const comments: MockComment[] = [];
  for (let i = 0; i < count; i++) {
    const s = hashString(`${seed}#${i}`);
    const tpl = COMMENT_TEMPLATES[(s + i * 7) % COMMENT_TEMPLATES.length];
    comments.push({
      text: tpl.build(title),
      likes: s % 480,
      sentiment: tpl.sentiment,
    });
  }
  return comments;
}

const POSITIVE_WORDS = [
  "ótimo", "otimo", "excelente", "amei", "perfeito", "top", "incrível",
  "incrivel", "parabéns", "parabens", "obrigad", "melhor", "sensacional",
  "adorei", "maravilh", "👏", "❤", "🙌", "🔥", "amazing", "great", "love",
];
const NEGATIVE_WORDS = [
  "ruim", "péssimo", "pessimo", "horrível", "horrivel", "odiei", "mentira",
  "enganação", "enganacao", "decepcion", "fraco", "pior", "lixo", "😡", "👎",
  "bad", "worst", "hate", "terrible",
];

/** Heurística simples de sentimento para comentários reais (PT-BR/EN). */
export function guessSentiment(
  text: string,
): "positive" | "negative" | "neutral" {
  const lower = (text || "").toLowerCase();
  let score = 0;
  for (const w of POSITIVE_WORDS) if (lower.includes(w)) score++;
  for (const w of NEGATIVE_WORDS) if (lower.includes(w)) score--;
  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}
