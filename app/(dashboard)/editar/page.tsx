"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { buildStoragePath, uploadFile } from "@/lib/storage";
import { STATUS_LABELS, STORAGE_BUCKETS } from "@/lib/constants";
import type { Edit, EditStatus, Project, VideoAsset } from "@/lib/types";
import { formatBytes } from "@/components/editor/editor-utils";
import {
  Clapperboard,
  Film,
  FolderOpen,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Scissors,
  Trash2,
  Upload,
} from "lucide-react";

const STATUS_VARIANTS: Record<
  EditStatus,
  "secondary" | "warning" | "success" | "destructive"
> = {
  draft: "secondary",
  exporting: "warning",
  exported: "success",
  failed: "destructive",
};

interface EditListItem extends Edit {
  projectName: string | null;
  assetName: string | null;
}

export default function EditarPage() {
  const router = useRouter();
  const [edits, setEdits] = useState<EditListItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // nova edição
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newProjectId, setNewProjectId] = useState("");
  const [mode, setMode] = useState<"asset" | "upload">("asset");
  const [projectAssets, setProjectAssets] = useState<VideoAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [newAssetId, setNewAssetId] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // excluir
  const [deleteTarget, setDeleteTarget] = useState<EditListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [editsRes, projectsRes] = await Promise.all([
      supabase.from("edits").select("*").order("created_at", { ascending: false }),
      supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);
    if (editsRes.error || projectsRes.error) {
      toast.error("Erro ao carregar as edições");
      setLoading(false);
      return;
    }
    const editList = (editsRes.data ?? []) as unknown as Edit[];
    const projectList = (projectsRes.data ?? []) as unknown as Project[];

    const assetIds = Array.from(
      new Set(editList.map((e) => e.video_asset_id).filter(Boolean))
    );
    const assetMap = new Map<string, string | null>();
    if (assetIds.length > 0) {
      const { data } = await supabase
        .from("video_assets")
        .select("id, filename")
        .in("id", assetIds);
      const rows = (data ?? []) as unknown as {
        id: string;
        filename: string | null;
      }[];
      rows.forEach((a) => assetMap.set(a.id, a.filename));
    }

    const projectMap = new Map(projectList.map((p) => [p.id, p.name]));
    setProjects(projectList);
    setEdits(
      editList.map((e) => ({
        ...e,
        projectName: projectMap.get(e.project_id) ?? null,
        assetName: assetMap.get(e.video_asset_id) ?? null,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Assets de vídeo do projeto escolhido no dialog
  useEffect(() => {
    if (!newProjectId) {
      setProjectAssets([]);
      setNewAssetId("");
      return;
    }
    let cancelled = false;
    setAssetsLoading(true);
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("video_assets")
        .select("*")
        .eq("project_id", newProjectId)
        .eq("type", "video")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        toast.error("Erro ao carregar vídeos do projeto");
      } else {
        const list = (data ?? []) as unknown as VideoAsset[];
        setProjectAssets(list);
        setNewAssetId(list[0]?.id ?? "");
      }
      setAssetsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [newProjectId]);

  function resetDialog() {
    setNewName("");
    setNewProjectId("");
    setMode("asset");
    setNewAssetId("");
    setNewFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleCreate() {
    if (!newProjectId) {
      toast.error("Selecione um projeto");
      return;
    }
    if (mode === "asset" && !newAssetId) {
      toast.error("Selecione um vídeo do projeto ou envie um arquivo");
      return;
    }
    if (mode === "upload") {
      if (!newFile) {
        toast.error("Escolha um arquivo de vídeo para enviar");
        return;
      }
      if (!newFile.type.startsWith("video/")) {
        toast.error("O arquivo precisa ser um vídeo");
        return;
      }
    }
    setCreating(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      let assetId = newAssetId;
      if (mode === "upload" && newFile) {
        const path = buildStoragePath(user.id, newFile.name);
        await uploadFile(STORAGE_BUCKETS.videos, path, newFile, {
          contentType: newFile.type,
        });
        const { data, error } = await supabase
          .from("video_assets")
          .insert({
            project_id: newProjectId,
            type: "video",
            url: path,
            filename: newFile.name,
            meta: {
              bucket: STORAGE_BUCKETS.videos,
              size: newFile.size,
              mime: newFile.type,
            },
          })
          .select()
          .single();
        if (error || !data) throw error ?? new Error("Falha ao registrar o asset");
        assetId = (data as unknown as VideoAsset).id;
      }

      const { data: editData, error: editError } = await supabase
        .from("edits")
        .insert({
          project_id: newProjectId,
          video_asset_id: assetId,
          name: newName.trim() || null,
          timeline_json: [],
          status: "draft",
        })
        .select()
        .single();
      if (editError || !editData) {
        throw editError ?? new Error("Falha ao criar a edição");
      }
      toast.success("Edição criada! Abrindo o editor...");
      setCreateOpen(false);
      router.push(`/editar/${(editData as unknown as Edit).id}`);
    } catch {
      toast.error("Erro ao criar a edição");
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("edits")
      .delete()
      .eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) {
      toast.error("Erro ao excluir a edição");
      return;
    }
    setEdits((prev) => prev.filter((e) => e.id !== deleteTarget.id));
    toast.success("Edição excluída");
    setDeleteTarget(null);
  }

  return (
    <div>
      <PageHeader
        title="Editor de vídeo"
        description="Corte, adicione textos, marca d'água e filtros aos seus vídeos verticais."
      >
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova edição
        </Button>
      </PageHeader>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : edits.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <Clapperboard className="mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Nenhuma edição ainda</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Crie sua primeira edição a partir de um vídeo do projeto ou enviando
            um arquivo novo.
          </p>
          <Button className="mt-4" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Criar primeira edição
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {edits.map((e) => (
            <Card
              key={e.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => router.push(`/editar/${e.id}`)}
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="min-w-0">
                  <CardTitle className="truncate text-base">
                    {e.name || "Edição sem nome"}
                  </CardTitle>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge variant={STATUS_VARIANTS[e.status] ?? "secondary"}>
                      {STATUS_LABELS[e.status] ?? e.status}
                    </Badge>
                    {e.projectName && (
                      <Badge variant="outline" className="max-w-[10rem]">
                        <FolderOpen className="mr-1 h-3 w-3 shrink-0" />
                        <span className="truncate">{e.projectName}</span>
                      </Badge>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      <MoreVertical className="h-4 w-4" />
                      <span className="sr-only">Ações da edição</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    onClick={(ev) => ev.stopPropagation()}
                  >
                    <DropdownMenuItem
                      onClick={() => router.push(`/editar/${e.id}`)}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Abrir no editor
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleteTarget(e)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Film className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {e.assetName || "Vídeo base"}
                  </span>
                </div>
              </CardContent>
              <CardFooter className="pt-0">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Scissors className="h-3 w-3" />
                  Criada em{" "}
                  {format(new Date(e.created_at), "dd/MM/yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </p>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog: nova edição */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova edição</DialogTitle>
            <DialogDescription>
              Escolha o projeto e o vídeo base para começar a editar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome (opcional)</Label>
              <Input
                id="edit-name"
                placeholder="Ex.: Corte podcast #12"
                value={newName}
                onChange={(ev) => setNewName(ev.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Projeto</Label>
              <Select value={newProjectId} onValueChange={setNewProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um projeto" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {projects.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Você ainda não tem projetos.{" "}
                  <button
                    type="button"
                    className="underline underline-offset-2"
                    onClick={() => router.push("/projetos")}
                  >
                    Crie um projeto primeiro
                  </button>
                  .
                </p>
              )}
            </div>

            <Tabs value={mode} onValueChange={(v) => setMode(v as "asset" | "upload")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="asset">Vídeo do projeto</TabsTrigger>
                <TabsTrigger value="upload">Enviar arquivo</TabsTrigger>
              </TabsList>
            </Tabs>

            {mode === "asset" ? (
              <div className="space-y-2">
                <Label>Vídeo base</Label>
                <Select
                  value={newAssetId}
                  onValueChange={setNewAssetId}
                  disabled={!newProjectId || assetsLoading}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        !newProjectId
                          ? "Selecione um projeto primeiro"
                          : assetsLoading
                            ? "Carregando vídeos..."
                            : "Selecione um vídeo"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {projectAssets.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.filename || a.url.split("/").pop()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {newProjectId && !assetsLoading && projectAssets.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Este projeto não tem vídeos. Use a aba &quot;Enviar
                    arquivo&quot;.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Arquivo de vídeo</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(ev) => setNewFile(ev.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {newFile
                      ? `${newFile.name} (${formatBytes(newFile.size)})`
                      : "Escolher vídeo do computador"}
                  </span>
                </Button>
                <p className="text-xs text-muted-foreground">
                  O arquivo será salvo nos assets do projeto selecionado.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleCreate()} disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {creating ? "Criando..." : "Criar e abrir editor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: excluir */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir edição</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir “
              {deleteTarget?.name || "Edição sem nome"}”? Esta ação não pode ser
              desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
