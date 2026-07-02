"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Bot,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Loader2,
  Trash2,
} from "lucide-react";

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
import { PLATFORMS, POST_TYPES_BY_PLATFORM, STATUS_LABELS } from "@/lib/constants";
import type {
  LegalCase,
  LegalGeneratedContent,
  LegalViralPattern,
  Platform,
  PostType,
} from "@/lib/types";
import type { GenerateResponse } from "./juridico-types";

function nextFullHourLocal(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

export function ContentTab({ legalCase }: { legalCase: LegalCase }) {
  const [contents, setContents] = useState<LegalGeneratedContent[]>([]);
  const [patterns, setPatterns] = useState<LegalViralPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Gerar
  const [genOpen, setGenOpen] = useState(false);
  const [patternId, setPatternId] = useState<string>("");
  const [tema, setTema] = useState("");
  const [quantidade, setQuantidade] = useState("2");
  const [generating, setGenerating] = useState(false);

  // Agendar
  const [scheduleTarget, setScheduleTarget] =
    useState<LegalGeneratedContent | null>(null);
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [postType, setPostType] = useState<PostType>("reel");
  const [scheduledAt, setScheduledAt] = useState(nextFullHourLocal());
  const [scheduling, setScheduling] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [cRes, pRes] = await Promise.all([
      supabase
        .from("legal_generated_content")
        .select("*")
        .eq("legal_case_id", legalCase.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("legal_viral_patterns")
        .select("*")
        .eq("legal_case_id", legalCase.id)
        .order("score", { ascending: false }),
    ]);
    if (!cRes.error) {
      setContents((cRes.data ?? []) as unknown as LegalGeneratedContent[]);
    }
    if (!pRes.error) {
      setPatterns((pRes.data ?? []) as unknown as LegalViralPattern[]);
    }
    setLoading(false);
  }, [legalCase.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate() {
    const pattern = patterns.find((p) => p.id === patternId);
    setGenerating(true);
    try {
      const res = await fetch("/api/juridico/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legal_case_id: legalCase.id,
          pattern: pattern
            ? {
                pattern_type: pattern.pattern_type,
                hook: pattern.hook,
                structure: pattern.structure,
                cta: pattern.cta,
              }
            : null,
          tema: tema.trim() || null,
          quantidade: Number(quantidade),
          area: legalCase.legal_area ?? "",
          publico: legalCase.target_audience ?? "",
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(err?.error ?? `Falha na geração (${res.status})`);
      }
      const data = (await res.json()) as GenerateResponse;

      const supabase = createClient();
      const { error } = await supabase.from("legal_generated_content").insert(
        data.contents.map((c) => ({
          legal_case_id: legalCase.id,
          pattern_id: pattern?.id ?? null,
          title: c.title,
          hook: c.hook,
          body: c.body,
          cta: c.cta,
          full_script: c.full_script,
          caption: c.caption,
          hashtags: c.hashtags,
          status: "draft",
        }))
      );
      if (error) throw new Error(error.message);

      toast.success(
        `${data.contents.length} conteúdo(s) gerado(s)` +
          (data.source === "mock" ? " (modo demonstração)" : "")
      );
      setGenOpen(false);
      setTema("");
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro na geração");
    } finally {
      setGenerating(false);
    }
  }

  async function copyScript(c: LegalGeneratedContent) {
    await navigator.clipboard.writeText(c.full_script ?? "");
    toast.success("Roteiro copiado.");
  }

  async function approve(c: LegalGeneratedContent) {
    const supabase = createClient();
    const { error } = await supabase
      .from("legal_generated_content")
      .update({ status: "approved" })
      .eq("id", c.id);
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success("Conteúdo aprovado.");
    void load();
  }

  async function remove(c: LegalGeneratedContent) {
    const supabase = createClient();
    const { error } = await supabase
      .from("legal_generated_content")
      .delete()
      .eq("id", c.id);
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success("Conteúdo excluído.");
    void load();
  }

  function openSchedule(c: LegalGeneratedContent) {
    setScheduleTarget(c);
    setPlatform("instagram");
    setPostType("reel");
    setScheduledAt(nextFullHourLocal());
  }

  async function schedule() {
    if (!scheduleTarget) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sessão expirada — faça login novamente.");
      return;
    }
    setScheduling(true);
    try {
      const caption = [
        scheduleTarget.caption ?? scheduleTarget.full_script ?? "",
        (scheduleTarget.hashtags ?? []).join(" "),
      ]
        .filter(Boolean)
        .join("\n\n");

      const { data: post, error } = await supabase
        .from("scheduled_posts")
        .insert({
          user_id: user.id,
          project_id: legalCase.project_id,
          platform,
          post_type: postType,
          title: scheduleTarget.title,
          caption,
          scheduled_at: new Date(scheduledAt).toISOString(),
          status: "pending",
          publish_method: "api",
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      const { error: updError } = await supabase
        .from("legal_generated_content")
        .update({
          status: "scheduled",
          scheduled_post_id: (post as { id: string }).id,
        })
        .eq("id", scheduleTarget.id);
      if (updError) throw new Error(updError.message);

      toast.success("Post agendado — veja no calendário.");
      setScheduleTarget(null);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao agendar");
    } finally {
      setScheduling(false);
    }
  }

  const statusVariant = (
    s: string
  ): "secondary" | "success" | "default" | "outline" =>
    s === "approved" ? "success" : s === "scheduled" ? "default" : "secondary";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Roteiros completos gerados a partir dos padrões virais.
        </p>
        <Button onClick={() => setGenOpen(true)}>
          <Bot className="h-4 w-4" /> Gerar conteúdo
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : contents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <Bot className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Nenhum conteúdo gerado</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {patterns.length === 0
                ? "Analise os padrões virais primeiro — a IA usa os padrões como matriz de replicação."
                : "Clique em “Gerar conteúdo” para criar roteiros a partir dos padrões."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {contents.map((c) => {
            const isOpen = !!expanded[c.id];
            return (
              <Card key={c.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{c.title}</CardTitle>
                    <Badge variant={statusVariant(c.status)}>
                      {STATUS_LABELS[c.status] ?? c.status}
                    </Badge>
                  </div>
                  {c.hook && (
                    <CardDescription className="text-sm">
                      🎯 {c.hook}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {isOpen && (
                    <pre className="whitespace-pre-wrap rounded-md bg-muted/60 p-3 font-sans text-sm">
                      {c.full_script}
                    </pre>
                  )}
                  {isOpen && c.caption && (
                    <div className="rounded-md border p-3 text-sm">
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        Legenda
                      </p>
                      <p className="whitespace-pre-wrap">{c.caption}</p>
                    </div>
                  )}
                  {(c.hashtags ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(c.hashtags ?? []).map((h) => (
                        <Badge key={h} variant="outline" className="text-xs">
                          {h.startsWith("#") ? h : `#${h}`}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setExpanded((prev) => ({ ...prev, [c.id]: !isOpen }))
                      }
                    >
                      {isOpen ? (
                        <>
                          <ChevronUp className="h-4 w-4" /> Recolher
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" /> Ver roteiro
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void copyScript(c)}
                    >
                      <Copy className="h-4 w-4" /> Copiar
                    </Button>
                    {c.status === "draft" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void approve(c)}
                      >
                        <Check className="h-4 w-4" /> Aprovar
                      </Button>
                    )}
                    {c.status !== "scheduled" && (
                      <Button size="sm" onClick={() => openSchedule(c)}>
                        <CalendarPlus className="h-4 w-4" /> Agendar
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => void remove(c)}
                    >
                      <Trash2 className="h-4 w-4" /> Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Gerar conteúdo */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar conteúdo com IA</DialogTitle>
            <DialogDescription>
              A IA replica o padrão viral escolhido para a sua área.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Padrão viral</Label>
              <Select value={patternId} onValueChange={setPatternId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      patterns.length === 0
                        ? "Nenhum padrão — analise primeiro"
                        : "Selecione um padrão"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {patterns.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.pattern_type ?? "Padrão"} — score {Math.round(p.score)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Tema específico (opcional)</Label>
              <Input
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                placeholder='Ex.: "horas extras não pagas"'
              />
            </div>
            <div className="grid gap-2">
              <Label>Quantidade</Label>
              <Select value={quantidade} onValueChange={setQuantidade}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["1", "2", "3", "4", "5"].map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setGenOpen(false)}
              disabled={generating}
            >
              Cancelar
            </Button>
            <Button onClick={() => void generate()} disabled={generating}>
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Gerando…
                </>
              ) : (
                "Gerar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Agendar */}
      <Dialog
        open={!!scheduleTarget}
        onOpenChange={(o) => !o && setScheduleTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agendar publicação</DialogTitle>
            <DialogDescription>
              &quot;{scheduleTarget?.title}&quot; entrará no calendário como post
              pendente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Plataforma</Label>
                <Select
                  value={platform}
                  onValueChange={(v) => {
                    const p = v as Platform;
                    setPlatform(p);
                    setPostType(POST_TYPES_BY_PLATFORM[p][0].id);
                  }}
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
              <div className="grid gap-2">
                <Label>Tipo</Label>
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
            <div className="grid gap-2">
              <Label>Data e hora</Label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setScheduleTarget(null)}
              disabled={scheduling}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void schedule()}
              disabled={scheduling || !scheduledAt}
            >
              {scheduling ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Agendando…
                </>
              ) : (
                "Agendar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
