"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NICHES, PLATFORMS } from "@/lib/constants";
import type { Platform, Project } from "@/lib/types";
import { Loader2 } from "lucide-react";

const NONE = "none";

export function AddProfileDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [username, setUsername] = useState("");
  const [niche, setNiche] = useState<string>(NICHES[0]);
  const [projectId, setProjectId] = useState<string>(NONE);
  const [projects, setProjects] = useState<Project[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setProjects((data ?? []) as unknown as Project[]);
      });
  }, [open]);

  async function handleSubmit() {
    const clean = username.trim().replace(/^@/, "");
    if (!clean) {
      toast.error("Informe o @username do perfil.");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado.");
        return;
      }
      const { error } = await supabase.from("references").insert({
        user_id: user.id,
        project_id: projectId === NONE ? null : projectId,
        platform,
        username: clean,
        profile_url: null,
        niche,
        status: "pending",
      });
      if (error) throw error;
      toast.success(`Perfil @${clean} adicionado! Clique em "Raspar" para coletar os dados.`);
      setUsername("");
      onOpenChange(false);
      onCreated();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Erro ao adicionar o perfil."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar perfil de referência</DialogTitle>
          <DialogDescription>
            Espione perfis de sucesso do seu nicho para descobrir padrões
            virais.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Plataforma</Label>
            <Select
              value={platform}
              onValueChange={(v) => setPlatform(v as Platform)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">@username</Label>
            <Input
              id="username"
              placeholder="@perfil.exemplo"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSubmit();
              }}
            />
          </div>

          <div className="space-y-2">
            <Label>Nicho</Label>
            <Select value={niche} onValueChange={setNiche}>
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

          <div className="space-y-2">
            <Label>Projeto (opcional)</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Sem projeto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem projeto</SelectItem>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
