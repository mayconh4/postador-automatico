"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Archive,
  Bot,
  CalendarClock,
  Loader2,
  Plus,
  Radar,
  Scale,
  Sparkles,
  Trash2,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { LEGAL_AREAS, STATUS_LABELS } from "@/lib/constants";
import type { LegalCase, Project } from "@/lib/types";

const FLOW_STEPS = [
  { icon: Radar, title: "Mapear", text: "Vídeos virais jurídicos das redes" },
  { icon: Sparkles, title: "Extrair", text: "Padrões de viralização com IA" },
  { icon: Bot, title: "Replicar", text: "Conteúdo gerado automaticamente" },
  { icon: CalendarClock, title: "Publicar", text: "Agendamento em escala" },
];

interface CaseWithCounts extends LegalCase {
  patterns_count: number;
  contents_count: number;
}

export default function JuridicoPage() {
  const [cases, setCases] = useState<CaseWithCounts[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [publico, setPublico] = useState("");
  const [projectId, setProjectId] = useState<string>("none");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<LegalCase | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    // Counts embutidos: 1 requisição no lugar de 1 + 2 por caso (N+1)
    const { data, error } = await supabase
      .from("legal_cases")
      .select("*, legal_viral_patterns(count), legal_generated_content(count)")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar casos: " + error.message);
      setLoading(false);
      return;
    }
    type CountRow = { count: number }[] | null;
    type CaseRow = LegalCase & {
      legal_viral_patterns: CountRow;
      legal_generated_content: CountRow;
    };
    const rows = (data ?? []) as unknown as CaseRow[];
    setCases(
      rows.map(({ legal_viral_patterns, legal_generated_content, ...c }) => ({
        ...c,
        patterns_count: legal_viral_patterns?.[0]?.count ?? 0,
        contents_count: legal_generated_content?.[0]?.count ?? 0,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openCreate() {
    setCreateOpen(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    setProjects((data ?? []) as unknown as Project[]);
  }

  async function createCase() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sessão expirada — faça login novamente.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("legal_cases").insert({
      user_id: user.id,
      project_id: projectId === "none" ? null : projectId,
      name: name.trim(),
      legal_area: area || null,
      target_audience: publico.trim() || null,
      status: "active",
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao criar caso: " + error.message);
      return;
    }
    toast.success("Caso criado.");
    setCreateOpen(false);
    setName("");
    setArea("");
    setPublico("");
    setProjectId("none");
    void load();
  }

  async function toggleArchive(c: LegalCase) {
    const supabase = createClient();
    const next = c.status === "archived" ? "active" : "archived";
    const { error } = await supabase
      .from("legal_cases")
      .update({ status: next })
      .eq("id", c.id);
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success(next === "archived" ? "Caso arquivado." : "Caso reativado.");
    void load();
  }

  async function deleteCase() {
    if (!deleteTarget) return;
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("legal_cases")
      .delete()
      .eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
      return;
    }
    toast.success("Caso excluído.");
    setDeleteTarget(null);
    void load();
  }

  return (
    <div>
      <PageHeader
        title="Automação Jurídica"
        description="Máquina de produção de conteúdo viral para advogados."
      >
        <Button onClick={() => void openCreate()}>
          <Plus className="h-4 w-4" /> Novo caso
        </Button>
      </PageHeader>

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {FLOW_STEPS.map((s, i) => (
          <Card key={s.title}>
            <CardContent className="flex items-start gap-3 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <s.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {i + 1}. {s.title}
                </p>
                <p className="text-xs text-muted-foreground">{s.text}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-lg" />
          ))}
        </div>
      ) : cases.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <Scale className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Nenhum caso ainda</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Crie um caso para mapear padrões virais do nicho jurídico e gerar
              conteúdo replicável com IA.
            </p>
            <Button onClick={() => void openCreate()}>
              <Plus className="h-4 w-4" /> Criar primeiro caso
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cases.map((c) => (
            <Card
              key={c.id}
              className={c.status === "archived" ? "opacity-60" : undefined}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/juridico/${c.id}`} className="min-w-0">
                    <CardTitle className="truncate text-base hover:text-primary">
                      {c.name}
                    </CardTitle>
                  </Link>
                  <Badge
                    variant={c.status === "active" ? "success" : "secondary"}
                  >
                    {STATUS_LABELS[c.status] ?? c.status}
                  </Badge>
                </div>
                <CardDescription className="flex flex-wrap items-center gap-2">
                  {c.legal_area && (
                    <Badge variant="outline">{c.legal_area}</Badge>
                  )}
                  <span className="text-xs">
                    {format(new Date(c.created_at), "d MMM yyyy", {
                      locale: ptBR,
                    })}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {c.target_audience && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {c.target_audience}
                  </p>
                )}
                <div className="flex gap-4 text-sm">
                  <span>
                    <strong>{c.patterns_count}</strong>{" "}
                    <span className="text-muted-foreground">padrões</span>
                  </span>
                  <span>
                    <strong>{c.contents_count}</strong>{" "}
                    <span className="text-muted-foreground">conteúdos</span>
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button asChild size="sm" className="flex-1">
                    <Link href={`/juridico/${c.id}`}>Abrir</Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    title={c.status === "archived" ? "Reativar" : "Arquivar"}
                    onClick={() => void toggleArchive(c)}
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 text-destructive"
                    title="Excluir"
                    onClick={() => setDeleteTarget(c)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Criar caso */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo caso jurídico</DialogTitle>
            <DialogDescription>
              Defina o nicho e o público para a IA calibrar os padrões.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Nome do caso</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='Ex.: "Dra. Ana — Trabalhista"'
                maxLength={80}
              />
            </div>
            <div className="grid gap-2">
              <Label>Área do direito</Label>
              <Select value={area} onValueChange={setArea}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a área" />
                </SelectTrigger>
                <SelectContent>
                  {LEGAL_AREAS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Público-alvo</Label>
              <Textarea
                value={publico}
                onChange={(e) => setPublico(e.target.value)}
                placeholder="Ex.: trabalhadores CLT entre 25-45 anos que suspeitam de irregularidades na demissão"
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label>Projeto (opcional)</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem projeto</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void createCase()}
              disabled={!name.trim() || saving}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Criando…
                </>
              ) : (
                "Criar caso"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir caso?</DialogTitle>
            <DialogDescription>
              &quot;{deleteTarget?.name}&quot; e todos os padrões e conteúdos
              gerados serão excluídos permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => void deleteCase()}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Excluindo…
                </>
              ) : (
                "Excluir"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
