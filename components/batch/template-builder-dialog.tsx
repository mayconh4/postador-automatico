"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { uploadFile } from "@/lib/storage";
import { STORAGE_BUCKETS } from "@/lib/constants";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { TemplatePreview } from "@/components/batch/template-preview";
import type {
  EditTemplate,
  EditTemplateConfig,
  FilterConfig,
  TextOverlay,
  WatermarkConfig,
} from "@/lib/types";
import { ImagePlus, Loader2, Plus, Trash2, Type } from "lucide-react";

const DEFAULT_FILTERS: FilterConfig = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  preset: "Normal",
};

const FILTER_PRESETS: {
  name: string;
  brightness: number;
  contrast: number;
  saturation: number;
}[] = [
  { name: "Normal", brightness: 1, contrast: 1, saturation: 1 },
  { name: "Vívido", brightness: 1.05, contrast: 1.15, saturation: 1.3 },
  { name: "P&B", brightness: 1, contrast: 1.1, saturation: 0 },
  { name: "Frio", brightness: 1, contrast: 1.05, saturation: 0.85 },
  { name: "Quente", brightness: 1.05, contrast: 1.05, saturation: 1.2 },
];

// Grid 3x3 — apenas as 5 posições válidas de WatermarkConfig são clicáveis
const POSITION_GRID: (WatermarkConfig["position"] | null)[] = [
  "top-left",
  null,
  "top-right",
  null,
  "center",
  null,
  "bottom-left",
  null,
  "bottom-right",
];

const POSITION_LABELS: Record<WatermarkConfig["position"], string> = {
  "top-left": "Superior esquerda",
  "top-right": "Superior direita",
  center: "Centro",
  "bottom-left": "Inferior esquerda",
  "bottom-right": "Inferior direita",
};

function sanitizeFilename(filename: string): string {
  return filename
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-");
}

export function TemplateBuilderDialog({
  open,
  onOpenChange,
  template,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = criar novo template */
  template: EditTemplate | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [bgColor, setBgColor] = useState("#000000");

  const [wmPath, setWmPath] = useState<string | null>(null);
  const [wmPosition, setWmPosition] =
    useState<WatermarkConfig["position"]>("bottom-right");
  const [wmOpacity, setWmOpacity] = useState(0.8);
  const [wmScale, setWmScale] = useState(0.2);
  const [wmUploading, setWmUploading] = useState(false);

  const [texts, setTexts] = useState<TextOverlay[]>([]);
  const [filters, setFilters] = useState<FilterConfig>(DEFAULT_FILTERS);
  const [saving, setSaving] = useState(false);

  const wmInputRef = useRef<HTMLInputElement>(null);

  // (Re)inicializa o formulário quando abre
  useEffect(() => {
    if (!open) return;
    const config = template?.config;
    setName(template?.name ?? "");
    setBgColor(config?.background?.color ?? "#000000");
    setWmPath(config?.watermark?.imageUrl ?? null);
    setWmPosition(config?.watermark?.position ?? "bottom-right");
    setWmOpacity(config?.watermark?.opacity ?? 0.8);
    setWmScale(config?.watermark?.scale ?? 0.2);
    setTexts(config?.texts ?? []);
    setFilters(config?.filters ?? DEFAULT_FILTERS);
    setSaving(false);
  }, [open, template]);

  const config: EditTemplateConfig = {
    background: { type: "color", color: bgColor, aspectRatio: "9:16" },
    watermark: wmPath
      ? {
          imageUrl: wmPath,
          position: wmPosition,
          opacity: wmOpacity,
          scale: wmScale,
        }
      : null,
    texts,
    filters,
  };

  async function handleWatermarkUpload(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Envie um arquivo de imagem (PNG, JPG...).");
      return;
    }
    setWmUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("not-authenticated");
      const path = `${user.id}/templates/${Date.now()}-${sanitizeFilename(file.name)}`;
      await uploadFile(STORAGE_BUCKETS.images, path, file, {
        contentType: file.type,
      });
      setWmPath(path);
      toast.success("Marca d'água enviada!");
    } catch {
      toast.error("Erro ao enviar a marca d'água.");
    }
    setWmUploading(false);
    if (wmInputRef.current) wmInputRef.current.value = "";
  }

  function addText() {
    setTexts((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        text: "SIGA @seuperfil",
        x: 0.5,
        y: 0.12,
        fontSize: 28,
        color: "#ffffff",
        bold: true,
      },
    ]);
  }

  function updateText(id: string, patch: Partial<TextOverlay>) {
    setTexts((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function removeText(id: string) {
    setTexts((prev) => prev.filter((t) => t.id !== id));
  }

  function setFilterValue(
    key: "brightness" | "contrast" | "saturation",
    value: number
  ) {
    setFilters((prev) => ({ ...prev, [key]: value, preset: null }));
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Dê um nome ao template.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      toast.error("Você precisa estar logado para salvar templates.");
      return;
    }

    const payload = { name: name.trim(), config };
    const { error } = template
      ? await supabase.from("edit_templates").update(payload).eq("id", template.id)
      : await supabase
          .from("edit_templates")
          .insert({ user_id: user.id, ...payload });

    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar template: " + error.message);
      return;
    }
    toast.success(template ? "Template atualizado!" : "Template criado!");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {template ? "Editar template" : "Novo template"}
          </DialogTitle>
          <DialogDescription>
            Defina fundo, marca d&apos;água, textos fixos e filtros — o template
            será aplicado a todos os vídeos do lote.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[1fr_220px]">
          {/* ===== Coluna de configuração ===== */}
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="template-name">Nome do template</Label>
              <Input
                id="template-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='Ex.: "Cortes com logo e CTA"'
                maxLength={80}
              />
            </div>

            <Separator />

            {/* Fundo */}
            <div className="space-y-1.5">
              <Label htmlFor="template-bg">Cor de fundo</Label>
              <div className="flex items-center gap-3">
                <input
                  id="template-bg"
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="h-9 w-14 cursor-pointer rounded-md border bg-transparent p-1"
                />
                <span className="text-sm text-muted-foreground">
                  Preenche as bordas quando o vídeo não ocupa o quadro 9:16
                  inteiro.
                </span>
              </div>
            </div>

            <Separator />

            {/* Marca d'água */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Marca d&apos;água</Label>
                {wmPath && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => setWmPath(null)}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Remover
                  </Button>
                )}
              </div>
              <input
                ref={wmInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void handleWatermarkUpload(e.target.files?.[0])}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={wmUploading}
                onClick={() => wmInputRef.current?.click()}
              >
                {wmUploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="mr-2 h-4 w-4" />
                )}
                {wmPath ? "Trocar imagem" : "Enviar imagem (logo)"}
              </Button>

              {wmPath && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Posição: {POSITION_LABELS[wmPosition]}
                    </Label>
                    <div className="grid w-fit grid-cols-3 gap-1">
                      {POSITION_GRID.map((pos, i) =>
                        pos ? (
                          <Button
                            key={pos}
                            type="button"
                            size="icon"
                            variant={wmPosition === pos ? "default" : "outline"}
                            className="h-8 w-8"
                            title={POSITION_LABELS[pos]}
                            onClick={() => setWmPosition(pos)}
                          >
                            <span className="h-2 w-2 rounded-full bg-current" />
                            <span className="sr-only">
                              {POSITION_LABELS[pos]}
                            </span>
                          </Button>
                        ) : (
                          <span key={`empty-${i}`} className="h-8 w-8" />
                        )
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">
                          Opacidade
                        </Label>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {Math.round(wmOpacity * 100)}%
                        </span>
                      </div>
                      <Slider
                        value={[wmOpacity]}
                        min={0.1}
                        max={1}
                        step={0.05}
                        onValueChange={(v) => setWmOpacity(v[0] ?? 0.8)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">
                          Escala
                        </Label>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {Math.round(wmScale * 100)}% da largura
                        </span>
                      </div>
                      <Slider
                        value={[wmScale]}
                        min={0.05}
                        max={0.6}
                        step={0.01}
                        onValueChange={(v) => setWmScale(v[0] ?? 0.2)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Textos fixos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Textos fixos</Label>
                <Button type="button" variant="outline" size="sm" onClick={addText}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Adicionar texto
                </Button>
              </div>
              {texts.length === 0 && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Type className="h-3.5 w-3.5" />
                  Nenhum texto ainda. Ex.: &quot;SIGA @seuperfil&quot; em todos
                  os vídeos do lote.
                </p>
              )}
              {texts.map((t, i) => (
                <div key={t.id} className="space-y-3 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={t.text}
                      onChange={(e) => updateText(t.id, { text: e.target.value })}
                      placeholder={`Texto ${i + 1}`}
                    />
                    <input
                      type="color"
                      value={t.color || "#ffffff"}
                      onChange={(e) => updateText(t.id, { color: e.target.value })}
                      title="Cor do texto"
                      className="h-9 w-10 shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeText(t.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Remover texto</span>
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">
                          Tamanho
                        </Label>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {t.fontSize}
                        </span>
                      </div>
                      <Slider
                        value={[t.fontSize]}
                        min={12}
                        max={64}
                        step={1}
                        onValueChange={(v) =>
                          updateText(t.id, { fontSize: v[0] ?? 28 })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">
                          Posição X
                        </Label>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {Math.round(t.x * 100)}%
                        </span>
                      </div>
                      <Slider
                        value={[t.x]}
                        min={0}
                        max={1}
                        step={0.01}
                        onValueChange={(v) => updateText(t.id, { x: v[0] ?? 0.5 })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">
                          Posição Y
                        </Label>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {Math.round(t.y * 100)}%
                        </span>
                      </div>
                      <Slider
                        value={[t.y]}
                        min={0}
                        max={1}
                        step={0.01}
                        onValueChange={(v) => updateText(t.id, { y: v[0] ?? 0.5 })}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            {/* Filtros */}
            <div className="space-y-3">
              <Label>Filtros de cor</Label>
              <div className="flex flex-wrap gap-1.5">
                {FILTER_PRESETS.map((p) => (
                  <Button
                    key={p.name}
                    type="button"
                    size="sm"
                    variant={filters.preset === p.name ? "default" : "outline"}
                    className="text-xs"
                    onClick={() =>
                      setFilters({
                        brightness: p.brightness,
                        contrast: p.contrast,
                        saturation: p.saturation,
                        preset: p.name,
                      })
                    }
                  >
                    {p.name}
                  </Button>
                ))}
              </div>
              {(
                [
                  { key: "brightness", label: "Brilho", min: 0.5 },
                  { key: "contrast", label: "Contraste", min: 0.5 },
                  { key: "saturation", label: "Saturação", min: 0 },
                ] as const
              ).map((s) => (
                <div key={s.key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">
                      {s.label}
                    </Label>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {(filters[s.key] ?? 1).toFixed(2)}
                    </span>
                  </div>
                  <Slider
                    value={[filters[s.key] ?? 1]}
                    min={s.min}
                    max={1.5}
                    step={0.01}
                    onValueChange={(v) => setFilterValue(s.key, v[0] ?? 1)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ===== Prévia ===== */}
          <div className="flex flex-col items-center gap-2 md:sticky md:top-0 md:self-start">
            <TemplatePreview config={config} width={210} />
            <p className="text-xs text-muted-foreground">Prévia estática (9:16)</p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving || wmUploading}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {template ? "Salvar alterações" : "Criar template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
