"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { TemplatePreview } from "@/components/batch/template-preview";
import { TemplateBuilderDialog } from "@/components/batch/template-builder-dialog";
import type { EditTemplate } from "@/lib/types";
import {
  Copy,
  Droplets,
  LayoutTemplate,
  Loader2,
  MoreVertical,
  Paintbrush,
  Pencil,
  Plus,
  Trash2,
  Type,
} from "lucide-react";

function configSummary(template: EditTemplate): React.ReactNode[] {
  const c = template.config;
  const badges: React.ReactNode[] = [];
  if (c.background?.color) {
    badges.push(
      <Badge key="bg" variant="outline" className="gap-1">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full border"
          style={{ backgroundColor: c.background.color }}
        />
        Fundo
      </Badge>
    );
  }
  if (c.watermark?.imageUrl) {
    badges.push(
      <Badge key="wm" variant="outline" className="gap-1">
        <Droplets className="h-3 w-3" />
        Marca d&apos;água
      </Badge>
    );
  }
  if (c.texts?.length) {
    badges.push(
      <Badge key="texts" variant="outline" className="gap-1">
        <Type className="h-3 w-3" />
        {c.texts.length} {c.texts.length === 1 ? "texto" : "textos"}
      </Badge>
    );
  }
  const f = c.filters;
  if (f && (f.preset && f.preset !== "Normal")) {
    badges.push(
      <Badge key="filter" variant="outline" className="gap-1">
        <Paintbrush className="h-3 w-3" />
        {f.preset}
      </Badge>
    );
  } else if (
    f &&
    !f.preset &&
    ((f.brightness ?? 1) !== 1 || (f.contrast ?? 1) !== 1 || (f.saturation ?? 1) !== 1)
  ) {
    badges.push(
      <Badge key="filter" variant="outline" className="gap-1">
        <Paintbrush className="h-3 w-3" />
        Filtro personalizado
      </Badge>
    );
  }
  return badges;
}

export function TemplatesTab({ onChanged }: { onChanged: () => void }) {
  const [templates, setTemplates] = useState<EditTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState<EditTemplate | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<EditTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("edit_templates")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar templates: " + error.message);
    } else {
      setTemplates((data ?? []) as unknown as EditTemplate[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openNew() {
    setEditing(null);
    setBuilderOpen(true);
  }

  function openEdit(template: EditTemplate) {
    setEditing(template);
    setBuilderOpen(true);
  }

  async function handleDuplicate(template: EditTemplate) {
    setDuplicatingId(template.id);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setDuplicatingId(null);
      toast.error("Você precisa estar logado.");
      return;
    }
    const { error } = await supabase.from("edit_templates").insert({
      user_id: user.id,
      name: `${template.name} (cópia)`,
      config: template.config,
    });
    setDuplicatingId(null);
    if (error) {
      toast.error("Erro ao duplicar template: " + error.message);
      return;
    }
    toast.success("Template duplicado!");
    void load();
    onChanged();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("edit_templates")
      .delete()
      .eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) {
      toast.error("Erro ao excluir template: " + error.message);
      return;
    }
    toast.success("Template excluído.");
    setDeleteTarget(null);
    void load();
    onChanged();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Templates definem a edição aplicada a todos os vídeos de um lote.
        </p>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Novo template
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-white">
              <LayoutTemplate className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">Nenhum template ainda</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Crie um template com sua marca d&apos;água, textos fixos e filtros
              para aplicar a dezenas de vídeos de uma só vez.
            </p>
            <Button className="mt-6" onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              Criar primeiro template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <TemplatePreview config={t.config} width={110} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-1">
                      <h3 className="truncate font-semibold" title={t.name}>
                        {t.name}
                      </h3>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground"
                          >
                            {duplicatingId === t.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreVertical className="h-4 w-4" />
                            )}
                            <span className="sr-only">Ações do template</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(t)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => void handleDuplicate(t)}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(t)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Criado em{" "}
                      {format(new Date(t.created_at), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {configSummary(t)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TemplateBuilderDialog
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        template={editing}
        onSaved={() => {
          void load();
          onChanged();
        }}
      />

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir template</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir &quot;{deleteTarget?.name}&quot;?
              Lotes criados com este template também serão removidos. Esta ação
              não pode ser desfeita.
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
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
