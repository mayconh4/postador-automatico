import type { TextOverlay } from "@/lib/types";

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

/** Estilo padrão de legenda para vídeo curto (centralizada, baixa, com caixa). */
const CAPTION_STYLE = {
  x: 0.5,
  y: 0.78,
  fontSize: 34,
  color: "#ffffff",
  background: "rgba(0,0,0,0.65)",
  bold: true,
} as const;

/**
 * Converte segmentos de transcrição em TextOverlays sincronizados no estilo
 * short-form: frases longas são quebradas em blocos de poucas palavras, com o
 * tempo distribuído proporcionalmente dentro do segmento.
 */
export function segmentsToOverlays(
  segments: TranscriptSegment[],
  maxWordsPerCaption = 4
): TextOverlay[] {
  const overlays: TextOverlay[] = [];

  for (const seg of segments) {
    const words = seg.text.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += maxWordsPerCaption) {
      chunks.push(words.slice(i, i + maxWordsPerCaption).join(" "));
    }

    const segDuration = Math.max(0.2, seg.end - seg.start);
    const perChunk = segDuration / chunks.length;

    chunks.forEach((text, i) => {
      overlays.push({
        id: `cap-${seg.start.toFixed(2)}-${i}-${Math.abs(hash(text)).toString(36)}`,
        text,
        startTime: round2(seg.start + i * perChunk),
        endTime: round2(seg.start + (i + 1) * perChunk),
        ...CAPTION_STYLE,
      });
    });
  }

  return overlays;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
