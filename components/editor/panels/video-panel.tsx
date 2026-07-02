"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { formatDuration } from "@/lib/utils";
import type { VideoAsset } from "@/lib/types";
import { formatBytes } from "@/components/editor/editor-utils";
import { Film } from "lucide-react";

export function VideoPanel({
  projectId,
  videoAsset,
  duration,
  onChangeAsset,
}: {
  projectId: string;
  videoAsset: VideoAsset | null;
  duration: number;
  onChangeAsset: (asset: VideoAsset) => void;
}) {
  const [assets, setAssets] = useState<VideoAsset[]>([]);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("video_assets")
      .select("*")
      .eq("project_id", projectId)
      .eq("type", "video")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar vídeos do projeto");
      return;
    }
    setAssets((data ?? []) as unknown as VideoAsset[]);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const meta = (videoAsset?.meta ?? {}) as { size?: number; mime?: string };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Vídeo base</h3>
        <p className="text-xs text-muted-foreground">
          Informações do arquivo usado nesta edição.
        </p>
      </div>

      <div className="rounded-lg border bg-muted/40 p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-purple-500 to-indigo-500 text-white">
            <Film className="h-4 w-4" />
          </div>
          <p className="min-w-0 truncate text-sm font-medium">
            {videoAsset?.filename || "Vídeo sem nome"}
          </p>
        </div>
        <Separator className="my-3" />
        <dl className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Duração</dt>
            <dd className="font-medium">
              {duration > 0 ? formatDuration(duration) : "—"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Tamanho</dt>
            <dd className="font-medium">{formatBytes(meta.size ?? 0)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Formato</dt>
            <dd className="font-medium">{meta.mime || "—"}</dd>
          </div>
        </dl>
      </div>

      <div className="space-y-2">
        <Label>Trocar vídeo base</Label>
        <Select
          value={videoAsset?.id ?? ""}
          onValueChange={(id) => {
            const asset = assets.find((a) => a.id === id);
            if (asset && asset.id !== videoAsset?.id) onChangeAsset(asset);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione um vídeo" />
          </SelectTrigger>
          <SelectContent>
            {assets.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.filename || a.url.split("/").pop()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Ao trocar o vídeo, a timeline é reiniciada com um clipe único.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Velocidade</Label>
        <Select value="1" disabled>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1x (normal)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Controle de velocidade em breve.
        </p>
      </div>
    </div>
  );
}
