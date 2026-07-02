"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import { buildStoragePath, uploadFile } from "@/lib/storage";
import { STORAGE_BUCKETS } from "@/lib/constants";
import type { VideoAsset } from "@/lib/types";
import { Loader2, Music, Trash2, Upload } from "lucide-react";

const NONE = "__none__";

export function AudioPanel({
  projectId,
  audioAssetId,
  replaceAudio,
  volume,
  onSelectAudio,
  onReplaceAudioChange,
  onVolumeChange,
}: {
  projectId: string;
  audioAssetId: string | null;
  replaceAudio: boolean;
  volume: number;
  onSelectAudio: (asset: VideoAsset | null) => void;
  onReplaceAudioChange: (replace: boolean) => void;
  onVolumeChange: (volume: number) => void;
}) {
  const [assets, setAssets] = useState<VideoAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("video_assets")
      .select("*")
      .eq("project_id", projectId)
      .eq("type", "audio")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar áudios do projeto");
      return;
    }
    setAssets((data ?? []) as unknown as VideoAsset[]);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleUpload(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      toast.error("Envie um arquivo de áudio");
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
      await uploadFile(STORAGE_BUCKETS.audio, path, file, {
        contentType: file.type,
      });
      const { data, error } = await supabase
        .from("video_assets")
        .insert({
          project_id: projectId,
          type: "audio",
          url: path,
          filename: file.name,
          meta: { bucket: STORAGE_BUCKETS.audio, size: file.size, mime: file.type },
        })
        .select()
        .single();
      if (error || !data) throw error ?? new Error("insert falhou");
      const asset = data as unknown as VideoAsset;
      setAssets((prev) => [asset, ...prev]);
      onSelectAudio(asset);
      toast.success("Áudio enviado e aplicado");
    } catch {
      toast.error("Erro ao enviar o áudio");
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Áudio</h3>
        <p className="text-xs text-muted-foreground">
          Sobreponha uma trilha ao vídeo (mixada ou substituindo o original).
        </p>
      </div>

      <div className="space-y-2">
        <Label>Trilha sobreposta</Label>
        <Select
          value={audioAssetId ?? NONE}
          onValueChange={(id) => {
            if (id === NONE) {
              onSelectAudio(null);
              return;
            }
            const asset = assets.find((a) => a.id === id);
            if (asset) onSelectAudio(asset);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Nenhuma" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Nenhuma (áudio original)</SelectItem>
            {assets.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.filename || a.url.split("/").pop()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => void handleUpload(e.target.files?.[0] ?? null)}
          />
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {uploading ? "Enviando..." : "Enviar áudio"}
          </Button>
          {audioAssetId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelectAudio(null)}
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Remover trilha</span>
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="pr-3">
          <Label className="text-sm">Substituir áudio original</Label>
          <p className="text-xs text-muted-foreground">
            {replaceAudio
              ? "A trilha substitui o áudio do vídeo."
              : "A trilha é mixada com o áudio do vídeo."}
          </p>
        </div>
        <Switch
          checked={replaceAudio}
          onCheckedChange={onReplaceAudioChange}
          disabled={!audioAssetId}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5">
            <Music className="h-3.5 w-3.5" />
            Volume do preview
          </Label>
          <span className="text-xs tabular-nums text-muted-foreground">
            {Math.round(volume * 100)}%
          </span>
        </div>
        <Slider
          value={[volume]}
          min={0}
          max={1}
          step={0.01}
          onValueChange={(v) => onVolumeChange(v[0] ?? 1)}
        />
        <p className="text-xs text-muted-foreground">
          Afeta apenas a pré-visualização, não o arquivo exportado.
        </p>
      </div>
    </div>
  );
}
