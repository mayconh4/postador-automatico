import type { Platform } from "@/lib/types";

export interface BestTimeSlot {
  /** 0 = domingo ... 6 = sábado (getDay do JS) */
  weekday: number;
  /** 0-23 */
  hour: number;
  /** pontuação heurística — maior = melhor */
  score: number;
}

export interface PublishedPostLike {
  platform: Platform;
  scheduled_at: string;
  status: string;
  /** engajamento opcional (curtidas, views etc.) associado ao post */
  engagement?: number;
}

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Slots padrão por plataforma quando não há dados suficientes. */
const DEFAULT_SLOTS: Record<Platform, { weekday: number; hour: number }[]> = {
  instagram: [
    { weekday: 3, hour: 12 },
    { weekday: 2, hour: 19 },
    { weekday: 5, hour: 19 },
  ],
  tiktok: [
    { weekday: 4, hour: 18 },
    { weekday: 2, hour: 21 },
    { weekday: 6, hour: 21 },
  ],
  youtube: [
    { weekday: 4, hour: 17 },
    { weekday: 6, hour: 17 },
    { weekday: 2, hour: 17 },
  ],
  facebook: [
    { weekday: 3, hour: 20 },
    { weekday: 5, hour: 20 },
    { weekday: 0, hour: 20 },
  ],
};

/**
 * Sugere os 3 melhores horários para publicar em uma plataforma.
 * Heurística determinística: frequência de posts publicados com sucesso
 * por (dia da semana, hora), ponderada por engajamento quando disponível.
 * Sem dados suficientes, completa com defaults conhecidos da plataforma.
 */
export function suggestBestTimes(
  posts: PublishedPostLike[],
  platform: Platform
): BestTimeSlot[] {
  const buckets = new Map<string, BestTimeSlot>();

  for (const post of posts) {
    if (post.platform !== platform) continue;
    if (post.status !== "published") continue;
    const date = new Date(post.scheduled_at);
    if (Number.isNaN(date.getTime())) continue;
    const weekday = date.getDay();
    const hour = date.getHours();
    const key = `${weekday}-${hour}`;
    const existing = buckets.get(key);
    const gain = 10 + Math.min(post.engagement ?? 0, 1000) / 100;
    if (existing) {
      existing.score += gain;
    } else {
      buckets.set(key, { weekday, hour, score: gain });
    }
  }

  const fromData = Array.from(buckets.values()).sort(
    (a, b) =>
      b.score - a.score || a.weekday - b.weekday || a.hour - b.hour
  );

  const result: BestTimeSlot[] = fromData.slice(0, 3);

  // Completa com defaults da plataforma (score baixo, determinístico)
  if (result.length < 3) {
    for (const def of DEFAULT_SLOTS[platform]) {
      if (result.length >= 3) break;
      const dup = result.some(
        (s) => s.weekday === def.weekday && s.hour === def.hour
      );
      if (!dup) {
        result.push({ weekday: def.weekday, hour: def.hour, score: 1 });
      }
    }
  }

  return result.slice(0, 3);
}

export function formatSlot(slot: BestTimeSlot): string {
  return `${WEEKDAY_SHORT[slot.weekday]} ${String(slot.hour).padStart(2, "0")}h`;
}

/**
 * Próxima data (a partir de `from`) que cai no weekday/hour do slot.
 * Retorna string compatível com input datetime-local (yyyy-MM-ddTHH:mm).
 */
export function nextDateForSlot(slot: BestTimeSlot, from = new Date()): Date {
  const d = new Date(from);
  d.setHours(slot.hour, 0, 0, 0);
  let diff = (slot.weekday - d.getDay() + 7) % 7;
  if (diff === 0 && d.getTime() <= from.getTime()) diff = 7;
  d.setDate(d.getDate() + diff);
  return d;
}
