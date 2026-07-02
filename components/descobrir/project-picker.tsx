"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { FolderPlus, Loader2 } from "lucide-react";

interface ProjectPickerProps {
  value: string;
  onChange: (projectId: string) => void;
  /** incrementa para forçar recarga da lista */
  reloadKey?: number;
}

export function ProjectPicker({ value, onChange, reloadKey = 0 }: ProjectPickerProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNiche, setNewNiche] = useState<string>(NICHES[0]);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar projetos");
    } else {
      const list = (data ?? []) as unknown as Project[];
      setProjects(list);
      if (list.length === 0) setShowCreate(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects, reloadKey]);

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
    setProjects((prev) => [project, ...prev]);
    onChange(project.id);
    setShowCreate(false);
    setNewName("");
    toast.success(`Projeto "${project.name}" criado`);
  }

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {projects.length > 0 && (
        <div className="space-y-2">
          <Label>Projeto</Label>
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um projeto" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                  {p.niche ? ` · ${p.niche}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!showCreate && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => setShowCreate(true)}
        >
          <FolderPlus className="mr-2 h-4 w-4" />
          Criar novo projeto
        </Button>
      )}

      {showCreate && (
        <div className="space-y-3 rounded-md border p-3">
          <p className="text-sm font-medium">
            {projects.length === 0
              ? "Você ainda não tem projetos. Crie um para importar:"
              : "Novo projeto"}
          </p>
          <div className="space-y-2">
            <Label htmlFor="new-project-name">Nome</Label>
            <Input
              id="new-project-name"
              placeholder="Ex.: Cortes Jurídicos"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
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
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar projeto
            </Button>
            {projects.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowCreate(false)}
              >
                Cancelar
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
