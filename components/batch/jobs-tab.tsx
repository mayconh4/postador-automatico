"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { downloadFile, uploadFile } from "@/lib/storage";
import { STORAGE_BUCKETS, STATUS_LABELS } from "@/lib/constants";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  processBatchJob,
  type ItemPatch,
  type JobPatch,
  type WorkerItem,
} from "@/components/batch/worker";
import { ScheduleBatchDialog } from "@/components/batch/schedule-batch-dialog";
import type { BatchItem, BatchJob, EditTemplateConfig } from "@/lib/types";
import {
  Archive,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Layers,
  Loader2,
  MonitorX,
  Play,
  Plus,
  Square,
} from "lucide-react";

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning";

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  pending: "secondary",
  processing: "warning",
  completed: "success",
  failed: "destructive",
  cancelled: "outline",
};

/** batch_items com o join de video_assets. */
interface JobItemRow extends BatchItem {
  video_assets: {
    filename: string | null;
    url: string;
    meta: { bucket?: string } | null;
  } | null;
}

function statusBadge(status: string) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "outline"}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function sanitizeFilename(filename: string): string {
  return filename
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._ -]+/g, "-");
}

export function JobsTab({
  refreshToken,
  onGoToNew,
}: {
  /** Incrementado pelo pai quando um lote novo é criado. */
  refreshToken: number;
  onGoToNew: () => void;
}) {
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [loading, setLoading] = useState(true);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [itemsByJob, setItemsByJob] = useState<Record<string, JobItemRow[]>>({});
  const [itemsLoading, setItemsLoading] = useState<Record<string, boolean>>({});

  const [processingJobId, setProcessingJobId] = useState<string | null>(null);
  const cancelRequestsRef = useRef<Set<string>>(new Set());

  const [zipJobId, setZipJobId] = useState<string | null>(null);
  const [scheduleJob, setScheduleJob] = useState<BatchJob | null>(null);

  const loadJobs = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("batch_jobs")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar lotes: " + error.message);
    } else {
      setJobs((data ?? []) as unknown as BatchJob[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs, refreshToken]);

  // Alerta do navegador se tentar fechar a aba durante um processamento
  useEffect(() => {
    if (!processingJobId) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [processingJobId]);

  const loadItems = useCallback(async (jobId: string): Promise<JobItemRow[]> => {
    setItemsLoading((prev) => ({ ...prev, [jobId]: true }));
    const supabase = createClient();
    const { data, error } = await supabase
      .from("batch_items")
      .select("*, video_assets(filename, url, meta)")
      .eq("batch_job_id", jobId)
      .order("created_at", { ascending: true });
    setItemsLoading((prev) => ({ ...prev, [jobId]: false }));
    if (error) {
      toast.error("Erro ao carregar itens do lote: " + error.message);
      return [];
    }
    const rows = (data ?? []) as unknown as JobItemRow[];
    setItemsByJob((prev) => ({ ...prev, [jobId]: rows }));
    return rows;
  }, []);

  function toggleExpand(jobId: string) {
    const next = !expanded[jobId];
    setExpanded((prev) => ({ ...prev, [jobId]: next }));
    if (next && !itemsByJob[jobId]) void loadItems(jobId);
  }

  function patchJob(jobId: string, patch: JobPatch) {
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, ...patch } : j))
    );
  }

  function patchItem(jobId: string, itemId: string, patch: ItemPatch) {
    setItemsByJob((prev) => ({
      ...prev,
      [jobId]: (prev[jobId] ?? []).map((it) =>
        it.id === itemId ? { ...it, ...patch } : it
      ),
    }));
  }

  // ===== Processamento (ISSUE-034) =====

  async function handleProcess(job: BatchJob) {
    if (processingJobId) {
      toast.error("Aguarde: já existe um lote em processamento nesta aba.");
      return;
    }
    setProcessingJobId(job.id);
    cancelRequestsRef.current.delete(job.id);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado para processar lotes.");
        return;
      }

      const { data: template, error: templateError } = await supabase
        .from("edit_templates")
        .select("config")
        .eq("id", job.template_id)
        .single();
      if (templateError || !template) {
        toast.error("Não foi possível carregar o template deste lote.");
        return;
      }
      const config = (template as { config: EditTemplateConfig }).config;

      // Carrega itens frescos e abre o painel para acompanhar o progresso
      const rows = await loadItems(job.id);
      setExpanded((prev) => ({ ...prev, [job.id]: true }));

      // Reprocessa pendentes, falhos e itens presos em "processing"
      const toProcess: WorkerItem[] = rows
        .filter((r) => r.status !== "completed")
        .map((r) => ({
          id: r.id,
          assetPath: r.video_assets?.url ?? "",
          assetBucket: r.video_assets?.meta?.bucket ?? STORAGE_BUCKETS.videos,
          filename: r.video_assets?.filename ?? null,
        }));
      const initialCompleted = rows.filter(
        (r) => r.status === "completed"
      ).length;

      if (toProcess.length === 0) {
        toast.info("Todos os itens deste lote já foram processados.");
        return;
      }

      toast.info(
        "Processamento iniciado. Mantenha esta aba aberta até o final."
      );

      const result = await processBatchJob({
        jobId: job.id,
        userId: user.id,
        config,
        items: toProcess,
        initialCompleted,
        isCancelled: () => cancelRequestsRef.current.has(job.id),
        onItem: (itemId, patch) => patchItem(job.id, itemId, patch),
        onJob: (patch) => patchJob(job.id, patch),
      });

      if (result.cancelled) {
        toast.info("Processamento cancelado.");
      } else if (result.errorMessage) {
        toast.error(result.errorMessage);
      } else if (result.completed === 0 && result.failed > 0) {
        toast.error("Todos os itens do lote falharam.");
      } else if (result.failed > 0) {
        toast.warning(
          `Lote concluído com ${result.failed} ${result.failed === 1 ? "falha" : "falhas"}.`
        );
      } else {
        toast.success(
          `Lote concluído! ${result.completed} ${result.completed === 1 ? "vídeo pronto" : "vídeos prontos"}.`
        );
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro inesperado no processamento";
      toast.error("Erro ao processar o lote: " + message);
    } finally {
      setProcessingJobId(null);
      void loadJobs();
    }
  }

  async function handleCancel(job: BatchJob) {
    cancelRequestsRef.current.add(job.id);
    patchJob(job.id, { status: "cancelled" });
    const supabase = createClient();
    const { error } = await supabase
      .from("batch_jobs")
      .update({ status: "cancelled" })
      .eq("id", job.id);
    if (error) {
      toast.error("Erro ao cancelar: " + error.message);
      return;
    }
    toast.info(
      "Cancelamento solicitado — o item em andamento será finalizado e os demais não serão iniciados."
    );
  }

  // ===== Download ZIP (ISSUE-035) =====

  async function handleDownloadZip(job: BatchJob) {
    if (zipJobId) return;
    setZipJobId(job.id);
    try {
      // Se o ZIP já foi gerado, apenas baixa
      if (job.output_zip_path) {
        const blob = await downloadFile(
          STORAGE_BUCKETS.batchExports,
          job.output_zip_path
        );
        triggerDownload(blob, `${sanitizeFilename(job.name) || "lote"}.zip`);
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado.");
        return;
      }

      const rows = itemsByJob[job.id] ?? (await loadItems(job.id));
      const completedItems = rows.filter(
        (r) => r.status === "completed" && r.export_path
      );
      if (completedItems.length === 0) {
        toast.error("Este lote não tem vídeos concluídos para baixar.");
        return;
      }

      toast.info("Montando o ZIP do lote — isso pode levar alguns minutos...");
      const zip = new JSZip();
      const usedNames = new Map<string, number>();
      for (let i = 0; i < completedItems.length; i++) {
        const item = completedItems[i];
        const blob = await downloadFile(
          STORAGE_BUCKETS.batchExports,
          item.export_path!
        );
        // Nome do arquivo original, garantindo .mp4 e sem duplicatas
        const base = sanitizeFilename(
          (item.video_assets?.filename ?? `video-${i + 1}`).replace(
            /\.[^.]+$/,
            ""
          )
        );
        const count = usedNames.get(base) ?? 0;
        usedNames.set(base, count + 1);
        zip.file(count === 0 ? `${base}.mp4` : `${base}-${count + 1}.mp4`, blob);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const zipPath = `${user.id}/${job.id}/lote.zip`;
      await uploadFile(STORAGE_BUCKETS.batchExports, zipPath, zipBlob, {
        contentType: "application/zip",
        upsert: true,
      });
      const { error } = await supabase
        .from("batch_jobs")
        .update({ output_zip_path: zipPath })
        .eq("id", job.id);
      if (error) {
        toast.error("ZIP gerado, mas houve erro ao salvar o caminho.");
      } else {
        patchJob(job.id, { ...({} as JobPatch) });
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id ? { ...j, output_zip_path: zipPath } : j
          )
        );
      }
      triggerDownload(zipBlob, `${sanitizeFilename(job.name) || "lote"}.zip`);
      toast.success("ZIP do lote baixado!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error("Erro ao baixar o ZIP: " + message);
    } finally {
      setZipJobId(null);
    }
  }

  // ===== Render =====

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-white">
            <Layers className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">Nenhum lote ainda</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Crie um lote com vários vídeos e um template para editar tudo de uma
            vez — depois baixe em ZIP ou agende as publicações.
          </p>
          <Button className="mt-6" onClick={onGoToNew}>
            <Plus className="mr-2 h-4 w-4" />
            Criar primeiro lote
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {processingJobId && (
        <Alert>
          <MonitorX className="h-4 w-4" />
          <AlertTitle>Processamento em andamento</AlertTitle>
          <AlertDescription>
            Mantenha esta aba aberta durante o processamento — os vídeos são
            editados aqui no seu navegador e fechar a aba interrompe o lote.
          </AlertDescription>
        </Alert>
      )}

      {jobs.map((job) => {
        const isProcessing = processingJobId === job.id;
        const isExpanded = !!expanded[job.id];
        const items = itemsByJob[job.id];
        const progressPct =
          job.total_items > 0
            ? Math.round((job.completed_items / job.total_items) * 100)
            : 0;
        const canProcess =
          !isProcessing &&
          ["pending", "failed", "cancelled"].includes(job.status);
        const canZip = job.status === "completed" && job.completed_items > 0;

        return (
          <Card key={job.id}>
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-start gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => toggleExpand(job.id)}
                  aria-label={isExpanded ? "Recolher itens" : "Expandir itens"}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-semibold" title={job.name}>
                      {job.name}
                    </h3>
                    {statusBadge(job.status)}
                    {job.failed_items > 0 && (
                      <Badge variant="destructive">
                        {job.failed_items}{" "}
                        {job.failed_items === 1 ? "falha" : "falhas"}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Criado em{" "}
                    {format(new Date(job.created_at), "dd/MM/yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <Progress value={progressPct} className="h-2 max-w-xs" />
                    <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                      {job.completed_items}/{job.total_items} concluídos
                    </span>
                  </div>
                  {job.error_message && (
                    <p className="mt-1 text-xs text-destructive">
                      {job.error_message}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {canProcess && (
                    <Button
                      size="sm"
                      disabled={!!processingJobId}
                      onClick={() => void handleProcess(job)}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      {job.status === "pending" ? "Processar" : "Reprocessar"}
                    </Button>
                  )}
                  {isProcessing && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => void handleCancel(job)}
                    >
                      <Square className="mr-2 h-4 w-4" />
                      Cancelar
                    </Button>
                  )}
                  {canZip && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={zipJobId === job.id}
                      onClick={() => void handleDownloadZip(job)}
                    >
                      {zipJobId === job.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Archive className="mr-2 h-4 w-4" />
                      )}
                      Baixar ZIP
                    </Button>
                  )}
                  {canZip && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setScheduleJob(job)}
                    >
                      <CalendarClock className="mr-2 h-4 w-4" />
                      Agendar lote
                    </Button>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="mt-4 overflow-x-auto rounded-lg border">
                  {itemsLoading[job.id] && !items ? (
                    <div className="space-y-2 p-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-8 w-full" />
                      ))}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Arquivo</TableHead>
                          <TableHead className="w-[120px]">Status</TableHead>
                          <TableHead className="w-[180px]">Progresso</TableHead>
                          <TableHead>Erro</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(items ?? []).map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="max-w-[280px] truncate font-medium">
                              {item.video_assets?.filename ||
                                item.video_assets?.url.split("/").pop() ||
                                "Vídeo"}
                            </TableCell>
                            <TableCell>{statusBadge(item.status)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress
                                  value={item.progress}
                                  className="h-1.5 w-24"
                                />
                                <span className="text-xs tabular-nums text-muted-foreground">
                                  {item.progress}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[240px] truncate text-xs text-destructive">
                              {item.error_message ?? ""}
                            </TableCell>
                          </TableRow>
                        ))}
                        {items && items.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={4}
                              className="py-6 text-center text-sm text-muted-foreground"
                            >
                              Nenhum item neste lote.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <ScheduleBatchDialog
        open={!!scheduleJob}
        onOpenChange={(open) => !open && setScheduleJob(null)}
        job={scheduleJob}
      />
    </div>
  );
}
