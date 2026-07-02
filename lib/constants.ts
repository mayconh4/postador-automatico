import type { Platform, PostType } from "@/lib/types";

export const PLATFORMS: {
  id: Platform;
  label: string;
  color: string;
  bgClass: string;
}[] = [
  { id: "instagram", label: "Instagram", color: "#E1306C", bgClass: "bg-pink-500" },
  { id: "youtube", label: "YouTube", color: "#FF0000", bgClass: "bg-red-500" },
  { id: "tiktok", label: "TikTok", color: "#010101", bgClass: "bg-zinc-900" },
  { id: "facebook", label: "Facebook", color: "#1877F2", bgClass: "bg-blue-500" },
];

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  facebook: "Facebook",
};

export const POST_TYPES_BY_PLATFORM: Record<
  Platform,
  { id: PostType; label: string }[]
> = {
  instagram: [
    { id: "reel", label: "Reels" },
    { id: "story", label: "Story" },
    { id: "feed", label: "Feed" },
  ],
  youtube: [
    { id: "short", label: "Shorts" },
    { id: "video", label: "Vídeo" },
  ],
  tiktok: [{ id: "video", label: "Vídeo" }],
  facebook: [
    { id: "reel", label: "Reels" },
    { id: "story", label: "Story" },
    { id: "feed", label: "Feed" },
  ],
};

export const NICHES = [
  "Jurídico",
  "Saúde",
  "Fitness",
  "Finanças",
  "Educação",
  "Beleza",
  "Gastronomia",
  "Tecnologia",
  "Imobiliário",
  "Marketing",
  "Humor",
  "Outro",
];

export const LEGAL_AREAS = [
  "Direito Trabalhista",
  "Direito de Família",
  "Direito do Consumidor",
  "Direito Previdenciário",
  "Direito Penal",
  "Direito Civil",
  "Direito Tributário",
  "Direito Imobiliário",
];

export const AI_MODELS = [
  {
    id: "anthropic/claude-sonnet-4.5",
    label: "Claude Sonnet",
    provider: "Anthropic",
  },
  { id: "openai/gpt-4o", label: "GPT-4o", provider: "OpenAI" },
  {
    id: "google/gemini-2.5-flash",
    label: "Gemini Flash",
    provider: "Google",
  },
];

export const STORAGE_BUCKETS = {
  videos: "videos",
  images: "images",
  audio: "audio",
  exports: "exports",
  batchExports: "batch-exports",
  screenshots: "screenshots",
} as const;

export const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  processing: "Processando",
  published: "Publicado",
  failed: "Falhou",
  cancelled: "Cancelado",
  completed: "Concluído",
  draft: "Rascunho",
  exporting: "Exportando",
  exported: "Exportado",
  scraping: "Raspando",
  active: "Ativo",
  paused: "Pausado",
  archived: "Arquivado",
  approved: "Aprovado",
  scheduled: "Agendado",
};
