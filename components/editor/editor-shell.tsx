"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { downloadFile, getSignedUrl, uploadFile } from "@/lib/storage";
import { STATUS_LABELS, STORAGE_BUCKETS } from "@/lib/constants";
import { exportEdit } from "@/lib/video/export";
import { formatDuration, slugify } from "@/lib/utils";
import type {
  Edit,
  EditStatus,
  TimelineClip,
  VideoAsset,
  WatermarkConfig,
} from "@/lib/types";
import {
  assetBucket,
  DEFAULT_BACKGROUND,
  DEFAULT_FILTERS,
  makeId,
  normalizeOrder,
  sourceToTimeline,
  timelineToSource,
  totalDuration,
  type EditorDoc,
} from "@/components/editor/editor-utils";
import {
  drawPreviewFrame,
  renderTextWatermarkPng,
  type RuntimeCfg,
} from "@/components/editor/preview-draw";
import { EditorTimeline } from "@/components/editor/editor-timeline";
import { VideoPanel } from "@/components/editor/panels/video-panel";
import { AudioPanel } from "@/components/editor/panels/audio-panel";
import { TextPanel } from "@/components/editor/panels/text-panel";
import { WatermarkPanel } from "@/components/editor/panels/watermark-panel";
import { BackgroundPanel } from "@/components/editor/panels/background-panel";
import { FiltersPanel } from "@/components/editor/panels/filters-panel";
import {
  ArrowLeft,
  Check,
  Clapperboard,
  CloudUpload,
  Download,
  Film,
  Loader2,
  Music,
  Palette,
  Pause,
  Play,
  Save,
  SlidersHorizontal,
  Stamp,
  Type,
} from "lucide-react";

const BASE_PX_PER_SEC = 40;

const STATUS_VARIANTS: Record<
  EditStatus,
  "secondary" | "warning" | "success" | "destructive"
> = {
  draft: "secondary",
  exporting: "warning",
  exported: "success",
  failed: "destructive",
};

type ExportPhase =
  | "idle"
  | "preparing"
  | "rendering"
  | "uploading"
  | "done"
  | "error";

const EXPORT_LABELS: Record<ExportPhase, string> = {
  idle: "",
  preparing: "Baixando arquivos de origem...",
  rendering: "Renderizando o vídeo (pode levar alguns minutos)...",
  uploading: "Enviando o resultado para a nuvem...",
  done: "Exportação concluída!",
  error: "A exportação falhou.",
};

const PANEL_TABS = [
  { id: "video", label: "Vídeo", icon: Film },
  { id: "audio", label: "Áudio", icon: Music },
  { id: "text", label: "Texto", icon: Type },
  { id: "watermark", label: "Marca", icon: Stamp },
  { id: "background", label: "Fundo", icon: Palette },
  { id: "filters", label: "Filtros", icon: SlidersHorizontal },
] as const;

const EMPTY_DOC: EditorDoc = {
  name: "",
  clips: [],
  background: DEFAULT_BACKGROUND,
  watermark: null,
  texts: [],
  filters: DEFAULT_FILTERS,
  audioAssetId: null,
};

export function EditorShell({ editId }: { editId: string }) {
  // ---- dados ----
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [status, setStatus] = useState<EditStatus>("draft");
  const [videoAsset, setVideoAsset] = useState<VideoAsset | null>(null);
  const [audioAsset, setAudioAsset] = useState<VideoAsset | null>(null);
  const [doc, setDoc] = useState<EditorDoc>(EMPTY_DOC);

  // ---- preview / timeline ----
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [volume, setVolume] = useState(1);
  const [replaceAudio, setReplaceAudio] = useState(true);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const pxPerSec = BASE_PX_PER_SEC * zoom;

  // ---- salvar ----
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty">(
    "saved"
  );

  // ---- exportar ----
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPhase, setExportPhase] = useState<ExportPhase>("idle");
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const exportUrlRef = useRef<string | null>(null);
  const exporting =
    exportPhase === "preparing" ||
    exportPhase === "rendering" ||
    exportPhase === "uploading";

  // ---- refs (desenho imperativo, sem re-render) ----
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const seekRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const seekingRef = useRef(false);
  const playingRef = useRef(false);
  const clipIndexRef = useRef(0);
  const watermarkImgRef = useRef<HTMLImageElement | null>(null);
  const backgroundImgRef = useRef<HTMLImageElement | null>(null);
  const cfgRef = useRef<RuntimeCfg>({
    clips: [],
    background: DEFAULT_BACKGROUND,
    watermark: null,
    texts: [],
    filters: DEFAULT_FILTERS,
    duration: 0,
    pxPerSec: BASE_PX_PER_SEC,
  });
  const docRef = useRef<EditorDoc>(EMPTY_DOC);
  const videoAssetRef = useRef<VideoAsset | null>(null);
  const audioAssetRef = useRef<VideoAsset | null>(null);
  const replaceAudioRef = useRef(true);
  // autosave só depois do carregamento inicial; pula o setDoc programático
  const loadedRef = useRef(false);
  const skipSaveRef = useRef(0);

  useEffect(() => {
    videoAssetRef.current = videoAsset;
  }, [videoAsset]);
  useEffect(() => {
    audioAssetRef.current = audioAsset;
  }, [audioAsset]);
  useEffect(() => {
    replaceAudioRef.current = replaceAudio;
  }, [replaceAudio]);

  // ---- carregamento inicial ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from("edits")
        .select("*")
        .eq("id", editId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const edit = data as unknown as Edit;

      const [assetRes, projectRes, audioRes] = await Promise.all([
        supabase
          .from("video_assets")
          .select("*")
          .eq("id", edit.video_asset_id)
          .maybeSingle(),
        supabase
          .from("projects")
          .select("*")
          .eq("id", edit.project_id)
          .maybeSingle(),
        edit.audio_overlay
          ? supabase
              .from("video_assets")
              .select("*")
              .eq("id", edit.audio_overlay)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (cancelled) return;

      const asset = (assetRes.data as unknown as VideoAsset | null) ?? null;
      const project = projectRes.data as unknown as { name?: string } | null;
      const overlay = (audioRes.data as unknown as VideoAsset | null) ?? null;

      setProjectId(edit.project_id);
      setProjectName(project?.name ?? "");
      setStatus(edit.status);
      setVideoAsset(asset);
      setAudioAsset(overlay);
      loadedRef.current = true;
      skipSaveRef.current = 1;
      setDoc({
        name: edit.name ?? "",
        clips: normalizeOrder(edit.timeline_json ?? []),
        background: edit.background ?? DEFAULT_BACKGROUND,
        watermark: edit.watermark,
        texts: edit.texts ?? [],
        filters: edit.filters ?? DEFAULT_FILTERS,
        audioAssetId: edit.audio_overlay,
      });
      setLoading(false);
      if (!asset) {
        toast.error("O vídeo base desta edição não foi encontrado");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editId]);

  // ---- persistência ----
  const persist = useCallback(async (): Promise<boolean> => {
    const current = docRef.current;
    const asset = videoAssetRef.current;
    setSaveState("saving");
    const supabase = createClient();
    const { error } = await supabase
      .from("edits")
      .update({
        name: current.name.trim() || null,
        timeline_json: normalizeOrder(current.clips),
        background: current.background,
        watermark: current.watermark,
        texts: current.texts,
        filters: current.filters,
        audio_overlay: current.audioAssetId,
        ...(asset ? { video_asset_id: asset.id } : {}),
      })
      .eq("id", editId);
    if (error) {
      setSaveState("dirty");
      toast.error("Erro ao salvar a edição");
      return false;
    }
    setSaveState("saved");
    return true;
  }, [editId]);

  // autosave com debounce de 3s
  const pendingSaveRef = useRef(false);
  const persistRef = useRef(persist);
  persistRef.current = persist;
  useEffect(() => {
    docRef.current = doc;
    if (!loadedRef.current) return;
    if (skipSaveRef.current > 0) {
      skipSaveRef.current -= 1;
      return;
    }
    setSaveState("dirty");
    pendingSaveRef.current = true;
    const timer = setTimeout(() => {
      pendingSaveRef.current = false;
      void persist();
    }, 3000);
    return () => clearTimeout(timer);
  }, [doc, persist]);

  // Flush no unmount: sem isso, sair da pagina com o debounce pendente
  // descarta silenciosamente as ultimas alteracoes.
  useEffect(() => {
    return () => {
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        void persistRef.current();
      }
    };
  }, []);

  // ---- config de desenho sempre atual (lida pelo rAF) ----
  useEffect(() => {
    cfgRef.current = {
      clips: normalizeOrder(doc.clips),
      background: doc.background,
      watermark: doc.watermark,
      texts: doc.texts,
      filters: doc.filters,
      duration,
      pxPerSec,
    };
  }, [doc, duration, pxPerSec]);

  // ---- fonte de vídeo (signed URL) ----
  useEffect(() => {
    if (!videoAsset) return;
    let cancelled = false;
    (async () => {
      try {
        const url = await getSignedUrl(
          assetBucket(videoAsset),
          videoAsset.url,
          21600
        );
        if (cancelled) return;
        const video = videoRef.current;
        if (video) {
          video.src = url;
          video.load();
        }
      } catch {
        if (!cancelled) toast.error("Erro ao carregar o vídeo base");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [videoAsset]);

  // ---- trilha de áudio sobreposta (signed URL) ----
  useEffect(() => {
    const audio = audioRef.current;
    if (!audioAsset) {
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const url = await getSignedUrl(
          assetBucket(audioAsset),
          audioAsset.url,
          21600
        );
        if (cancelled) return;
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.load();
        }
      } catch {
        if (!cancelled) toast.error("Erro ao carregar a trilha de áudio");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [audioAsset]);

  // ---- imagem da marca d'água ----
  const watermarkPath = doc.watermark?.imageUrl ?? null;
  useEffect(() => {
    if (!watermarkPath) {
      watermarkImgRef.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const url = await getSignedUrl(STORAGE_BUCKETS.images, watermarkPath, 21600);
        if (cancelled) return;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          if (!cancelled) watermarkImgRef.current = img;
        };
        img.src = url;
      } catch {
        // marca d'água indisponível; segue sem ela no preview
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [watermarkPath]);

  // ---- imagem de fundo ----
  const backgroundPath =
    doc.background?.type === "image" ? doc.background.imageUrl ?? null : null;
  useEffect(() => {
    if (!backgroundPath) {
      backgroundImgRef.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const url = await getSignedUrl(STORAGE_BUCKETS.images, backgroundPath, 21600);
        if (cancelled) return;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          if (!cancelled) backgroundImgRef.current = img;
        };
        img.src = url;
      } catch {
        // fundo indisponível; usa cor sólida
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [backgroundPath]);

  // ---- volume / mudo ----
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.volume = volume;
      video.muted = !!audioAsset && replaceAudio;
    }
    const audio = audioRef.current;
    if (audio) audio.volume = volume;
  }, [volume, replaceAudio, audioAsset]);

  // ---- loop de desenho (rAF) ----
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const cfg = cfgRef.current;
      if (video && canvas) {
        const clips = cfg.clips;
        const total = totalDuration(clips);

        // avança para o próximo clipe / para no fim
        if (playingRef.current && clips.length > 0) {
          const idx = Math.min(clipIndexRef.current, clips.length - 1);
          const clip = clips[idx];
          if (video.ended || video.currentTime >= clip.end - 0.02) {
            if (idx < clips.length - 1) {
              clipIndexRef.current = idx + 1;
              video.currentTime = clips[idx + 1].start;
            } else {
              video.pause();
              audioRef.current?.pause();
              playingRef.current = false;
              setPlaying(false);
            }
          }
        }

        const t = sourceToTimeline(clips, clipIndexRef.current, video.currentTime);
        drawPreviewFrame(
          canvas,
          video,
          cfg,
          t,
          watermarkImgRef.current,
          backgroundImgRef.current
        );

        // playhead / seek bar / tempo — imperativos, sem estado React
        if (playheadRef.current) {
          playheadRef.current.style.left = `${t * cfg.pxPerSec}px`;
        }
        if (seekRef.current && !seekingRef.current) {
          seekRef.current.value = String(
            total > 0 ? Math.round((Math.min(t, total) / total) * 1000) : 0
          );
        }
        if (timeRef.current) {
          timeRef.current.textContent = `${formatDuration(Math.min(t, total))} / ${formatDuration(total)}`;
        }

        // mantém a trilha sobreposta em sincronia
        const audio = audioRef.current;
        if (
          audio &&
          audio.src &&
          playingRef.current &&
          !audio.paused &&
          Math.abs(audio.currentTime - t) > 0.4
        ) {
          audio.currentTime = t;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // revoga o object URL do export ao desmontar
  useEffect(
    () => () => {
      if (exportUrlRef.current) URL.revokeObjectURL(exportUrlRef.current);
    },
    []
  );

  // ---- controles de reprodução ----
  const pauseAll = useCallback(() => {
    videoRef.current?.pause();
    audioRef.current?.pause();
    playingRef.current = false;
    setPlaying(false);
  }, []);

  const seekTo = useCallback((t: number) => {
    const video = videoRef.current;
    const cfg = cfgRef.current;
    if (!video) return;
    const total = totalDuration(cfg.clips);
    const clamped = Math.max(0, Math.min(t, total));
    const { clipIndex, sourceTime } = timelineToSource(cfg.clips, clamped);
    clipIndexRef.current = clipIndex;
    if (Number.isFinite(sourceTime)) video.currentTime = sourceTime;
    const audio = audioRef.current;
    if (audio && audio.src) audio.currentTime = clamped;
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    const cfg = cfgRef.current;
    if (!video || cfg.clips.length === 0) return;
    if (playingRef.current) {
      pauseAll();
      return;
    }
    const total = totalDuration(cfg.clips);
    let t = sourceToTimeline(cfg.clips, clipIndexRef.current, video.currentTime);
    if (t >= total - 0.05) {
      seekTo(0);
      t = 0;
    }
    void video.play().catch(() => {
      toast.error("Não foi possível reproduzir o vídeo");
    });
    const audio = audioRef.current;
    if (audio && audio.src) {
      audio.currentTime = t;
      void audio.play().catch(() => undefined);
    }
    playingRef.current = true;
    setPlaying(true);
  }, [pauseAll, seekTo]);

  function handleLoadedMetadata() {
    const video = videoRef.current;
    if (!video) return;
    const d = video.duration;
    if (!Number.isFinite(d) || d <= 0) return;
    setDuration(d);
    setDoc((prev) => {
      if (prev.clips.length > 0) return prev;
      return {
        ...prev,
        clips: [{ id: makeId(), start: 0, end: d, order: 0 }],
      };
    });
  }

  // ---- ações da timeline ----
  function handleSplit() {
    const video = videoRef.current;
    if (!video) return;
    const clips = normalizeOrder(doc.clips);
    const t = sourceToTimeline(clips, clipIndexRef.current, video.currentTime);
    const { clipIndex, sourceTime } = timelineToSource(clips, t);
    const clip = clips[clipIndex];
    if (
      !clip ||
      sourceTime <= clip.start + 0.05 ||
      sourceTime >= clip.end - 0.05
    ) {
      toast.info("Posicione o playhead dentro de um clipe para dividir");
      return;
    }
    const right: TimelineClip = {
      id: makeId(),
      assetId: clip.assetId,
      start: sourceTime,
      end: clip.end,
      order: clip.order + 0.5,
    };
    const next = clips.map((c) =>
      c.id === clip.id ? { ...c, end: sourceTime } : c
    );
    setDoc((prev) => ({ ...prev, clips: normalizeOrder([...next, right]) }));
    setSelectedClipId(clip.id);
    toast.success("Clipe dividido em dois");
  }

  function handleRemove() {
    if (!selectedClipId) return;
    const clips = normalizeOrder(doc.clips);
    if (clips.length <= 1) {
      toast.info("A timeline precisa de ao menos um clipe");
      return;
    }
    const remaining = normalizeOrder(
      clips.filter((c) => c.id !== selectedClipId)
    );
    pauseAll();
    clipIndexRef.current = 0;
    if (videoRef.current && remaining[0]) {
      videoRef.current.currentTime = remaining[0].start;
    }
    setDoc((prev) => ({ ...prev, clips: remaining }));
    setSelectedClipId(null);
    toast.success("Clipe removido");
  }

  function handleMove(dir: -1 | 1) {
    if (!selectedClipId) return;
    setDoc((prev) => {
      const clips = normalizeOrder(prev.clips);
      const idx = clips.findIndex((c) => c.id === selectedClipId);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= clips.length) return prev;
      const next = [...clips];
      const tmp = next[idx];
      next[idx] = next[j];
      next[j] = tmp;
      return { ...prev, clips: next.map((c, i) => ({ ...c, order: i })) };
    });
  }

  function handleZoom(dir: -1 | 1) {
    setZoom((z) =>
      Math.min(4, Math.max(0.25, Number((z * (dir > 0 ? 1.25 : 0.8)).toFixed(2))))
    );
  }

  // ---- painéis ----
  function handleChangeAsset(asset: VideoAsset) {
    pauseAll();
    clipIndexRef.current = 0;
    setSelectedClipId(null);
    setDuration(0);
    setVideoAsset(asset);
    setDoc((prev) => ({ ...prev, clips: [] }));
    toast.success("Vídeo base atualizado");
  }

  function handleSelectAudio(asset: VideoAsset | null) {
    setAudioAsset(asset);
    setDoc((prev) => ({ ...prev, audioAssetId: asset?.id ?? null }));
  }

  // ---- exportação ----
  async function handleExport() {
    const asset = videoAssetRef.current;
    if (!asset) {
      toast.error("Esta edição não tem um vídeo base para exportar");
      return;
    }
    pauseAll();
    if (exportUrlRef.current) {
      URL.revokeObjectURL(exportUrlRef.current);
      exportUrlRef.current = null;
    }
    setExportUrl(null);
    setExportError(null);
    setExportProgress(2);
    setExportPhase("preparing");
    setExportOpen(true);

    const supabase = createClient();
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Você precisa estar autenticado");

      const saved = await persist();
      if (!saved) throw new Error("Não foi possível salvar antes de exportar");

      await supabase
        .from("edits")
        .update({ status: "exporting" })
        .eq("id", editId);
      setStatus("exporting");

      // 1. vídeo fonte
      const signedUrl = await getSignedUrl(assetBucket(asset), asset.url, 3600);
      const response = await fetch(signedUrl);
      if (!response.ok) throw new Error("Falha ao baixar o vídeo fonte");
      const videoBlob = await response.blob();
      setExportProgress(7);

      const current = docRef.current;

      // 2. marca d'água (imagem do storage ou texto rasterizado)
      let watermark: (WatermarkConfig & { imageBlob?: Blob }) | null = null;
      if (current.watermark) {
        if (current.watermark.imageUrl) {
          const blob = await downloadFile(
            STORAGE_BUCKETS.images,
            current.watermark.imageUrl
          );
          watermark = { ...current.watermark, imageBlob: blob };
        } else if (current.watermark.text) {
          watermark = {
            ...current.watermark,
            imageBlob: await renderTextWatermarkPng(current.watermark.text),
          };
        }
      }

      // 3. trilha de áudio
      let audioBlob: Blob | null = null;
      const overlayAsset = audioAssetRef.current;
      if (current.audioAssetId && overlayAsset) {
        audioBlob = await downloadFile(
          assetBucket(overlayAsset),
          overlayAsset.url
        );
      }
      // 3b. imagem de fundo (o export renderiza igual ao preview)
      let backgroundImageBlob: Blob | null = null;
      if (current.background?.type === "image" && current.background.imageUrl) {
        backgroundImageBlob = await downloadFile(
          STORAGE_BUCKETS.images,
          current.background.imageUrl
        );
      }
      setExportProgress(10);
      setExportPhase("rendering");

      // 4. renderização com FFmpeg.wasm
      const output = await exportEdit({
        video: videoBlob,
        clips: normalizeOrder(current.clips),
        background: current.background,
        backgroundImageBlob,
        watermark,
        texts: current.texts,
        filters: current.filters,
        audioOverlay: audioBlob,
        replaceAudio: replaceAudioRef.current,
        onProgress: (p) =>
          setExportProgress(Math.min(89, Math.round(10 + p * 79))),
      });

      // 5. upload para o bucket de exports
      setExportPhase("uploading");
      setExportProgress(90);
      const exportPath = `${user.id}/${editId}.mp4`;
      await uploadFile(STORAGE_BUCKETS.exports, exportPath, output, {
        contentType: "video/mp4",
        upsert: true,
      });
      await supabase
        .from("edits")
        .update({ export_path: exportPath, status: "exported" })
        .eq("id", editId);
      setStatus("exported");

      const objectUrl = URL.createObjectURL(output);
      exportUrlRef.current = objectUrl;
      setExportUrl(objectUrl);
      setExportProgress(100);
      setExportPhase("done");
      toast.success("Vídeo exportado com sucesso!");
    } catch (err) {
      setExportPhase("error");
      setExportError(
        err instanceof Error && err.message
          ? err.message
          : "Erro inesperado durante a exportação"
      );
      toast.error("Erro ao exportar o vídeo");
      await supabase
        .from("edits")
        .update({ status: "failed" })
        .eq("id", editId);
      setStatus("failed");
    }
  }

  function closeExportDialog() {
    setExportOpen(false);
    setExportPhase("idle");
    setExportProgress(0);
    setExportError(null);
    if (exportUrlRef.current) {
      URL.revokeObjectURL(exportUrlRef.current);
      exportUrlRef.current = null;
    }
    setExportUrl(null);
  }

  // ---- estados de carregamento / erro ----
  if (loading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] flex-col gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-9 w-64" />
          <Skeleton className="ml-auto h-9 w-44" />
        </div>
        <div className="flex min-h-0 flex-1 gap-3">
          <Skeleton className="w-80 shrink-0 rounded-xl" />
          <Skeleton className="flex-1 rounded-xl" />
        </div>
        <Skeleton className="h-40 shrink-0 rounded-xl" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
        <Clapperboard className="mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Edição não encontrada</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Ela pode ter sido removida ou você não tem acesso a ela.
        </p>
        <Button asChild className="mt-4">
          <Link href="/editar">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para as edições
          </Link>
        </Button>
      </div>
    );
  }

  const clips = normalizeOrder(doc.clips);
  const timelineTotal = totalDuration(clips);

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-3">
      {/* Cabeçalho */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
          <Link href="/editar" title="Voltar para as edições">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Voltar</span>
          </Link>
        </Button>
        <Input
          value={doc.name}
          placeholder="Nome da edição"
          className="h-9 w-52 font-medium sm:w-72"
          onChange={(e) =>
            setDoc((prev) => ({ ...prev, name: e.target.value }))
          }
        />
        <Badge variant={STATUS_VARIANTS[status] ?? "secondary"}>
          {STATUS_LABELS[status] ?? status}
        </Badge>
        {projectName && (
          <span className="hidden truncate text-xs text-muted-foreground md:inline">
            {projectName}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
            {saveState === "saving" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Salvando...
              </>
            ) : saveState === "dirty" ? (
              <>
                <CloudUpload className="h-3.5 w-3.5" />
                Alterações não salvas
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                Salvo
              </>
            )}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void persist()}
            disabled={saveState === "saving"}
          >
            <Save className="mr-2 h-4 w-4" />
            Salvar
          </Button>
          <Button size="sm" onClick={() => void handleExport()} disabled={exporting}>
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Exportar
          </Button>
        </div>
      </div>

      {/* Zona central: painéis + preview */}
      <div className="flex min-h-0 flex-1 gap-3">
        {/* Painéis (esquerda) */}
        <div className="hidden w-80 shrink-0 flex-col overflow-hidden rounded-xl border bg-card md:flex">
          <Tabs
            defaultValue="video"
            className="flex min-h-0 flex-1 flex-col"
          >
            <TabsList className="m-2 grid h-auto shrink-0 grid-cols-6 p-1">
              {PANEL_TABS.map((t) => {
                const Icon = t.icon;
                return (
                  <TabsTrigger
                    key={t.id}
                    value={t.id}
                    title={t.label}
                    className="flex-col gap-0.5 px-0 py-1.5 text-[10px] leading-none"
                  >
                    <Icon className="h-4 w-4" />
                    {t.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            <ScrollArea className="min-h-0 flex-1">
              <div className="px-3 pb-4">
                <TabsContent value="video" className="mt-0 pt-1">
                  <VideoPanel
                    projectId={projectId}
                    videoAsset={videoAsset}
                    duration={duration}
                    onChangeAsset={handleChangeAsset}
                  />
                </TabsContent>
                <TabsContent value="audio" className="mt-0 pt-1">
                  <AudioPanel
                    projectId={projectId}
                    audioAssetId={doc.audioAssetId}
                    replaceAudio={replaceAudio}
                    volume={volume}
                    onSelectAudio={handleSelectAudio}
                    onReplaceAudioChange={setReplaceAudio}
                    onVolumeChange={setVolume}
                  />
                </TabsContent>
                <TabsContent value="text" className="mt-0 pt-1">
                  <TextPanel
                    texts={doc.texts}
                    duration={Math.max(duration, timelineTotal)}
                    onChange={(texts) =>
                      setDoc((prev) => ({ ...prev, texts }))
                    }
                  />
                </TabsContent>
                <TabsContent value="watermark" className="mt-0 pt-1">
                  <WatermarkPanel
                    projectId={projectId}
                    watermark={doc.watermark}
                    onChange={(watermark) =>
                      setDoc((prev) => ({ ...prev, watermark }))
                    }
                  />
                </TabsContent>
                <TabsContent value="background" className="mt-0 pt-1">
                  <BackgroundPanel
                    projectId={projectId}
                    background={doc.background}
                    onChange={(background) =>
                      setDoc((prev) => ({ ...prev, background }))
                    }
                  />
                </TabsContent>
                <TabsContent value="filters" className="mt-0 pt-1">
                  <FiltersPanel
                    filters={doc.filters}
                    onChange={(filters) =>
                      setDoc((prev) => ({ ...prev, filters }))
                    }
                  />
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        </div>

        {/* Preview (centro) */}
        <div className="flex min-w-0 flex-1 flex-col items-center gap-2 rounded-xl border bg-card p-3">
          <div className="relative min-h-0 w-full flex-1">
            <div className="relative mx-auto aspect-[9/16] h-full max-h-full overflow-hidden rounded-lg bg-black shadow-inner">
              <canvas
                ref={canvasRef}
                width={540}
                height={960}
                className="h-full w-full"
              />
            </div>
          </div>
          <div className="flex w-full max-w-md shrink-0 items-center gap-3">
            <Button
              variant="secondary"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={togglePlay}
              disabled={clips.length === 0}
              title={playing ? "Pausar" : "Reproduzir"}
            >
              {playing ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              <span className="sr-only">{playing ? "Pausar" : "Reproduzir"}</span>
            </Button>
            <input
              ref={seekRef}
              type="range"
              min={0}
              max={1000}
              defaultValue={0}
              aria-label="Posição do vídeo"
              className="h-1.5 min-w-0 flex-1 cursor-pointer accent-primary"
              onPointerDown={() => {
                seekingRef.current = true;
              }}
              onPointerUp={() => {
                seekingRef.current = false;
              }}
              onChange={(e) => {
                const total = totalDuration(cfgRef.current.clips);
                seekTo((Number(e.target.value) / 1000) * total);
              }}
            />
            <span
              ref={timeRef}
              className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground"
            >
              0:00 / 0:00
            </span>
          </div>
        </div>
      </div>

      {/* Timeline (baixo) */}
      <div className="h-40 shrink-0 overflow-hidden rounded-xl border bg-card">
        <EditorTimeline
          clips={clips}
          totalDuration={timelineTotal}
          pxPerSec={pxPerSec}
          zoom={zoom}
          selectedClipId={selectedClipId}
          playheadRef={playheadRef}
          onSelectClip={setSelectedClipId}
          onSeek={seekTo}
          onSplit={handleSplit}
          onRemove={handleRemove}
          onMove={handleMove}
          onZoom={handleZoom}
        />
      </div>

      {/* Fontes de mídia escondidas */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        crossOrigin="anonymous"
        playsInline
        preload="auto"
        className="hidden"
        onLoadedMetadata={handleLoadedMetadata}
      />
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} crossOrigin="anonymous" preload="auto" className="hidden" />

      {/* Dialog de exportação */}
      <Dialog
        open={exportOpen}
        onOpenChange={(open) => {
          if (open) return;
          if (exporting) return; // não fecha durante o processo
          closeExportDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exportar vídeo</DialogTitle>
            <DialogDescription>
              O vídeo é renderizado em 1080x1920 no seu navegador e salvo na
              nuvem. Não feche esta aba durante o processo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Progress value={exportProgress} />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {exporting && <Loader2 className="h-4 w-4 animate-spin" />}
              {exportPhase === "done" && (
                <Check className="h-4 w-4 text-emerald-500" />
              )}
              <span>
                {exportPhase === "error"
                  ? exportError ?? EXPORT_LABELS.error
                  : EXPORT_LABELS[exportPhase]}
              </span>
              <span className="ml-auto text-xs tabular-nums">
                {exportProgress}%
              </span>
            </div>
          </div>
          <DialogFooter>
            {exportPhase === "done" && exportUrl && (
              <Button asChild>
                <a
                  href={exportUrl}
                  download={`${slugify(doc.name || "edicao") || "edicao"}.mp4`}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Baixar vídeo
                </a>
              </Button>
            )}
            {exportPhase === "error" && (
              <Button onClick={() => void handleExport()}>
                Tentar novamente
              </Button>
            )}
            <Button
              variant="outline"
              onClick={closeExportDialog}
              disabled={exporting}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
