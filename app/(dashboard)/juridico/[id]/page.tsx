"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Bot, TrendingUp, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PatternsTab } from "@/components/juridico/patterns-tab";
import { ContentTab } from "@/components/juridico/content-tab";
import { ProfilesTab } from "@/components/juridico/profiles-tab";
import { createClient } from "@/lib/supabase/client";
import { STATUS_LABELS } from "@/lib/constants";
import type { LegalCase } from "@/lib/types";

export default function JuridicoCasePage() {
  const params = useParams<{ id: string }>();
  const [legalCase, setLegalCase] = useState<LegalCase | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("legal_cases")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();
    setLegalCase((data as unknown as LegalCase) ?? null);
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (!legalCase) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <p className="font-medium">Caso não encontrado</p>
        <Button asChild variant="outline">
          <Link href="/juridico">
            <ArrowLeft className="h-4 w-4" /> Voltar para casos
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/juridico">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {legalCase.name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {legalCase.legal_area && (
                <Badge variant="outline">{legalCase.legal_area}</Badge>
              )}
              <Badge
                variant={legalCase.status === "active" ? "success" : "secondary"}
              >
                {STATUS_LABELS[legalCase.status] ?? legalCase.status}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {legalCase.target_audience && (
        <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Público-alvo:</span>{" "}
          {legalCase.target_audience}
        </p>
      )}

      <Tabs defaultValue="padroes">
        <TabsList>
          <TabsTrigger value="padroes" className="gap-2">
            <TrendingUp className="h-4 w-4" /> Padrões Virais
          </TabsTrigger>
          <TabsTrigger value="conteudo" className="gap-2">
            <Bot className="h-4 w-4" /> Conteúdo Gerado
          </TabsTrigger>
          <TabsTrigger value="perfis" className="gap-2">
            <Users className="h-4 w-4" /> Perfis de Referência
          </TabsTrigger>
        </TabsList>

        <TabsContent value="padroes" className="mt-4">
          <PatternsTab legalCase={legalCase} />
        </TabsContent>
        <TabsContent value="conteudo" className="mt-4">
          <ContentTab legalCase={legalCase} />
        </TabsContent>
        <TabsContent value="perfis" className="mt-4">
          <ProfilesTab legalCase={legalCase} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
