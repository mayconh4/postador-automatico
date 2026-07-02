"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import type { LegalCase, LegalViralPattern } from "@/lib/types";
import type { AnalyzeResponse } from "./juridico-types";

export function PatternsTab({ legalCase }: { legalCase: LegalCase }) {
  const [patterns, setPatterns] = useState<LegalViralPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("legal_viral_patterns")
      .select("*")
      .eq("legal_case_id", legalCase.id)
      .order("score", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar padrões: " + error.message);
    } else {
      setPatterns((data ?? []) as unknown as LegalViralPattern[]);
    }
    setLoading(false);
  }, [legalCase.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function analyze() {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/juridico/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legal_case_id: legalCase.id,
          area: legalCase.legal_area ?? "",
          publico: legalCase.target_audience ?? "",
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(err?.error ?? `Falha na análise (${res.status})`);
      }
      const data = (await res.json()) as AnalyzeResponse;

      const supabase = createClient();
      const { error } = await supabase.from("legal_viral_patterns").insert(
        data.patterns.map((p) => ({
          legal_case_id: legalCase.id,
          pattern_type: p.pattern_type,
          hook: p.hook,
          structure: p.structure,
          cta: p.cta,
          score: p.score,
          analysis: p.analysis,
          metrics: p.metrics,
        }))
      );
      if (error) throw new Error(error.message);

      toast.success(
        `${data.patterns.length} padrões identificados` +
          (data.source === "mock" ? " (modo demonstração)" : "")
      );
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro na análise");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Padrões de viralização extraídos do nicho{" "}
          {legalCase.legal_area ? (
            <strong>{legalCase.legal_area}</strong>
          ) : (
            "jurídico"
          )}
          .
        </p>
        <Button onClick={() => void analyze()} disabled={analyzing}>
          {analyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Analisando…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Analisar padrões virais
            </>
          )}
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      ) : patterns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <TrendingUp className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Nenhum padrão ainda</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Clique em &quot;Analisar padrões virais&quot; para a IA mapear os
              formatos que mais viralizam na sua área.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {patterns.map((p) => (
            <Card key={p.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <Badge>{p.pattern_type ?? "Padrão"}</Badge>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">
                      {Math.round(p.score)}
                    </span>
                    <Progress
                      value={Math.max(0, Math.min(100, p.score))}
                      className="h-1.5 w-20"
                    />
                  </div>
                </div>
                {p.hook && (
                  <CardTitle className="text-base leading-snug">
                    “{p.hook}”
                  </CardTitle>
                )}
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {p.structure && (
                  <p>
                    <span className="font-medium">Estrutura:</span>{" "}
                    <span className="text-muted-foreground">{p.structure}</span>
                  </p>
                )}
                {p.cta && (
                  <p>
                    <span className="font-medium">CTA:</span>{" "}
                    <span className="text-muted-foreground">{p.cta}</span>
                  </p>
                )}
                {p.analysis && (
                  <p className="rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
                    {p.analysis}
                  </p>
                )}
                {p.metrics && (
                  <p className="text-xs text-muted-foreground">
                    {"views_estimadas" in p.metrics
                      ? `Estimativa: ${String(p.metrics.views_estimadas)} views · ER ${String(
                          (p.metrics as Record<string, unknown>).er_estimado ?? "—"
                        )}`
                      : null}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
