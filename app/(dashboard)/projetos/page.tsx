"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { createClient } from "@/lib/supabase/client";
import { NICHES } from "@/lib/constants";
import type { Project } from "@/lib/types";
import {
  FolderOpen,
  FolderPlus,
  Loader2,
  MoreVertical,
  Pencil,
  Trash2,
  TrendingUp,
  Film,
  Scissors,
} from "lucide-react";

interface ProjectWithCounts extends Project {
  importCount: number;
  assetCount: number;
  editCount: number;
}

export default function ProjetosPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectWithCounts[]>([]);
  const [loading, setLoading] = useState(true);

  // criar
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNiche, setNewNiche] = useState<string>(NICHES[0]);

  // renomear
  const [renameTarget, setRenameTarget] = useState<Project | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  // excluir
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    // Counts embutidos: 1 requisicao no lugar de 1 + 3 por projeto (N+1)
    const { data, error } = await supabase
      .from("projects")
      .select("*, trend_imports(count), video_assets(count), edits(count)")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar projetos");
      setLoading(false);
      return;
    }
    type CountRow = { count: number }[] | null;
    type ProjectRow = Project & {
      trend_imports: CountRow;
      video_assets: CountRow;
      edits: CountRow;
    };
    const list = (data ?? []) as unknown as ProjectRow[];
    const withCounts: ProjectWithCounts[] = list.map(
      ({ trend_imports, video_assets, edits, ...p }) => ({
        ...p,
        importCount: trend_imports?.[0]?.count ?? 0,
        assetCount: video_assets?.[0]?.count ?? 0,
        editCount: edits?.[0]?.count ?? 0,
      })
    );
    setProjects(withCounts);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  async function handleCreate() {
    if (!newName.trim()) {
      toast.error("Informe o nome do projeto");
      return;
    }
    setCreating(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Você precisa estar autenticado");
      setCreating(false);
      return;
    }
    const { data, error } = await supabase
      .from("projects")
      .insert({ user_id: user.id, name: newName.trim(), niche: newNiche })
      .select()
      .single();
    setCreating(false);
    if (error || !data) {
      toast.error("Erro ao criar projeto");
      return;
    }
    const project = data as unknown as Project;
    setProjects((prev) => [
      { ...project, importCount: 0, assetCount: 0, editCount: 0 },
      ...prev,
    ]);
    setCreateOpen(false);
    setNewName("");
    setNewNiche(NICHES[0]);
    toast.success(`Projeto "${project.name}" criado`);
  }

  async function handleRename() {
    if (!renameTarget) return;
    if (!renameValue.trim()) {
      toast.error("Informe o novo nome");
      return;
    }
    setRenaming(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("projects")
      .update({ name: renameValue.trim() })
      .eq("id", renameTarget.id);
    setRenaming(false);
    if (error) {
      toast.error("Erro ao renomear projeto");
      return;
    }
    setProjects((prev) =>
      prev.map((p) =>
        p.id === renameTarget.id ? { ...p, name: renameValue.trim() } : p
      )
    );
    toast.success("Projeto renomeado");
    setRenameTarget(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) {
      toast.error("Erro ao excluir projeto");
      return;
    }
    setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    toast.success(`Projeto "${deleteTarget.name}" excluído`);
    setDeleteTarget(null);
  }

  return (
    <div>
      <PageHeader
        title="Projetos"
        description="Organize suas importações, assets e edições por projeto."
      >
        <Button onClick={() => setCreateOpen(true)}>
          <FolderPlus className="mr-2 h-4 w-4" />
          Novo projeto
        </Button>
      </PageHeader>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Nenhum projeto ainda</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Crie seu primeiro projeto para começar a importar tendências, subir
            assets e gerar roteiros com IA.
          </p>
          <Button className="mt-4" onClick={() => setCreateOpen(true)}>
            <FolderPlus className="mr-2 h-4 w-4" />
            Criar primeiro projeto
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => router.push(`/projetos/${p.id}`)}
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="min-w-0">
                  <CardTitle className="truncate text-base">{p.name}</CardTitle>
                  <div className="mt-2 flex items-center gap-2">
                    {p.niche && <Badge variant="secondary">{p.niche}</Badge>}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-4 w-4" />
                      <span className="sr-only">Ações do projeto</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenuItem
                      onClick={() => {
                        setRenameTarget(p);
                        setRenameValue(p.name);
                      }}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Renomear
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleteTarget(p)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-muted p-2">
                    <TrendingUp className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-semibold">{p.importCount}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Importados
                    </p>
                  </div>
                  <div className="rounded-md bg-muted p-2">
                    <Film className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-semibold">{p.assetCount}</p>
                    <p className="text-[11px] text-muted-foreground">Assets</p>
                  </div>
                  <div className="rounded-md bg-muted p-2">
                    <Scissors className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-semibold">{p.editCount}</p>
                    <p className="text-[11px] text-muted-foreground">Edições</p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-0">
                <p className="text-xs text-muted-foreground">
                  Criado em{" "}
                  {format(new Date(p.created_at), "dd 'de' MMMM 'de' yyyy", {
                    locale: ptBR,
                  })}
                </p>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog: criar projeto */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo projeto</DialogTitle>
            <DialogDescription>
              Dê um nome ao projeto e escolha o nicho principal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="project-name">Nome</Label>
              <Input
                id="project-name"
                placeholder="Ex.: Cortes Jurídicos"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreate();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Nicho</Label>
              <Select value={newNiche} onValueChange={setNewNiche}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NICHES.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar projeto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: renomear */}
      <Dialog
        open={!!renameTarget}
        onOpenChange={(open) => !open && setRenameTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear projeto</DialogTitle>
            <DialogDescription>
              Digite o novo nome para “{renameTarget?.name}”.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="rename-input">Novo nome</Label>
            <Input
              id="rename-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleRename();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={handleRename} disabled={renaming}>
              {renaming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
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
            <DialogTitle>Excluir projeto</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir “{deleteTarget?.name}”? Todas as
              importações, assets e edições deste projeto serão removidos. Esta
              ação não pode ser desfeita.
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
              Excluir definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
