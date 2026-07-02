"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addHours, format, startOfHour } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { PLATFORMS, POST_TYPES_BY_PLATFORM } from "@/lib/constants";
import type { BatchJob, Platform, PostType } from "@/lib/types";
import { CalendarClock, Loader2 } from "lucide-react";

const INTERVALS = [
  { hours: 1, label: "1 hora" },
  { hours: 3, label: "3 horas" },
  { hours: 6, label: "6 horas" },
  { hours: 12, label: "12 horas" },
  { hours: 24, label: "24 horas" },
];

const CAPTION_MAX = 2200;

interface CompletedItem {
  id: string;
  export_path: string;
}

function toLocalInput(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

export function ScheduleBatchDialog({
  open,
  onOpenChange,
  job,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: BatchJob | null;
}) {
  const router = useRouter();

  const [items, setItems] = useState<CompletedItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const [platform, setPlatform] = useState<Platform>("instagram");
  const [postType, setPostType] = useState<PostType>("reel");
  const [startAt, setStartAt] = useState("");
  const [intervalHours, setIntervalHours] = useState("3");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [saving, setSaving] = useState(false);

  // Reinicializa e carrega os itens concluídos ao abrir
  useEffect(() => {
    if (!open || !job) return;
    setPlatform("instagram");
    setPostType("reel");
    setStartAt(toLocalInput(startOfHour(addHours(new Date(), 1))));
    setIntervalHours("3");
    setTitle("");
    setCaption("");
    setSaving(false);

    let cancelled = false;
    setLoadingItems(true);
    const load = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("batch_items")
        .select("id, export_path")
        .eq("batch_job_id", job.id)
        .eq("status", "completed")
        .not("export_path", "is", null)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) {
        toast.error("Erro ao carregar os vídeos do lote: " + error.message);
        setItems([]);
      } else {
        setItems((data ?? []) as unknown as CompletedItem[]);
      }
      setLoadingItems(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, job]);

  // Garante post_type válido para a plataforma
  useEffect(() => {
    const types = POST_TYPES_BY_PLATFORM[platform];
    if (!types.some((t) => t.id === postType)) {
      setPostType(types[0].id);
    }
  }, [platform, postType]);

  const schedulePreview = useMemo(() => {
    if (!startAt || items.length === 0) return null;
    const start = new Date(startAt);
    if (Number.isNaN(start.getTime())) return null;
    const hours = Number(intervalHours);
    const last = new Date(start.getTime() + (items.length - 1) * hours * 3600_000);
    const fmt = (d: Date) => format(d, "dd/MM 'às' HH:mm", { locale: ptBR });
    if (items.length === 1) return `1 post em ${fmt(start)}.`;
    return `${items.length} posts: do dia ${fmt(start)} até ${fmt(last)}.`;
  }, [startAt, intervalHours, items]);

  async function handleSchedule() {
    if (!job) return;
    if (items.length === 0) {
      toast.error("Este lote não tem vídeos concluídos para agendar.");
      return;
    }
    if (!startAt || Number.isNaN(new Date(startAt).getTime())) {
      toast.error("Escolha a data e hora do primeiro post.");
      return;
    }
    if (platform === "youtube" && !title.trim()) {
      toast.error("Vídeos do YouTube precisam de um título.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      toast.error("Você precisa estar logado para agendar posts.");
      return;
    }

    const startMs = new Date(startAt).getTime();
    const stepMs = Number(intervalHours) * 3600_000;
    const rows = items.map((item, i) => {
      const n = String(i + 1);
      return {
        user_id: user.id,
        project_id: job.project_id,
        edit_id: null,
        platform,
        post_type: postType,
        title:
          platform === "youtube" && title.trim()
            ? title.trim().replaceAll("{n}", n)
            : null,
        caption: caption.trim() ? caption.trim().replaceAll("{n}", n) : null,
        media_path: item.export_path,
        scheduled_at: new Date(startMs + i * stepMs).toISOString(),
        publish_method: "api",
        status: "pending",
      };
    });

    const { error } = await supabase.from("scheduled_posts").insert(rows);
    setSaving(false);
    if (error) {
      toast.error("Erro ao agendar o lote: " + error.message);
      return;
    }
    toast.success(
      `${rows.length} ${rows.length === 1 ? "post agendado" : "posts agendados"} com sucesso!`,
      {
        action: {
          label: "Ver agenda",
          onClick: () => router.push("/agendar"),
        },
      }
    );
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agendar lote</DialogTitle>
          <DialogDescription>
            Agende todos os vídeos concluídos de &quot;{job?.name}&quot; com
            intervalo automático entre os posts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
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
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                        {p.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de post</Label>
              <Select
                value={postType}
                onValueChange={(v) => setPostType(v as PostType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POST_TYPES_BY_PLATFORM[platform].map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="batch-start">Primeiro post em</Label>
              <Input
                id="batch-start"
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Intervalo entre posts</Label>
              <Select value={intervalHours} onValueChange={setIntervalHours}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVALS.map((i) => (
                    <SelectItem key={i.hours} value={String(i.hours)}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {platform === "youtube" && (
            <div className="space-y-1.5">
              <Label htmlFor="batch-title">Título (YouTube)</Label>
              <Input
                id="batch-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Corte diário #{n}"
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                Use {"{n}"} para inserir o número do post (1, 2, 3...).
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="batch-caption">Legenda base</Label>
              <span className="text-xs text-muted-foreground">
                {caption.length}/{CAPTION_MAX}
              </span>
            </div>
            <Textarea
              id="batch-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, CAPTION_MAX))}
              placeholder={"Parte {n} da série! Siga para não perder as próximas. #shorts"}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Use {"{n}"} para inserir o número do post em cada legenda.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm">
            <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
            {loadingItems ? (
              <span className="text-muted-foreground">
                Carregando vídeos do lote...
              </span>
            ) : items.length === 0 ? (
              <span className="text-muted-foreground">
                Nenhum vídeo concluído neste lote.
              </span>
            ) : (
              <span>{schedulePreview}</span>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => void handleSchedule()}
            disabled={saving || loadingItems || items.length === 0}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Agendar {items.length > 0 ? `${items.length} posts` : "lote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
