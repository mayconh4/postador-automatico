"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileVideo,
  Loader2,
  UploadCloud,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TemplatePreview } from "@/components/batch/template-preview";
import { createClient } from "@/lib/supabase/client";
import { uploadFile } from "@/lib/storage";
import { cn } from "@/lib/utils";
import type { EditTemplate, EditTemplateConfig, Project } from "@/lib/types";

type UploadStatus = "pendente" | "enviando" | "ok" | "erro";

interface UploadEntry {
  file: File;
  status: UploadStatus;
  assetId?: string;
  error?: string;
}

const STEPS = ["Vídeos", "Template", "Confirmar"] as const;

export function NewBatchTab({ onCreated }: { onCreated: () => void }) {
  const [step, setStep] = useState(0);

  // Passo 1 — projeto + uploads
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Passo 2 — template
  const [templates, setTemplates] = useState<EditTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templateId, setTemplateId] = useState<string>("");

  // Passo 3 — nome + criação
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const loadRefs = useCallback(async () => {
    const supabase = createClient();
    const [projRes, tplRes] = await Promise.all([
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
      supabase.from("edit_templates").select("*").order("created_at", { ascending: false }),
    ]);
    if (!projRes.error) setProjects((projRes.data ?? []) as unknown as Project[]);
    if (!tplRes.error) setTemplates((tplRes.data ?? []) as unknown as EditTemplate[]);
    setTemplatesLoading(false);
  }, []);

  useEffect(() => {
    void loadRefs();
  }, [loadRefs]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const videos = Array.from(list).filter((f) => f.type.startsWith("video/"));
    if (videos.length < list.length) {
      toast.warning("Apenas arquivos de vídeo são aceitos.");
    }
    setEntries((prev) => [
      ...prev,
      ...videos.map((file) => ({ file, status: "pendente" as UploadStatus })),
    ]);
  }

  async function uploadAll() {
    if (!projectId) {
      toast.error("Selecione um projeto antes de enviar.");
      return;
    }
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sessão expirada — faça login novamente.");
      return;
    }

    setUploading(true);
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].status === "ok") continue;
      setEntries((prev) =>
        prev.map((e, idx) => (idx === i ? { ...e, status: "enviando" } : e))
      );
      const entry = entries[i];
      try {
        const sanitized = entry.file.name
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-zA-Z0-9._-]+/g, "-");
        const path = `${user.id}/batch/${Date.now()}-${sanitized}`;
        await uploadFile("videos", path, entry.file, {
          contentType: entry.file.type,
        });
        const { data: asset, error } = await supabase
          .from("video_assets")
          .insert({
            project_id: projectId,
            type: "video",
            url: path,
            filename: entry.file.name,
            meta: { bucket: "videos", size: entry.file.size, mime: entry.file.type },
          })
          .select("id")
          .single();
        if (error) throw error;
        setEntries((prev) =>
          prev.map((e, idx) =>
            idx === i ? { ...e, status: "ok", assetId: (asset as { id: string }).id } : e
          )
        );
      } catch (err) {
        setEntries((prev) =>
          prev.map((e, idx) =>
            idx === i
              ? { ...e, status: "erro", error: err instanceof Error ? err.message : "Falha no upload" }
              : e
          )
        );
      }
    }
    setUploading(false);
  }

  const uploaded = entries.filter((e) => e.status === "ok");
  const hasErrors = entries.some((e) => e.status === "erro");
  const allSent = entries.length > 0 && uploaded.length === entries.length;

  async function createBatch() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sessão expirada — faça login novamente.");
      return;
    }
    setCreating(true);
    try {
      const { data: job, error: jobError } = await supabase
        .from("batch_jobs")
        .insert({
          user_id: user.id,
          project_id: projectId,
          template_id: templateId,
          name: name.trim(),
          status: "pending",
          total_items: uploaded.length,
        })
        .select("id")
        .single();
      if (jobError) throw jobError;

      const jobId = (job as { id: string }).id;
      const { error: itemsError } = await supabase.from("batch_items").insert(
        uploaded.map((e) => ({
          batch_job_id: jobId,
          video_asset_id: e.assetId!,
          status: "pending",
        }))
      );
      if (itemsError) throw itemsError;

      toast.success(`Lote "${name.trim()}" criado com ${uploaded.length} vídeos.`);
      // Reset do wizard
      setStep(0);
      setEntries([]);
      setTemplateId("");
      setName("");
      onCreated();
    } catch (err) {
      toast.error(
        "Erro ao criar lote: " + (err instanceof Error ? err.message : "desconhecido")
      );
    } finally {
      setCreating(false);
    }
  }

  const selectedTemplate = templates.find((t) => t.id === templateId);

  return (
    <div className="space-y-6">
      {/* Indicador de passos */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
                i === step
                  ? "bg-primary text-primary-foreground"
                  : i < step
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {i + 1}
            </div>
            <span
              className={cn(
                "text-sm",
                i === step ? "font-medium" : "text-muted-foreground"
              )}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upload em massa</CardTitle>
            <CardDescription>
              Selecione o projeto e envie 10 ou mais vídeos de uma vez.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:max-w-sm">
              <Label>Projeto</Label>
              <Select value={projectId} onValueChange={setProjectId}>
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
                  Nenhum projeto ainda — crie um na aba Projetos.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <UploadCloud className="h-8 w-8" />
              <span className="text-sm font-medium">
                Clique para selecionar vídeos (múltiplos)
              </span>
              <span className="text-xs">MP4, MOV, WebM…</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />

            {entries.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {entries.length} arquivo(s) — {uploaded.length} enviado(s)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={uploading}
                      onClick={() => setEntries([])}
                    >
                      Limpar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void uploadAll()}
                      disabled={uploading || !projectId || allSent}
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
                        </>
                      ) : hasErrors ? (
                        "Reenviar falhas"
                      ) : (
                        "Enviar todos"
                      )}
                    </Button>
                  </div>
                </div>
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
                  {entries.map((e, i) => (
                    <div
                      key={`${e.file.name}-${i}`}
                      className="flex items-center gap-2 rounded px-2 py-1 text-sm"
                    >
                      <FileVideo className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{e.file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {(e.file.size / 1024 / 1024).toFixed(1)} MB
                      </span>
                      {e.status === "pendente" && (
                        <Badge variant="outline">pendente</Badge>
                      )}
                      {e.status === "enviando" && (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      )}
                      {e.status === "ok" && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      )}
                      {e.status === "erro" && (
                        <span title={e.error}>
                          <XCircle className="h-4 w-4 text-destructive" />
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                {entries.length > 0 && entries.length < 10 && (
                  <p className="text-xs text-muted-foreground">
                    Dica: o fluxo foi pensado para 10+ vídeos, mas funciona com
                    qualquer quantidade.
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={() => setStep(1)}
                disabled={uploaded.length === 0 || uploading}
              >
                Continuar ({uploaded.length} vídeos)
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Escolha o template</CardTitle>
            <CardDescription>
              O preset de fundo, marca d&apos;água, textos e filtros será aplicado a
              todos os {uploaded.length} vídeos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {templatesLoading ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[9/16] rounded-lg" />
                ))}
              </div>
            ) : templates.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                Nenhum template ainda. Crie um na aba <strong>Templates</strong> e
                volte aqui.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplateId(t.id)}
                    className={cn(
                      "rounded-lg border-2 p-2 text-left transition-colors",
                      templateId === t.id
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-transparent hover:border-muted-foreground/30"
                    )}
                  >
                    <TemplatePreview
                      config={t.config as EditTemplateConfig}
                      className="w-full"
                    />
                    <p className="mt-2 truncate text-sm font-medium">{t.name}</p>
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(0)}>
                <ChevronLeft className="h-4 w-4" /> Voltar
              </Button>
              <Button onClick={() => setStep(2)} disabled={!templateId}>
                Continuar <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Confirmar lote</CardTitle>
            <CardDescription>
              {uploaded.length} vídeos • template &quot;{selectedTemplate?.name}&quot;
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:max-w-sm">
              <Label>Nome do lote</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='Ex.: "Reels jurídicos — julho"'
                maxLength={80}
              />
            </div>
            <Progress value={100} className="h-1.5 sm:max-w-sm" />
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} disabled={creating}>
                <ChevronLeft className="h-4 w-4" /> Voltar
              </Button>
              <Button
                onClick={() => void createBatch()}
                disabled={!name.trim() || creating}
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Criando…
                  </>
                ) : (
                  "Criar lote"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
