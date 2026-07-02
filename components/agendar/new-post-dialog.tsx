"use client";

import { useEffect, useMemo, useState } from "react";
import { addHours, format, startOfHour } from "date-fns";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PLATFORMS, POST_TYPES_BY_PLATFORM } from "@/lib/constants";
import {
  formatSlot,
  nextDateForSlot,
  suggestBestTimes,
} from "@/components/agendar/best-times";
import type {
  Platform,
  PostType,
  Project,
  ScheduledPost,
} from "@/lib/types";
import { Clock, Loader2 } from "lucide-react";

const CAPTION_MAX = 2200;
const NONE = "__none__";

interface EditOption {
  id: string;
  name: string | null;
  export_path: string | null;
}

function toLocalInput(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

function defaultScheduleValue(base?: Date | null): string {
  if (base) {
    const d = new Date(base);
    d.setHours(new Date().getHours() + 1, 0, 0, 0);
    return toLocalInput(d);
  }
  return toLocalInput(startOfHour(addHours(new Date(), 1)));
}

export function NewPostDialog({
  open,
  onOpenChange,
  onSaved,
  editingPost,
  defaultDate,
  allPosts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  editingPost: ScheduledPost | null;
  defaultDate?: Date | null;
  allPosts: ScheduledPost[];
}) {
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [postType, setPostType] = useState<PostType>("reel");
  const [editId, setEditId] = useState<string>(NONE);
  const [projectId, setProjectId] = useState<string>(NONE);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [scheduledAt, setScheduledAt] = useState(defaultScheduleValue());
  const [useApi, setUseApi] = useState(true);
  const [saving, setSaving] = useState(false);

  const [edits, setEdits] = useState<EditOption[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // Reinicializa o formulário quando abrir
  useEffect(() => {
    if (!open) return;
    if (editingPost) {
      setPlatform(editingPost.platform);
      setPostType(editingPost.post_type);
      setEditId(editingPost.edit_id ?? NONE);
      setProjectId(editingPost.project_id ?? NONE);
      setTitle(editingPost.title ?? "");
      setCaption(editingPost.caption ?? "");
      setScheduledAt(toLocalInput(new Date(editingPost.scheduled_at)));
      setUseApi(editingPost.publish_method === "api");
    } else {
      setPlatform("instagram");
      setPostType("reel");
      setEditId(NONE);
      setProjectId(NONE);
      setTitle("");
      setCaption("");
      setScheduledAt(defaultScheduleValue(defaultDate));
      setUseApi(true);
    }
  }, [open, editingPost, defaultDate]);

  // Carrega edições exportadas e projetos
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      const supabase = createClient();
      const [editsRes, projectsRes] = await Promise.all([
        supabase
          .from("edits")
          .select("id, name, export_path")
          .eq("status", "exported")
          .order("created_at", { ascending: false }),
        supabase
          .from("projects")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      setEdits((editsRes.data ?? []) as unknown as EditOption[]);
      setProjects((projectsRes.data ?? []) as unknown as Project[]);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Garante que o post_type é válido para a plataforma
  useEffect(() => {
    const types = POST_TYPES_BY_PLATFORM[platform];
    if (!types.some((t) => t.id === postType)) {
      setPostType(types[0].id);
    }
  }, [platform, postType]);

  const bestTimes = useMemo(
    () => suggestBestTimes(allPosts, platform),
    [allPosts, platform]
  );

  const handleSave = async () => {
    if (!scheduledAt) {
      toast.error("Escolha a data e hora de publicação.");
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

    const selectedEdit = edits.find((e) => e.id === editId);
    const payload = {
      user_id: user.id,
      project_id: projectId === NONE ? null : projectId,
      edit_id: editId === NONE ? null : editId,
      platform,
      post_type: postType,
      title: title.trim() || null,
      caption: caption.trim() || null,
      media_path: selectedEdit?.export_path ?? null,
      scheduled_at: new Date(scheduledAt).toISOString(),
      publish_method: useApi ? "api" : "manual",
    };

    let error: { message: string } | null = null;
    if (editingPost) {
      const res = await supabase
        .from("scheduled_posts")
        .update(payload)
        .eq("id", editingPost.id);
      error = res.error;
    } else {
      const res = await supabase
        .from("scheduled_posts")
        .insert({ ...payload, status: "pending" });
      error = res.error;
    }
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success(
      editingPost ? "Agendamento atualizado!" : "Post agendado com sucesso!"
    );
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editingPost ? "Editar agendamento" : "Novo post"}
          </DialogTitle>
          <DialogDescription>
            Escolha a plataforma, a mídia e o melhor horário para publicar.
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

          <div className="space-y-1.5">
            <Label>Mídia (edição exportada)</Label>
            <Select value={editId} onValueChange={setEditId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma edição" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>
                  Nenhuma (salvar como rascunho de agendamento)
                </SelectItem>
                {edits.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name || "Edição sem nome"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {edits.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhuma edição exportada encontrada. Exporte um vídeo no editor
                para anexá-lo aqui.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
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

          {platform === "youtube" && (
            <div className="space-y-1.5">
              <Label htmlFor="post-title">Título</Label>
              <Input
                id="post-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título do vídeo no YouTube"
                maxLength={100}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="post-caption">Legenda</Label>
              <span className="text-xs text-muted-foreground">
                {caption.length}/{CAPTION_MAX}
              </span>
            </div>
            <Textarea
              id="post-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, CAPTION_MAX))}
              placeholder="Escreva a legenda com hashtags..."
              rows={4}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="post-datetime">Data e hora</Label>
            <Input
              id="post-datetime"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Melhores horários:
              </span>
              {bestTimes.map((slot) => (
                <Button
                  key={`${slot.weekday}-${slot.hour}`}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() =>
                    setScheduledAt(toLocalInput(nextDateForSlot(slot)))
                  }
                >
                  {formatSlot(slot)}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-md border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="publish-method">Publicar automaticamente (API)</Label>
              <p className="text-xs text-muted-foreground">
                {useApi
                  ? "O post será publicado automaticamente pela conta conectada no horário agendado."
                  : "Você receberá o vídeo e a legenda prontos para publicar manualmente no horário."}
              </p>
            </div>
            <Switch
              id="publish-method"
              checked={useApi}
              onCheckedChange={setUseApi}
            />
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
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editingPost ? "Salvar alterações" : "Agendar post"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
