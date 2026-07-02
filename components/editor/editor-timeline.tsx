"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn, formatDuration } from "@/lib/utils";
import type { TimelineClip } from "@/lib/types";
import { clipDuration } from "@/components/editor/editor-utils";
import {
  ArrowLeft,
  ArrowRight,
  Scissors,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

const RULER_H = 20;

function tickStep(pxPerSec: number): number {
  const candidates = [0.5, 1, 2, 5, 10, 15, 30, 60, 120];
  for (const c of candidates) {
    if (c * pxPerSec >= 56) return c;
  }
  return 120;
}

/**
 * Timeline horizontal: régua de tempo, blocos de clipe proporcionais,
 * playhead arrastável (posição movida imperativamente pelo rAF do editor).
 */
export function EditorTimeline({
  clips,
  totalDuration,
  pxPerSec,
  zoom,
  selectedClipId,
  playheadRef,
  onSelectClip,
  onSeek,
  onSplit,
  onRemove,
  onMove,
  onZoom,
}: {
  clips: TimelineClip[]; // já ordenados
  totalDuration: number;
  pxPerSec: number;
  zoom: number;
  selectedClipId: string | null;
  playheadRef: React.RefObject<HTMLDivElement>;
  onSelectClip: (id: string | null) => void;
  onSeek: (t: number) => void;
  onSplit: () => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onZoom: (dir: -1 | 1) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const innerWidth = Math.max(totalDuration * pxPerSec + 48, 400);
  const step = tickStep(pxPerSec);
  const tickCount = Math.floor(totalDuration / step) + 1;

  const selectedIndex = clips.findIndex((c) => c.id === selectedClipId);
  const hasSelection = selectedIndex >= 0;

  function seekFromEvent(e: React.PointerEvent) {
    const inner = innerRef.current;
    if (!inner) return;
    const rect = inner.getBoundingClientRect();
    const x = e.clientX - rect.left;
    onSeek(Math.max(0, Math.min(x / pxPerSec, totalDuration)));
  }

  // posições acumuladas dos clipes
  let acc = 0;
  const blocks = clips.map((c) => {
    const left = acc * pxPerSec;
    const width = clipDuration(c) * pxPerSec;
    acc += clipDuration(c);
    return { clip: c, left, width };
  });

  const GRADIENTS = [
    "from-purple-500 to-indigo-500",
    "from-pink-500 to-rose-500",
    "from-cyan-500 to-blue-500",
    "from-emerald-500 to-teal-500",
    "from-amber-500 to-orange-500",
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Barra de ferramentas */}
      <div className="flex shrink-0 items-center gap-1 border-b px-2 py-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={onSplit}
          title="Dividir clipe no playhead"
        >
          <Scissors className="mr-1 h-3.5 w-3.5" />
          Dividir
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={!hasSelection || clips.length <= 1}
          onClick={onRemove}
          title="Remover clipe selecionado"
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          Remover
        </Button>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={!hasSelection || selectedIndex === 0}
          onClick={() => onMove(-1)}
          title="Mover clipe para a esquerda"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="sr-only">Mover para a esquerda</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={!hasSelection || selectedIndex === clips.length - 1}
          onClick={() => onMove(1)}
          title="Mover clipe para a direita"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          <span className="sr-only">Mover para a direita</span>
        </Button>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onZoom(-1)}
            title="Reduzir zoom"
          >
            <ZoomOut className="h-3.5 w-3.5" />
            <span className="sr-only">Reduzir zoom</span>
          </Button>
          <span className="w-10 text-center text-xs tabular-nums text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onZoom(1)}
            title="Aumentar zoom"
          >
            <ZoomIn className="h-3.5 w-3.5" />
            <span className="sr-only">Aumentar zoom</span>
          </Button>
        </div>
      </div>

      {/* Trilha */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 select-none overflow-x-auto overflow-y-hidden"
      >
        <div
          ref={innerRef}
          className="relative h-full cursor-crosshair touch-none"
          style={{ width: innerWidth }}
          onPointerDown={(e) => {
            draggingRef.current = true;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            seekFromEvent(e);
          }}
          onPointerMove={(e) => {
            if (draggingRef.current) seekFromEvent(e);
          }}
          onPointerUp={() => {
            draggingRef.current = false;
          }}
          onPointerCancel={() => {
            draggingRef.current = false;
          }}
        >
          {/* Régua */}
          <div
            className="absolute inset-x-0 top-0 border-b bg-muted/30"
            style={{ height: RULER_H }}
          >
            {Array.from({ length: tickCount }).map((_, i) => {
              const t = i * step;
              return (
                <div
                  key={i}
                  className="absolute top-0 h-full border-l border-border/70"
                  style={{ left: t * pxPerSec }}
                >
                  <span className="ml-1 text-[10px] tabular-nums text-muted-foreground">
                    {formatDuration(t)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Clipes */}
          <div
            className="absolute inset-x-0 bottom-1.5"
            style={{ top: RULER_H + 6 }}
          >
            {blocks.map(({ clip, left, width }, i) => (
              <div
                key={clip.id}
                className={cn(
                  "absolute inset-y-0 flex flex-col justify-between overflow-hidden rounded-md bg-gradient-to-br p-1.5 text-white shadow-sm ring-offset-background transition-shadow",
                  GRADIENTS[i % GRADIENTS.length],
                  selectedClipId === clip.id
                    ? "ring-2 ring-primary ring-offset-2"
                    : "hover:brightness-110"
                )}
                style={{ left, width: Math.max(width - 2, 8) }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSelectClip(clip.id === selectedClipId ? null : clip.id);
                }}
                title={`Clipe ${i + 1}: ${formatDuration(clip.start)} → ${formatDuration(clip.end)}`}
              >
                <span className="text-[10px] font-semibold leading-none drop-shadow">
                  Clipe {i + 1}
                </span>
                <span className="text-[10px] tabular-nums leading-none opacity-90">
                  {formatDuration(clipDuration(clip))}
                </span>
              </div>
            ))}
            {clips.length === 0 && (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                Carregando timeline...
              </div>
            )}
          </div>

          {/* Playhead (posição controlada imperativamente via rAF) */}
          <div
            ref={playheadRef}
            className="pointer-events-none absolute inset-y-0 z-10 w-0"
            style={{ left: 0 }}
          >
            <div className="absolute inset-y-0 -ml-px w-0.5 bg-red-500" />
            <div className="absolute -left-[5px] top-0 h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-red-500" />
          </div>
        </div>
      </div>
    </div>
  );
}
