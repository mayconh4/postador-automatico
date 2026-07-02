"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { buildStoragePath, uploadFile } from "@/lib/storage";
import { STORAGE_BUCKETS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { WatermarkConfig } from "@/lib/types";
import { Loader2, Upload, X } from "lucide-react";

const DEFAULT_WATERMARK: WatermarkConfig = {
  text: "@seucanal",
  position: "bottom-right",
  opacity: 0.8,
  scale: 0.25,
};

const POSITIONS: { id: WatermarkConfig["position"]; label: string }[] = [
  { id: "top-left", label: "Sup. esquerda" },
  { id: "top-right", label: "Sup. direita" },
  { id: "center", label: "Centro" },
  { id: "bottom-left", label: "Inf. esquerda" },
  { id: "bottom-right", label: "Inf. direita" },
];

export function WatermarkPanel({
  projectId,
  watermark,
  onChange,
}: {
  projectId: string;
  watermark: WatermarkConfig | null;
  onChange: (watermark: WatermarkConfig | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const enabled = watermark !== null;
  const mode: "text" | "image" = watermark?.imageUrl ? "image" : "text";

  function patch(p: Partial<WatermarkConfig>) {
    onChange({ ...(watermark ?? DEFAULT_WATERMARK), ...p });
  }

  async function handleUpload(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Envie um arquivo de imagem");
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const path = buildStoragePath(user.id, file.name);
      await uploadFile(STORAGE_BUCKETS.images, path, file, {
        contentType: file.type,
      });
      const { error } = await supabase.from("video_assets").insert({
        project_id: projectId,
        type: "watermark",
        url: path,
        filename: file.name,
        meta: { bucket: STORAGE_BUCKETS.images, size: file.size, mime: file.type },
      });
      if (error) throw error;
      patch({ imageUrl: path, text: undefined });
      toast.success("Marca d'água enviada");
    } catch {
      toast.error("Erro ao enviar a imagem");
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Marca d&apos;água</h3>
          <p className="text-xs text-muted-foreground">
            Logo ou texto sobre o vídeo.
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(on) => onChange(on ? DEFAULT_WATERMARK : null)}
        />
      </div>

      {watermark && (
        <>
          <Tabs
            value={mode}
            onValueChange={(v) => {
              if (v === "text") {
                patch({ imageUrl: undefined, text: watermark.text || "@seucanal" });
              } else {
                inputRef.current?.click();
              }
            }}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="text">Texto</TabsTrigger>
              <TabsTrigger value="image">Imagem</TabsTrigger>
            </TabsList>
          </Tabs>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void handleUpload(e.target.files?.[0] ?? null)}
          />

          {mode === "text" ? (
            <div className="space-y-2">
              <Label>Texto da marca</Label>
              <Input
                value={watermark.text ?? ""}
                placeholder="@seucanal"
                onChange={(e) => patch({ text: e.target.value })}
              />
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <p className="min-w-0 flex-1 truncate text-sm">
                Imagem aplicada
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => inputRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  <span className="sr-only">Trocar imagem</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    patch({ imageUrl: undefined, text: "@seucanal" })
                  }
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Remover imagem</span>
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Posição</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {POSITIONS.map((p) => (
                <Button
                  key={p.id}
                  type="button"
                  variant={watermark.position === p.id ? "default" : "outline"}
                  size="sm"
                  className={cn("text-xs", p.id === "center" && "col-span-2")}
                  onClick={() => patch({ position: p.id })}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Opacidade</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {Math.round(watermark.opacity * 100)}%
              </span>
            </div>
            <Slider
              value={[watermark.opacity]}
              min={0.1}
              max={1}
              step={0.05}
              onValueChange={(v) => patch({ opacity: v[0] ?? 0.8 })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Escala</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {Math.round(watermark.scale * 100)}%
              </span>
            </div>
            <Slider
              value={[watermark.scale]}
              min={0.05}
              max={0.6}
              step={0.01}
              onValueChange={(v) => patch({ scale: v[0] ?? 0.25 })}
            />
          </div>
        </>
      )}
    </div>
  );
}
