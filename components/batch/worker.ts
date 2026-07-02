"use client";

import { createClient } from "@/lib/supabase/client";
import { downloadFile, getSignedUrl, uploadFile } from "@/lib/storage";
import { STORAGE_BUCKETS } from "@/lib/constants";
import { exportEdit } from "@/lib/video/export";
import type { BatchStatus, EditTemplateConfig } from "@/lib/types";

/**
 * Worker client-side do Batch Edit.
 *
 * Processa os itens de um lote com um pool de concorrência 3: download do
 * original e upload do resultado acontecem em paralelo, mas as exportações
 * são serializadas por um mutex — o FFmpeg.wasm do repo é um singleton com
 * nomes de arquivo fixos no FS virtual e não suporta execuções simultâneas.
 */

export const POOL_CONCURRENCY = 3;

/** Item pronto para processamento (dados já resolvidos do join com video_assets). */
export interface WorkerItem {
  id: string;
  assetBucket: string;
  assetPath: string;
  filename: string | null;
}

export interface ItemPatch {
  status?: BatchStatus;
  progress?: number;
  export_path?: string | null;
  error_message?: string | null;
}

export interface JobPatch {
  status?: BatchStatus;
  completed_items?: number;
  failed_items?: number;
  error_message?: string | null;
}

export interface ProcessJobParams {
  jobId: string;
  userId: string;
  config: EditTemplateConfig;
  /** Itens a processar (pending/failed/presos em processing). */
  items: WorkerItem[];
  /** Itens já concluídos em execuções anteriores. */
  initialCompleted: number;
  /** Flag de cancelamento — checada entre itens (via ref no chamador). */
  isCancelled: () => boolean;
  /** Callbacks para atualização otimista da UI. */
  onItem: (itemId: string, patch: ItemPatch) => void;
  onJob: (patch: JobPatch) => void;
}

export interface ProcessJobResult {
  completed: number;
  failed: number;
  cancelled: boolean;
  errorMessage?: string;
}

// `exportEdit` registra um novo listener de progresso no singleton do FFmpeg a
// cada chamada e não o remove. Passamos sempre o MESMO despachante e roteamos
// para o item ativo — como as exportações são serializadas, não há disputa.
let activeProgressHandler: ((p: number) => void) | null = null;
function progressDispatcher(p: number) {
  activeProgressHandler?.(p);
}

/** Mutex simples: serializa funções assíncronas na ordem de chegada. */
function createMutex() {
  let queue: Promise<unknown> = Promise.resolve();
  return function run<T>(fn: () => Promise<T>): Promise<T> {
    const result = queue.then(fn, fn);
    queue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  };
}

/** Pool de promessas: processa `items` com no máximo `concurrency` em paralelo. */
async function runPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let index = 0;
  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, items.length)) },
    async () => {
      while (index < items.length) {
        const item = items[index++];
        await fn(item);
      }
    }
  );
  await Promise.all(workers);
}

export async function processBatchJob(
  params: ProcessJobParams
): Promise<ProcessJobResult> {
  const { jobId, userId, config, items, isCancelled, onItem, onJob } = params;
  const supabase = createClient();

  // Marca o job como processando (retry zera as falhas anteriores)
  await supabase
    .from("batch_jobs")
    .update({ status: "processing", failed_items: 0, error_message: null })
    .eq("id", jobId);
  onJob({ status: "processing", failed_items: 0, error_message: null });

  // Baixa a marca d'água UMA vez e reutiliza em todos os itens
  let watermarkBlob: Blob | undefined;
  if (config.watermark?.imageUrl) {
    try {
      watermarkBlob = await downloadFile(
        STORAGE_BUCKETS.images,
        config.watermark.imageUrl
      );
    } catch {
      const msg = "Não foi possível baixar a marca d'água do template.";
      await supabase
        .from("batch_jobs")
        .update({ status: "failed", error_message: msg })
        .eq("id", jobId);
      onJob({ status: "failed", error_message: msg });
      return {
        completed: params.initialCompleted,
        failed: 0,
        cancelled: false,
        errorMessage: msg,
      };
    }
  }

  let completed = params.initialCompleted;
  let failed = 0;
  const exportLock = createMutex();

  async function revertToPending(itemId: string) {
    onItem(itemId, { status: "pending", progress: 0 });
    await supabase
      .from("batch_items")
      .update({ status: "pending", progress: 0 })
      .eq("id", itemId);
  }

  async function processItem(item: WorkerItem) {
    // Checa cancelamento entre itens
    if (isCancelled()) return;

    onItem(item.id, { status: "processing", progress: 0, error_message: null });
    await supabase
      .from("batch_items")
      .update({ status: "processing", progress: 0, error_message: null })
      .eq("id", item.id);

    try {
      // 1. Baixa o vídeo original
      const signedUrl = await getSignedUrl(item.assetBucket, item.assetPath, 3600);
      const res = await fetch(signedUrl);
      if (!res.ok) throw new Error(`Falha ao baixar o vídeo (HTTP ${res.status})`);
      const videoBlob = await res.blob();

      if (isCancelled()) {
        await revertToPending(item.id);
        return;
      }

      // 2. Exporta (serializado — ver comentário no topo do arquivo)
      let lastDbProgress = 0;
      const handleProgress = (p: number) => {
        const pct = Math.min(99, Math.round(p * 100));
        onItem(item.id, { progress: pct });
        // Throttle: só grava no banco a cada ~10%
        if (pct - lastDbProgress >= 10) {
          lastDbProgress = pct;
          void supabase
            .from("batch_items")
            .update({ progress: pct })
            .eq("id", item.id);
        }
      };

      const outputBlob = await exportLock<Blob | null>(async () => {
        if (isCancelled()) return null;
        activeProgressHandler = handleProgress;
        try {
          return await exportEdit({
            video: videoBlob,
            clips: undefined,
            background: config.background,
            watermark: config.watermark
              ? { ...config.watermark, imageBlob: watermarkBlob }
              : undefined,
            texts: config.texts?.length ? config.texts : undefined,
            filters: config.filters,
            onProgress: progressDispatcher,
          });
        } finally {
          activeProgressHandler = null;
        }
      });

      if (!outputBlob) {
        // Cancelado antes de exportar
        await revertToPending(item.id);
        return;
      }

      // 3. Sobe o resultado
      const exportPath = `${userId}/${jobId}/${item.id}.mp4`;
      await uploadFile(STORAGE_BUCKETS.batchExports, exportPath, outputBlob, {
        contentType: "video/mp4",
        upsert: true,
      });

      completed++;
      onItem(item.id, {
        status: "completed",
        progress: 100,
        export_path: exportPath,
        error_message: null,
      });
      await supabase
        .from("batch_items")
        .update({
          status: "completed",
          progress: 100,
          export_path: exportPath,
          error_message: null,
        })
        .eq("id", item.id);
    } catch (err) {
      failed++;
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Erro desconhecido ao processar o vídeo";
      onItem(item.id, { status: "failed", error_message: message });
      await supabase
        .from("batch_items")
        .update({ status: "failed", error_message: message })
        .eq("id", item.id);
    }

    // Atualiza contadores do job após cada item
    onJob({ completed_items: completed, failed_items: failed });
    await supabase
      .from("batch_jobs")
      .update({ completed_items: completed, failed_items: failed })
      .eq("id", jobId);
  }

  await runPool(items, POOL_CONCURRENCY, processItem);

  const cancelled = isCancelled();
  if (!cancelled) {
    // completed conta itens de execuções anteriores também
    const allFailed = completed === 0 && failed > 0;
    const finalStatus: BatchStatus = allFailed ? "failed" : "completed";
    const errorMessage =
      failed > 0
        ? `${failed} ${failed === 1 ? "item falhou" : "itens falharam"}`
        : null;
    await supabase
      .from("batch_jobs")
      .update({ status: finalStatus, error_message: errorMessage })
      .eq("id", jobId);
    onJob({ status: finalStatus, error_message: errorMessage });
  }

  return { completed, failed, cancelled };
}
