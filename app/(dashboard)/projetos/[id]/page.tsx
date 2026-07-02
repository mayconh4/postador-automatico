"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import type { Project } from "@/lib/types";
import { ImportsTab } from "@/components/projetos/imports-tab";
import { AssetsTab } from "@/components/projetos/assets-tab";
import { RoteiroGenerator } from "@/components/projetos/roteiro-generator";
import {
  ArrowLeft,
  Film,
  Scissors,
  TrendingUp,
} from "lucide-react";

interface Counts {
  imports: number;
  assets: number;
  edits: number;
}

export default function ProjetoDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params?.id;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [counts, setCounts] = useState<Counts>({ imports: 0, assets: 0, edits: 0 });

  const loadCounts = useCallback(async () => {
    if (!projectId) return;
    const supabase = createClient();
    const [imports, assets, edits] = await Promise.all([
      supabase
        .from("trend_imports")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId),
      supabase
        .from("video_assets")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId),
      supabase
        .from("edits")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId),
    ]);
    setCounts({
      imports: imports.count ?? 0,
      assets: assets.count ?? 0,
      edits: edits.count ?? 0,
    });
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle();
      if (error) {
        toast.error("Erro ao carregar projeto");
        setNotFound(true);
      } else if (!data) {
        setNotFound(true);
      } else {
        setProject(data as unknown as Project);
        void loadCounts();
      }
      setLoading(false);
    }
    void load();
  }, [projectId, loadCounts]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (notFound || !project) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
        <h2 className="text-lg font-semibold">Projeto não encontrado</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          O projeto pode ter sido excluído ou você não tem acesso a ele.
        </p>
        <Button className="mt-4" onClick={() => router.push("/projetos")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para projetos
        </Button>
      </div>
    );
  }

  const stats = [
    {
      label: "Vídeos importados",
      value: counts.imports,
      icon: TrendingUp,
      gradient: "from-pink-500 to-rose-500",
    },
    {
      label: "Assets enviados",
      value: counts.assets,
      icon: Film,
      gradient: "from-purple-500 to-indigo-500",
    },
    {
      label: "Edições criadas",
      value: counts.edits,
      icon: Scissors,
      gradient: "from-blue-500 to-cyan-500",
    },
  ];

  return (
    <div>
      <PageHeader
        title={project.name}
        description={`Criado em ${format(
          new Date(project.created_at),
          "dd 'de' MMMM 'de' yyyy",
          { locale: ptBR }
        )}`}
      >
        <div className="flex items-center gap-2">
          {project.niche && <Badge variant="secondary">{project.niche}</Badge>}
          <Button variant="outline" onClick={() => router.push("/projetos")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>
      </PageHeader>

      <Tabs defaultValue="visao-geral" className="space-y-4">
        <TabsList>
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="importados">Importados</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="roteiros">Roteiros</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral">
          <div className="grid gap-4 sm:grid-cols-3">
            {stats.map((s) => (
              <Card key={s.label}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {s.label}
                  </CardTitle>
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${s.gradient}`}
                  >
                    <s.icon className="h-4 w-4 text-white" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="importados">
          <ImportsTab projectId={project.id} />
        </TabsContent>

        <TabsContent value="assets">
          <AssetsTab projectId={project.id} onChanged={() => void loadCounts()} />
        </TabsContent>

        <TabsContent value="roteiros">
          <RoteiroGenerator
            contexto={
              project.niche
                ? `O vídeo é para um perfil do nicho de ${project.niche}.`
                : undefined
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
