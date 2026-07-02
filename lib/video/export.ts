"use client";

import type {
  BackgroundConfig,
  FilterConfig,
  TextOverlay,
  TimelineClip,
  WatermarkConfig,
} from "@/lib/types";
import { blobToUint8, getFFmpeg, type ProgressHandler } from "./ffmpeg";

/**
 * Pipeline de exportação com FFmpeg.wasm.
 *
 * Estratégia:
 * 1. Cortes da timeline → trims re-encodados + concat.
 * 2. Filtros de cor (eq) + enquadramento 1080x1920 sobre o fundo.
 * 3. Textos são rasterizados via Canvas (PNG) e aplicados como overlay —
 *    evita depender de fontes dentro do wasm e bate 1:1 com o preview.
 * 4. Watermark (imagem) com opacidade/escala/posição.
 * 5. Áudio extra mixado (amix) ou substituindo o original.
 */

export const OUT_W = 1080;
export const OUT_H = 1920;

export interface ExportOptions {
  /** Vídeo base. */
  video: Blob;
  /** Cortes; vazio/undefined = vídeo inteiro. */
  clips?: TimelineClip[];
  background?: BackgroundConfig | null;
  watermark?: (WatermarkConfig & { imageBlob?: Blob }) | null;
  texts?: TextOverlay[] | null;
  filters?: FilterConfig | null;
  /** Áudio para sobrepor. */
  audioOverlay?: Blob | null;
  /** true = substitui o áudio original; false = mixa. */
  replaceAudio?: boolean;
  onProgress?: ProgressHandler;
  onLog?: (msg: string) => void;
}

/** Renderiza um TextOverlay em PNG (Uint8Array) na resolução de saída. */
export async function renderTextOverlayPng(
  overlay: TextOverlay,
  width = OUT_W,
  height = OUT_H
): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const fontSize = overlay.fontSize * (width / 1080) * 2.5;
  const family = overlay.fontFamily || "Arial, sans-serif";
  ctx.font = `${overlay.bold ? "bold " : ""}${fontSize}px ${family}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const x = overlay.x * width;
  const y = overlay.y * height;
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

  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/png")
  );
  return blobToUint8(blob);
}

function eqFilter(filters?: FilterConfig | null): string | null {
  if (!filters) return null;
  const brightness = (filters.brightness ?? 1) - 1; // eq usa -1..1 aditivo
  const contrast = filters.contrast ?? 1;
  const saturation = filters.saturation ?? 1;
  if (brightness === 0 && contrast === 1 && saturation === 1) return null;
  return `eq=brightness=${brightness.toFixed(3)}:contrast=${contrast.toFixed(3)}:saturation=${saturation.toFixed(3)}`;
}

function watermarkPosition(pos: WatermarkConfig["position"]): string {
  const m = 32;
  switch (pos) {
    case "top-left":
      return `${m}:${m}`;
    case "top-right":
      return `W-w-${m}:${m}`;
    case "bottom-left":
      return `${m}:H-h-${m}`;
    case "center":
      return `(W-w)/2:(H-h)/2`;
    case "bottom-right":
    default:
      return `W-w-${m}:H-h-${m}`;
  }
}

function backgroundColor(background?: BackgroundConfig | null): string {
  if (background?.type === "color" && background.color) {
    return background.color.replace("#", "0x");
  }
  return "black";
}

/**
 * Executa a exportação completa e retorna o MP4 final.
 */
export async function exportEdit(options: ExportOptions): Promise<Blob> {
  const ffmpeg = await getFFmpeg(options.onLog);

  if (options.onProgress) {
    ffmpeg.on("progress", ({ progress }) => {
      options.onProgress!(Math.max(0, Math.min(1, progress)));
    });
  }

  const cleanup: string[] = [];
  const write = async (name: string, data: Uint8Array) => {
    await ffmpeg.writeFile(name, data);
    cleanup.push(name);
  };

  try {
    await write("input.mp4", await blobToUint8(options.video));

    // ---- 1. Timeline: trim + concat ----
    let mainInput = "input.mp4";
    const clips = (options.clips ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .filter((c) => c.end > c.start);

    if (clips.length > 0) {
      const parts: string[] = [];
      for (let i = 0; i < clips.length; i++) {
        const c = clips[i];
        const out = `clip_${i}.mp4`;
        await ffmpeg.exec([
          "-ss", String(c.start),
          "-to", String(c.end),
          "-i", "input.mp4",
          "-c:v", "libx264",
          "-preset", "ultrafast",
          "-c:a", "aac",
          "-avoid_negative_ts", "make_zero",
          out,
        ]);
        cleanup.push(out);
        parts.push(out);
      }
      if (parts.length === 1) {
        mainInput = parts[0];
      } else {
        const list = parts.map((p) => `file '${p}'`).join("\n");
        await write("concat.txt", new TextEncoder().encode(list));
        await ffmpeg.exec([
          "-f", "concat",
          "-safe", "0",
          "-i", "concat.txt",
          "-c", "copy",
          "trimmed.mp4",
        ]);
        cleanup.push("trimmed.mp4");
        mainInput = "trimmed.mp4";
      }
    }

    // ---- 2. Inputs extras (watermark, textos, áudio) ----
    const args: string[] = ["-i", mainInput];
    let inputIndex = 1;

    let watermarkIdx = -1;
    if (options.watermark?.imageBlob) {
      await write("watermark.png", await blobToUint8(options.watermark.imageBlob));
      args.push("-i", "watermark.png");
      watermarkIdx = inputIndex++;
    }

    const textIdxs: number[] = [];
    for (let i = 0; i < (options.texts?.length ?? 0); i++) {
      const png = await renderTextOverlayPng(options.texts![i]);
      await write(`text_${i}.png`, png);
      args.push("-i", `text_${i}.png`);
      textIdxs.push(inputIndex++);
    }

    let audioIdx = -1;
    if (options.audioOverlay) {
      await write("overlay_audio", await blobToUint8(options.audioOverlay));
      args.push("-i", "overlay_audio");
      audioIdx = inputIndex++;
    }

    // ---- 3. Filtergraph ----
    const chains: string[] = [];
    let current = "[0:v]";

    const eq = eqFilter(options.filters);
    const scaleChain = `${current}${eq ? eq + "," : ""}scale=${OUT_W}:${OUT_H}:force_original_aspect_ratio=decrease[scaled]`;
    chains.push(scaleChain);

    chains.push(
      `color=c=${backgroundColor(options.background)}:s=${OUT_W}x${OUT_H}:d=1[bg]`
    );
    chains.push(`[bg][scaled]overlay=(W-w)/2:(H-h)/2:shortest=1[framed]`);
    current = "[framed]";

    if (watermarkIdx >= 0 && options.watermark) {
      const wm = options.watermark;
      const wmWidth = Math.round(OUT_W * (wm.scale || 0.2));
      chains.push(
        `[${watermarkIdx}:v]scale=${wmWidth}:-1,format=rgba,colorchannelmixer=aa=${(wm.opacity ?? 0.8).toFixed(2)}[wm]`
      );
      chains.push(
        `${current}[wm]overlay=${watermarkPosition(wm.position)}[wmout]`
      );
      current = "[wmout]";
    }

    textIdxs.forEach((idx, i) => {
      const t = options.texts![i];
      const hasTiming =
        typeof t.startTime === "number" && typeof t.endTime === "number";
      const enable = hasTiming
        ? `:enable='between(t,${t.startTime},${t.endTime})'`
        : "";
      chains.push(`${current}[${idx}:v]overlay=0:0${enable}[txt${i}]`);
      current = `[txt${i}]`;
    });

    // ---- 4. Áudio ----
    let audioMap: string[] = ["-map", "0:a?"];
    if (audioIdx >= 0) {
      if (options.replaceAudio) {
        audioMap = ["-map", `${audioIdx}:a`];
      } else {
        chains.push(
          `[0:a][${audioIdx}:a]amix=inputs=2:duration=first:dropout_transition=2[aout]`
        );
        audioMap = ["-map", "[aout]"];
      }
    }

    args.push(
      "-filter_complex", chains.join(";"),
      "-map", current,
      ...audioMap,
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-shortest",
      "-movflags", "+faststart",
      "output.mp4"
    );
    cleanup.push("output.mp4");

    await ffmpeg.exec(args);

    const data = await ffmpeg.readFile("output.mp4");
    const bytes = data as Uint8Array;
    return new Blob([bytes.slice().buffer], { type: "video/mp4" });
  } finally {
    for (const f of cleanup) {
      try {
        await ffmpeg.deleteFile(f);
      } catch {
        // ignora arquivos já removidos
      }
    }
  }
}
