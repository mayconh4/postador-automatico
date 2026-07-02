"use client";

import { STORAGE_BUCKETS } from "@/lib/constants";
import type {
  BackgroundConfig,
  FilterConfig,
  TextOverlay,
  TimelineClip,
  VideoAsset,
  WatermarkConfig,
} from "@/lib/types";

/** Estado editável do editor (o que é persistido em `edits`). */
export interface EditorDoc {
  name: string;
  clips: TimelineClip[];
  background: BackgroundConfig | null;
  watermark: WatermarkConfig | null;
  texts: TextOverlay[];
  filters: FilterConfig;
  /** id do video_asset de áudio sobreposto (coluna audio_overlay). */
  audioAssetId: string | null;
}

export const DEFAULT_FILTERS: FilterConfig = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  preset: "Normal",
};

export const DEFAULT_BACKGROUND: BackgroundConfig = {
  type: "color",
  color: "#000000",
  aspectRatio: "9:16",
};

export function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ===== Timeline =====

export function sortClips(clips: TimelineClip[]): TimelineClip[] {
  return [...clips].sort((a, b) => a.order - b.order);
}

export function clipDuration(clip: TimelineClip): number {
  return Math.max(0, clip.end - clip.start);
}

export function totalDuration(clips: TimelineClip[]): number {
  return clips.reduce((acc, c) => acc + clipDuration(c), 0);
}

/** Converte tempo da timeline (t) em posição no vídeo original. */
export function timelineToSource(
  clips: TimelineClip[],
  t: number
): { clipIndex: number; sourceTime: number } {
  const sorted = sortClips(clips);
  if (sorted.length === 0) return { clipIndex: 0, sourceTime: Math.max(0, t) };
  let acc = 0;
  for (let i = 0; i < sorted.length; i++) {
    const dur = clipDuration(sorted[i]);
    if (t <= acc + dur || i === sorted.length - 1) {
      const offset = Math.max(0, Math.min(t - acc, dur));
      return { clipIndex: i, sourceTime: sorted[i].start + offset };
    }
    acc += dur;
  }
  const last = sorted[sorted.length - 1];
  return { clipIndex: sorted.length - 1, sourceTime: last.end };
}

/** Converte posição no vídeo original (dentro do clipe clipIndex) em tempo da timeline. */
export function sourceToTimeline(
  clips: TimelineClip[],
  clipIndex: number,
  sourceTime: number
): number {
  const sorted = sortClips(clips);
  if (sorted.length === 0) return Math.max(0, sourceTime);
  const idx = Math.max(0, Math.min(clipIndex, sorted.length - 1));
  let acc = 0;
  for (let i = 0; i < idx; i++) acc += clipDuration(sorted[i]);
  const clip = sorted[idx];
  const offset = Math.max(0, Math.min(sourceTime - clip.start, clipDuration(clip)));
  return acc + offset;
}

/** Reatribui `order` sequencial após inserção/remoção/reordenação. */
export function normalizeOrder(clips: TimelineClip[]): TimelineClip[] {
  return sortClips(clips).map((c, i) => ({ ...c, order: i }));
}

// ===== Assets =====

/** Bucket onde o arquivo do asset foi salvo (meta.bucket ou padrão por tipo). */
export function assetBucket(asset: VideoAsset): string {
  const metaBucket = (asset.meta as { bucket?: string } | null)?.bucket;
  if (metaBucket) return metaBucket;
  switch (asset.type) {
    case "audio":
      return STORAGE_BUCKETS.audio;
    case "video":
      return STORAGE_BUCKETS.videos;
    default:
      return STORAGE_BUCKETS.images;
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}
