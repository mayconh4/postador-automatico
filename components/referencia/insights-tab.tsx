"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { Separator } from "@/components/ui/separator";
import type {
  ReferenceInsights,
  ReferenceProfile,
  Roteiro,
  ScrapedComment,
  ScrapedPost,
} from "@/lib/types";
import {
  Clapperboard,
  Copy,
  Flame,
  Lightbulb,
  ListChecks,
  Loader2,
  MessageSquareQuote,
  Sparkles,
} from "lucide-react";

export function InsightsTab({
  profile,
  posts,
  comments,
  onInsightsSaved,
}: {
  profile: ReferenceProfile;
  posts: ScrapedPost[];
  comments: ScrapedComment[];
  onInsightsSaved: (insights: ReferenceInsights) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [roteiroLoading, setRoteiroLoading] = useState(false);
  const [roteiro, setRoteiro] = useState<Roteiro | null>(null);
  const [roteiroOpen, setRoteiroOpen] = useState(false);

  const insights = profile.insights_json;

  async function handleGenerate() {
    if (posts.length === 0) {
      toast.error("Raspe o perfil primeiro para gerar insights.");
      return;
    }
    setGenerating(true);
    try {
      const topPosts = [...posts]
        .sort((a, b) => Number(b.engagement_rate) - Number(a.engagement_rate))
        .slice(0, 12);
      const topComments = [...comments]
        .sort((a, b) => b.likes - a.likes)
        .slice(0, 25);

      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference_id: profile.id,
          username: profile.username,
          platform: profile.platform,
          niche: profile.niche,
          posts: topPosts,
          comments: topComments,
        }),
      });
      if (!res.ok) throw new Error("Falha ao gerar insights");
      const data = (await res.json()) as {
        insights: ReferenceInsights;
        source: "ai" | "mock";
      };

      const supabase = createClient();
      const { error } = await supabase
        .from("references")
        .update({ insights_json: data.insights })
        .eq("id", profile.id);
      if (error) throw error;

      onInsightsSaved(data.insights);
      toast.success(
        data.source === "ai"
          ? "Insights gerados com IA!"
          : "Insights gerados (modo demonstração, sem API key)."
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Erro ao gerar os insights."
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleGerarRoteiro() {
    if (!insights) return;
    setRoteiroLoading(true);
    try {
      const topCaptions = [...posts]
        .sort((a, b) => Number(b.engagement_rate) - Number(a.engagement_rate))
        .slice(0, 5)
        .map((p) => p.caption ?? p.title ?? "")
        .filter(Boolean)
        .join("\n---\n");

      const tema =
        insights.viral_patterns?.[0] ??
        insights.summary?.slice(0, 140) ??
        `Conteúdo viral inspirado em @${profile.username}`;

      const res = await fetch("/api/roteiro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tema,
          contexto: `Perfil de referência: @${profile.username} (${profile.platform}${profile.niche ? `, nicho ${profile.niche}` : ""}). Ganchos que funcionam: ${(insights.hooks ?? []).slice(0, 3).join(" | ")}. Top captions do perfil:\n${topCaptions.slice(0, 1500)}`,
        }),
      });
      if (!res.ok) {
        throw new Error("A rota de roteiro ainda não está disponível.");
      }
      const data = (await res.json()) as { roteiro: Roteiro };
      setRoteiro(data.roteiro);
      setRoteiroOpen(true);
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Não foi possível gerar o roteiro agora."
      );
    } finally {
      setRoteiroLoading(false);
    }
  }

  function copyRoteiro() {
    if (!roteiro) return;
    const text = [
      `GANCHO:\n${roteiro.hook}`,
      `CORPO:\n${roteiro.corpo}`,
      `CTA:\n${roteiro.cta}`,
      roteiro.hashtags?.length ? roteiro.hashtags.join(" ") : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    void navigator.clipboard.writeText(text);
    toast.success("Roteiro copiado!");
  }

  if (!insights) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
            <Sparkles className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">
            Nenhum insight gerado ainda
          </h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            A IA analisa os posts e comentários raspados e revela os padrões
            virais, ganchos e formatos que fazem esse perfil crescer.
          </p>
          <Button
            className="mt-6"
            onClick={() => void handleGenerate()}
            disabled={generating || posts.length === 0}
          >
            {generating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Gerar insights
          </Button>
          {posts.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Raspe o perfil primeiro para habilitar a análise.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => void handleGenerate()}
          disabled={generating}
        >
          {generating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Gerar novamente
        </Button>
        <Button
          onClick={() => void handleGerarRoteiro()}
          disabled={roteiroLoading}
        >
          {roteiroLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Clapperboard className="mr-2 h-4 w-4" />
          )}
          Gerar roteiro a partir desta referência
        </Button>
      </div>

      {insights.summary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Resumo estratégico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {insights.summary}
            </p>
            {(insights.tone || insights.posting_frequency) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {insights.tone && (
                  <Badge variant="secondary">Tom: {insights.tone}</Badge>
                )}
                {insights.posting_frequency && (
                  <Badge variant="outline">
                    Frequência: {insights.posting_frequency}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {insights.viral_patterns && insights.viral_patterns.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Flame className="h-4 w-4 text-orange-500" />
                Padrões virais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {insights.viral_patterns.map((p, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-orange-500">•</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {insights.hooks && insights.hooks.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquareQuote className="h-4 w-4 text-violet-500" />
                Ganchos prontos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {insights.hooks.map((h, i) => (
                  <li
                    key={i}
                    className="group flex items-start justify-between gap-2 rounded-md border bg-muted/40 p-2"
                  >
                    <span className="italic">&ldquo;{h}&rdquo;</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 shrink-0 p-0"
                      onClick={() => {
                        void navigator.clipboard.writeText(h);
                        toast.success("Gancho copiado!");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {insights.best_formats && insights.best_formats.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clapperboard className="h-4 w-4 text-sky-500" />
                Melhores formatos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {insights.best_formats.map((f, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-sky-500">•</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {insights.recommendations && insights.recommendations.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="h-4 w-4 text-emerald-500" />
                Recomendações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {insights.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-medium text-emerald-500">
                      {i + 1}.
                    </span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={roteiroOpen} onOpenChange={setRoteiroOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Roteiro gerado</DialogTitle>
            <DialogDescription>
              Baseado nos padrões virais de @{profile.username}.
            </DialogDescription>
          </DialogHeader>
          {roteiro && (
            <div className="max-h-[50vh] space-y-3 overflow-y-auto text-sm">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                  Gancho
                </p>
                <p className="rounded-md bg-muted/50 p-3">{roteiro.hook}</p>
              </div>
              <Separator />
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                  Corpo
                </p>
                <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3">
                  {roteiro.corpo}
                </p>
              </div>
              <Separator />
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                  CTA
                </p>
                <p className="rounded-md bg-muted/50 p-3">{roteiro.cta}</p>
              </div>
              {roteiro.hashtags && roteiro.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {roteiro.hashtags.map((h) => (
                    <Badge key={h} variant="secondary">
                      {h}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoteiroOpen(false)}>
              Fechar
            </Button>
            <Button onClick={copyRoteiro}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar roteiro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
