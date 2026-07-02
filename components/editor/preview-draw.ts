"use client";

import type {
  BackgroundConfig,
  FilterConfig,
  TextOverlay,
  TimelineClip,
  WatermarkConfig,
} from "@/lib/types";

/**
 * Desenho imperativo do preview em <canvas>, chamado a cada frame (rAF).
 * A matemática dos textos espelha renderTextOverlayPng (lib/video/export)
 * para o preview bater 1:1 com o arquivo exportado.
 */

export interface RuntimeCfg {
  clips: TimelineClip[]; // já ordenados
  background: BackgroundConfig | null;
  watermark: WatermarkConfig | null;
  texts: TextOverlay[];
  filters: FilterConfig | null;
  duration: number; // duração do vídeo fonte
  pxPerSec: number; // escala atual da timeline
}

function cssFilter(filters: FilterConfig | null): string {
  if (!filters) return "none";
  const b = filters.brightness ?? 1;
  const c = filters.contrast ?? 1;
  const s = filters.saturation ?? 1;
  if (b === 1 && c === 1 && s === 1) return "none";
  return `brightness(${b}) contrast(${c}) saturate(${s})`;
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  source: HTMLVideoElement | HTMLImageElement,
  sw: number,
  sh: number,
  W: number,
  H: number
) {
  const scale = Math.max(W / sw, H / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(source, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

function drawTextOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: TextOverlay,
  W: number,
  H: number
) {
  // Mesma matemática de renderTextOverlayPng
  const fontSize = overlay.fontSize * (W / 1080) * 2.5;
  const family = overlay.fontFamily || "Arial, sans-serif";
  ctx.font = `${overlay.bold ? "bold " : ""}${fontSize}px ${family}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const x = overlay.x * W;
  const y = overlay.y * H;
  const lines = overlay.text.split("\n");
  const lineHeight = fontSize * 1.25;

  lines.forEach((line, i) => {
    const ly = y + (i - (lines.length - 1) / 2) * lineHeight;
    if (overlay.background) {
      const metrics = ctx.measureText(line);
      const pad = fontSize * 0.35;
      ctx.fillStyle = overlay.background;
      ctx.fillRect(
        x - metrics.width / 2 - pad,
        ly - lineHeight / 2,
        metrics.width + pad * 2,
        lineHeight
      );
    }
    ctx.fillStyle = overlay.color || "#ffffff";
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = fontSize * 0.08;
    if (!overlay.background) ctx.strokeText(line, x, ly);
    ctx.fillText(line, x, ly);
  });
}

function watermarkXY(
  position: WatermarkConfig["position"],
  W: number,
  H: number,
  w: number,
  h: number
): { x: number; y: number } {
  const m = 32 * (W / 1080); // mesma margem do export (32px em 1080)
  switch (position) {
    case "top-left":
      return { x: m, y: m };
    case "top-right":
      return { x: W - w - m, y: m };
    case "bottom-left":
      return { x: m, y: H - h - m };
    case "center":
      return { x: (W - w) / 2, y: (H - h) / 2 };
    case "bottom-right":
    default:
      return { x: W - w - m, y: H - h - m };
  }
}

function drawWatermark(
  ctx: CanvasRenderingContext2D,
  wm: WatermarkConfig,
  img: HTMLImageElement | null,
  W: number,
  H: number
) {
  const opacity = Math.max(0, Math.min(1, wm.opacity ?? 0.8));
  const scale = Math.max(0.02, Math.min(1, wm.scale || 0.2));
  ctx.save();
  ctx.globalAlpha = opacity;

  if (img && img.naturalWidth > 0) {
    const w = W * scale;
    const h = img.naturalHeight * (w / img.naturalWidth);
    const { x, y } = watermarkXY(wm.position, W, H, w, h);
    ctx.drawImage(img, x, y, w, h);
  } else if (wm.text) {
    const base = 64;
    ctx.font = `bold ${base}px Arial, sans-serif`;
    const measured = Math.max(1, ctx.measureText(wm.text).width);
    const targetW = W * scale;
    const fontSize = Math.max(8, base * (targetW / measured));
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const w = ctx.measureText(wm.text).width;
    const h = fontSize * 1.15;
    const { x, y } = watermarkXY(wm.position, W, H, w, h);
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = fontSize * 0.06;
    ctx.strokeText(wm.text, x, y);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(wm.text, x, y);
  }
  ctx.restore();
}

export function drawPreviewFrame(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  cfg: RuntimeCfg,
  timelineT: number,
  watermarkImg: HTMLImageElement | null,
  backgroundImg: HTMLImageElement | null
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  const filterStr = cssFilter(cfg.filters);
  const hasFrame = video.readyState >= 2 && video.videoWidth > 0;

  // ---- fundo ----
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  const bg = cfg.background;
  ctx.fillStyle = bg?.type === "color" && bg.color ? bg.color : "#000000";
  ctx.fillRect(0, 0, W, H);

  if (bg?.type === "blur" && hasFrame) {
    ctx.filter = filterStr === "none" ? "blur(18px)" : `blur(18px) ${filterStr}`;
    drawCover(ctx, video, video.videoWidth, video.videoHeight, W, H);
    ctx.filter = "none";
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(0, 0, W, H);
  } else if (bg?.type === "image" && backgroundImg && backgroundImg.naturalWidth > 0) {
    drawCover(
      ctx,
      backgroundImg,
      backgroundImg.naturalWidth,
      backgroundImg.naturalHeight,
      W,
      H
    );
  }

  // ---- frame do vídeo (object-fit: contain) ----
  if (hasFrame) {
    ctx.filter = filterStr;
    const scale = Math.min(W / video.videoWidth, H / video.videoHeight);
    const dw = video.videoWidth * scale;
    const dh = video.videoHeight * scale;
    ctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.filter = "none";
  }

  // ---- textos (respeitando janela de tempo) ----
  for (const t of cfg.texts) {
    if (typeof t.startTime === "number" && timelineT < t.startTime) continue;
    if (typeof t.endTime === "number" && timelineT > t.endTime) continue;
    drawTextOverlay(ctx, t, W, H);
  }

  // ---- marca d'água ----
  if (cfg.watermark && (cfg.watermark.imageUrl || cfg.watermark.text)) {
    drawWatermark(ctx, cfg.watermark, watermarkImg, W, H);
  }
}

/** Rasteriza marca d'água de texto em PNG para o export (que só aceita imagem). */
export async function renderTextWatermarkPng(text: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const fontSize = 96;
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + fontSize;
  const h = Math.ceil(fontSize * 1.6);
  canvas.width = w;
  canvas.height = h;
  const ctx2 = canvas.getContext("2d")!;
  ctx2.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx2.textAlign = "center";
  ctx2.textBaseline = "middle";
  ctx2.strokeStyle = "rgba(0,0,0,0.5)";
  ctx2.lineWidth = fontSize * 0.06;
  ctx2.strokeText(text, w / 2, h / 2);
  ctx2.fillStyle = "#ffffff";
  ctx2.fillText(text, w / 2, h / 2);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao gerar PNG"))),
      "image/png"
    )
  );
}
