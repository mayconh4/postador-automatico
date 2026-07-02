"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { PLATFORM_LABELS } from "@/lib/constants";
import { formatNumber } from "@/lib/utils";
import type { TrendingVideo } from "@/lib/mock/trending";
import { ProjectPicker } from "./project-picker";
import { Loader2 } from "lucide-react";

export function ImportDialog({
  video,
  open,
  onOpenChange,
}: {
  video: TrendingVideo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [projectId, setProjectId] = useState("");
  const [importing, setImporting] = useState(false);

  async function handleImport() {
    if (!video) return;
    if (!projectId) {
      toast.error("Selecione um projeto para importar");
      return;
    }
    setImporting(true);
    const supabase = createClient();
    const { error } = await supabase.from("trend_imports").insert({
      project_id: projectId,
      platform: video.platform,
      title: video.title,
      url: null,
      thumbnail_url: null,
      views: video.views,
      likes: video.likes,
      comments: video.comments,
      shares: video.shares,
      engagement_rate: video.engagementRate,
    });
    setImporting(false);
    if (error) {
      toast.error("Erro ao importar vídeo");
      return;
    }
    toast.success("Vídeo importado para o projeto!");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar vídeo em alta</DialogTitle>
          <DialogDescription>
            Escolha o projeto de destino para salvar este vídeo como referência.
          </DialogDescription>
        </DialogHeader>

        {video && (
          <div className="rounded-md border p-3">
            <p className="line-clamp-2 text-sm font-medium">{video.title}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{PLATFORM_LABELS[video.platform]}</Badge>
              <span>{video.author}</span>
              <span>{formatNumber(video.views)} visualizações</span>
              <span>{video.engagementRate.toFixed(1).replace(".", ",")}% engaj.</span>
            </div>
          </div>
        )}

        <ProjectPicker value={projectId} onChange={setProjectId} />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={importing || !projectId}>
            {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
