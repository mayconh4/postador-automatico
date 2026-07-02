"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { buildStoragePath, uploadFile } from "@/lib/storage";
import { STORAGE_BUCKETS } from "@/lib/constants";
import type { BackgroundConfig } from "@/lib/types";
import { DEFAULT_BACKGROUND } from "@/components/editor/editor-utils";
import { Droplets, Image as ImageIcon, Info, Loader2, Paintbrush, Upload, X } from "lucide-react";

export function BackgroundPanel({
  projectId,
  background,
  onChange,
}: {
  projectId: string;
  background: BackgroundConfig | null;
  onChange: (background: BackgroundConfig) => void;
}) {
  const bg = background ?? DEFAULT_BACKGROUND;
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function patch(p: Partial<BackgroundConfig>) {
    onChange({ ...bg, aspectRatio: "9:16", ...p });
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
        type: "background",
        url: path,
        filename: file.name,
        meta: { bucket: STORAGE_BUCKETS.images, size: file.size, mime: file.type },
      });
      if (error) throw error;
      patch({ type: "image", imageUrl: path });
      toast.success("Imagem de fundo aplicada");
    } catch {
      toast.error("Erro ao enviar a imagem");
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  const TYPES = [
    { id: "color" as const, label: "Cor", icon: Paintbrush },
    { id: "blur" as const, label: "Desfoque", icon: Droplets },
    { id: "image" as const, label: "Imagem", icon: ImageIcon },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Fundo</h3>
        <p className="text-xs text-muted-foreground">
          Preenche as bordas quando o vídeo não ocupa o quadro 9:16.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {TYPES.map((t) => {
          const Icon = t.icon;
          return (
            <Button
              key={t.id}
              type="button"
              size="sm"
              variant={bg.type === t.id ? "default" : "outline"}
              className="h-auto flex-col gap-1 py-2 text-xs"
              onClick={() => {
                if (t.id === "image" && !bg.imageUrl) {
                  inputRef.current?.click();
                  return;
                }
                patch({ type: t.id });
              }}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </Button>
          );
        })}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleUpload(e.target.files?.[0] ?? null)}
      />

      {bg.type === "color" && (
        <div className="space-y-2">
          <Label>Cor do fundo</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={bg.color ?? "#000000"}
              onChange={(e) => patch({ color: e.target.value })}
              className="h-9 w-14 cursor-pointer rounded-md border bg-transparent p-1"
            />
            <span className="text-xs uppercase tabular-nums text-muted-foreground">
              {bg.color ?? "#000000"}
            </span>
          </div>
        </div>
      )}

      {bg.type === "image" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <p className="min-w-0 flex-1 truncate text-sm">
              {bg.imageUrl ? "Imagem aplicada" : "Nenhuma imagem"}
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
                <span className="sr-only">Enviar imagem</span>
              </Button>
              {bg.imageUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    patch({ type: "color", imageUrl: undefined })
                  }
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Remover imagem</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Proporção</Label>
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          9:16 (vertical)
          <span className="text-xs text-muted-foreground">— fixa nesta versão</span>
        </div>
      </div>

      {bg.type !== "color" && (
        <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-muted-foreground">
          <Info className="h-4 w-4 shrink-0 text-amber-500" />
          <p>
            {bg.type === "blur"
              ? "O desfoque aparece no preview; na exportação o fundo é aproximado por uma cor escura."
              : "A imagem aparece no preview; na exportação o fundo é aproximado por uma cor escura."}
          </p>
        </div>
      )}
    </div>
  );
}
