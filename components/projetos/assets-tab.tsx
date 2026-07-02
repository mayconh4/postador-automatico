"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { uploadFile, removeFile, buildStoragePath } from "@/lib/storage";
import { STORAGE_BUCKETS } from "@/lib/constants";
import type { VideoAsset, VideoAssetType } from "@/lib/types";
import {
  FileAudio,
  FileImage,
  FileVideo,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";

const TYPE_INFO: Record<
  string,
  { label: string; icon: typeof FileVideo; badgeVariant: "default" | "secondary" | "outline" }
> = {
  video: { label: "Vídeo", icon: FileVideo, badgeVariant: "default" },
  audio: { label: "Áudio", icon: FileAudio, badgeVariant: "secondary" },
  image: { label: "Imagem", icon: FileImage, badgeVariant: "outline" },
  background: { label: "Fundo", icon: FileImage, badgeVariant: "outline" },
  watermark: { label: "Marca d'água", icon: FileImage, badgeVariant: "outline" },
};

function detectType(mime: string): VideoAssetType | null {
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("image/")) return "image";
  return null;
}

function bucketForType(type: VideoAssetType): string {
  switch (type) {
    case "audio":
      return STORAGE_BUCKETS.audio;
    case "image":
    case "background":
    case "watermark":
      return STORAGE_BUCKETS.images;
    default:
      return STORAGE_BUCKETS.videos;
  }
}

export function AssetsTab({
  projectId,
  onChanged,
}: {
  projectId: string;
  onChanged?: () => void;
}) {
  const [assets, setAssets] = useState<VideoAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VideoAsset | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("video_assets")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar assets");
    } else {
      setAssets((data ?? []) as unknown as VideoAsset[]);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Você precisa estar autenticado");
      setUploading(false);
      return;
    }

    let uploaded = 0;
    for (const file of Array.from(files)) {
      const type = detectType(file.type);
      if (!type) {
        toast.error(`"${file.name}": formato não suportado (use vídeo, áudio ou imagem)`);
        continue;
      }
      try {
        const bucket = bucketForType(type);
        const path = buildStoragePath(user.id, file.name);
        await uploadFile(bucket, path, file, { contentType: file.type });
        const { data, error } = await supabase
          .from("video_assets")
          .insert({
            project_id: projectId,
            type,
            url: path,
            filename: file.name,
            meta: { bucket, size: file.size, mime: file.type },
          })
          .select()
          .single();
        if (error || !data) throw error ?? new Error("insert falhou");
        setAssets((prev) => [data as unknown as VideoAsset, ...prev]);
        uploaded++;
      } catch {
        toast.error(`Erro ao enviar "${file.name}"`);
      }
    }
    setUploading(false);
    if (uploaded > 0) {
      toast.success(
        uploaded === 1 ? "1 asset enviado" : `${uploaded} assets enviados`
      );
      onChanged?.();
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const supabase = createClient();
    try {
      const meta = (deleteTarget.meta ?? {}) as { bucket?: string };
      const bucket = meta.bucket ?? bucketForType(deleteTarget.type);
      // remove do storage (ignora erro se o arquivo já não existir)
      try {
        await removeFile(bucket, [deleteTarget.url]);
      } catch {
        // arquivo pode não existir mais no storage
      }
      const { error } = await supabase
        .from("video_assets")
        .delete()
        .eq("id", deleteTarget.id);
      if (error) throw error;
      setAssets((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      toast.success("Asset excluído");
      onChanged?.();
      setDeleteTarget(null);
    } catch {
      toast.error("Erro ao excluir asset");
    }
    setDeleting(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Envie vídeos, áudios e imagens para usar nas edições deste projeto.
        </p>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="video/*,audio/*,image/*"
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {uploading ? "Enviando..." : "Enviar arquivos"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
          <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
          <h3 className="font-semibold">Nenhum asset ainda</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Envie seus primeiros vídeos, áudios ou imagens para começar a
            editar.
          </p>
          <Button
            className="mt-4"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="mr-2 h-4 w-4" />
            Enviar arquivos
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Enviado em</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((a) => {
                const info = TYPE_INFO[a.type] ?? TYPE_INFO.video;
                const Icon = info.icon;
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Badge variant={info.badgeVariant}>
                        <Icon className="mr-1 h-3 w-3" />
                        {info.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[320px] truncate font-medium">
                      {a.filename || a.url.split("/").pop()}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {format(new Date(a.created_at), "dd/MM/yyyy HH:mm", {
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget(a)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Excluir asset</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir asset</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir “
              {deleteTarget?.filename || "este arquivo"}”? O arquivo será
              removido do armazenamento e esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
