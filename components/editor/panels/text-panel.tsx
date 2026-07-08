"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { TextOverlay } from "@/lib/types";
import { makeId } from "@/components/editor/editor-utils";
import { Loader2, Plus, Sparkles, Trash2, Type } from "lucide-react";

function newOverlay(duration: number): TextOverlay {
  return {
    id: makeId(),
    text: "Seu texto aqui",
    x: 0.5,
    y: 0.2,
    fontSize: 32,
    color: "#ffffff",
    bold: true,
    startTime: undefined,
    endTime: duration > 0 ? undefined : undefined,
  };
}

export function TextPanel({
  texts,
  duration,
  onChange,
  onAutoCaptions,
  captionsBusy,
}: {
  texts: TextOverlay[];
  duration: number;
  onChange: (texts: TextOverlay[]) => void;
  /** Gera legendas automáticas (Whisper) a partir do áudio do vídeo. */
  onAutoCaptions?: () => void;
  captionsBusy?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    texts[0]?.id ?? null
  );
  const selected = texts.find((t) => t.id === selectedId) ?? null;

  function patchSelected(p: Partial<TextOverlay>) {
    if (!selected) return;
    onChange(texts.map((t) => (t.id === selected.id ? { ...t, ...p } : t)));
  }

  function add() {
    const t = newOverlay(duration);
    onChange([...texts, t]);
    setSelectedId(t.id);
  }

  function remove(id: string) {
    onChange(texts.filter((t) => t.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  const hasWindow =
    selected != null &&
    (typeof selected.startTime === "number" ||
      typeof selected.endTime === "number");

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Textos</h3>
          <p className="text-xs text-muted-foreground">
            Sobreposições de texto no vídeo.
          </p>
        </div>
        <Button size="sm" onClick={add}>
          <Plus className="mr-1 h-4 w-4" />
          Adicionar
        </Button>
      {onAutoCaptions && (
        <Button
          variant="outline"
          className="w-full"
          onClick={onAutoCaptions}
          disabled={captionsBusy}
        >
          {captionsBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {captionsBusy ? "Transcrevendo…" : "Legendas automáticas (IA)"}
        </Button>
      )}
      </div>

      {texts.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed p-6 text-center">
          <Type className="mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhum texto ainda. Adicione títulos, legendas ou chamadas.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {texts.map((t) => (
            <div
              key={t.id}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-sm transition-colors",
                selectedId === t.id
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted"
              )}
              onClick={() => setSelectedId(t.id)}
            >
              <Type className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">
                {t.text.split("\n")[0] || "(vazio)"}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(t.id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="sr-only">Remover texto</span>
              </Button>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <>
          <Separator />
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Conteúdo</Label>
              <Textarea
                rows={3}
                value={selected.text}
                onChange={(e) => patchSelected({ text: e.target.value })}
                placeholder="Digite o texto (use Enter para quebrar linha)"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Tamanho</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {selected.fontSize}
                </span>
              </div>
              <Slider
                value={[selected.fontSize]}
                min={12}
                max={96}
                step={1}
                onValueChange={(v) => patchSelected({ fontSize: v[0] ?? 32 })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Cor do texto</Label>
                <input
                  type="color"
                  value={selected.color}
                  onChange={(e) => patchSelected({ color: e.target.value })}
                  className="h-9 w-full cursor-pointer rounded-md border bg-transparent p-1"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Fundo</Label>
                  <Switch
                    checked={!!selected.background}
                    onCheckedChange={(on) =>
                      patchSelected({
                        background: on ? "#000000" : undefined,
                      })
                    }
                  />
                </div>
                <input
                  type="color"
                  value={selected.background ?? "#000000"}
                  disabled={!selected.background}
                  onChange={(e) => patchSelected({ background: e.target.value })}
                  className="h-9 w-full cursor-pointer rounded-md border bg-transparent p-1 disabled:cursor-not-allowed disabled:opacity-40"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Negrito</Label>
              <Switch
                checked={!!selected.bold}
                onCheckedChange={(on) => patchSelected({ bold: on })}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Posição horizontal</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {Math.round(selected.x * 100)}%
                </span>
              </div>
              <Slider
                value={[selected.x]}
                min={0}
                max={1}
                step={0.01}
                onValueChange={(v) => patchSelected({ x: v[0] ?? 0.5 })}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Posição vertical</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {Math.round(selected.y * 100)}%
                </span>
              </div>
              <Slider
                value={[selected.y]}
                min={0}
                max={1}
                step={0.01}
                onValueChange={(v) => patchSelected({ y: v[0] ?? 0.2 })}
              />
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Janela de tempo</Label>
                  <p className="text-xs text-muted-foreground">
                    Exibir apenas em um trecho.
                  </p>
                </div>
                <Switch
                  checked={hasWindow}
                  onCheckedChange={(on) =>
                    patchSelected(
                      on
                        ? {
                            startTime: 0,
                            endTime: Math.max(1, Math.round(duration || 5)),
                          }
                        : { startTime: undefined, endTime: undefined }
                    )
                  }
                />
              </div>
              {hasWindow && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <Label className="text-xs">Início (s)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      value={selected.startTime ?? 0}
                      onChange={(e) =>
                        patchSelected({
                          startTime: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Fim (s)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      value={selected.endTime ?? 0}
                      onChange={(e) =>
                        patchSelected({
                          endTime: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
