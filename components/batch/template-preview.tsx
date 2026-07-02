"use client";

import { useEffect, useState } from "react";
import { Film } from "lucide-react";
import { getSignedUrl } from "@/lib/storage";
import { STORAGE_BUCKETS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { EditTemplateConfig, WatermarkConfig } from "@/lib/types";

/**
 * Resolve uma signed URL do bucket de imagens a partir de um path do Storage.
 * Retorna null enquanto carrega ou se o path não existir.
 */
export function useSignedImageUrl(path?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!path) {
      setUrl(null);
      return;
    }
    getSignedUrl(STORAGE_BUCKETS.images, path, 3600)
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return url;
}

function watermarkStyle(
  wm: WatermarkConfig,
  width: number
): React.CSSProperties {
  // Mesma margem do export (32px em 1080 de largura)
  const margin = Math.round((32 / 1080) * width);
  const base: React.CSSProperties = {
    position: "absolute",
    width: Math.max(8, Math.round(width * (wm.scale || 0.2))),
    opacity: wm.opacity ?? 0.8,
  };
  switch (wm.position) {
    case "top-left":
      return { ...base, top: margin, left: margin };
    case "top-right":
      return { ...base, top: margin, right: margin };
    case "bottom-left":
      return { ...base, bottom: margin, left: margin };
    case "center":
      return {
        ...base,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    case "bottom-right":
    default:
      return { ...base, bottom: margin, right: margin };
  }
}

/**
 * Prévia estática 9:16 de um EditTemplateConfig: cor de fundo, textos fixos
 * posicionados por porcentagem e marca d'água em escala — espelha o export.
 */
export function TemplatePreview({
  config,
  width = 200,
  className,
}: {
  config: EditTemplateConfig;
  /** Largura em px (a altura segue a proporção 9:16). */
  width?: number;
  className?: string;
}) {
  const watermarkUrl = useSignedImageUrl(config.watermark?.imageUrl);

  const filters = config.filters;
  const cssFilter = filters
    ? `brightness(${filters.brightness ?? 1}) contrast(${filters.contrast ?? 1}) saturate(${filters.saturation ?? 1})`
    : undefined;

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-md border shadow-sm",
        className
      )}
      style={{
        width,
        aspectRatio: "9 / 16",
        backgroundColor: config.background?.color ?? "#000000",
      }}
    >
      {/* Placeholder do vídeo (com os filtros de cor aplicados via CSS) */}
      <div
        className="absolute left-0 top-1/2 flex w-full -translate-y-1/2 items-center justify-center bg-gradient-to-br from-zinc-500 to-zinc-800"
        style={{ height: "42%", filter: cssFilter }}
      >
        <Film className="h-6 w-6 text-white/60" />
      </div>

      {/* Textos fixos */}
      {config.texts?.map((t) => (
        <span
          key={t.id}
          className="pointer-events-none absolute whitespace-pre-line text-center leading-tight"
          style={{
            left: `${t.x * 100}%`,
            top: `${t.y * 100}%`,
            transform: "translate(-50%, -50%)",
            color: t.color || "#ffffff",
            backgroundColor: t.background,
            fontWeight: t.bold ? 700 : 500,
            fontFamily: t.fontFamily,
            // Mesma proporção do export: fontSize * 2.5 em 1080 de largura
            fontSize: Math.max(6, t.fontSize * 2.5 * (width / 1080)),
            textShadow: t.background ? undefined : "0 1px 2px rgba(0,0,0,0.6)",
            maxWidth: "94%",
          }}
        >
          {t.text}
        </span>
      ))}

      {/* Marca d'água */}
      {config.watermark && watermarkUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={watermarkUrl}
          alt="Marca d'água"
          className="pointer-events-none object-contain"
          style={watermarkStyle(config.watermark, width)}
        />
      )}
    </div>
  );
}
