"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { ConnectionsSection } from "@/components/configuracoes/connections-section";
import { AiModelsSection } from "@/components/configuracoes/ai-models-section";
import { EnvironmentSection } from "@/components/configuracoes/environment-section";
import { PLATFORM_LABELS } from "@/lib/constants";
import type { Platform } from "@/lib/types";

function platformLabel(value: string | null): string {
  if (value && value in PLATFORM_LABELS) {
    return PLATFORM_LABELS[value as Platform];
  }
  return value ?? "plataforma";
}

/** Lê os query params do OAuth (?connected/?demo/?error), mostra toast e limpa a URL. */
function OAuthQueryParamsHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const connected = searchParams.get("connected");
    const demo = searchParams.get("demo");
    const demoPlatform = searchParams.get("platform");
    const error = searchParams.get("error");

    if (!connected && !demo && !error) return;

    if (connected) {
      toast.success(`${platformLabel(connected)} conectado com sucesso!`);
    } else if (demo) {
      toast.success(
        `Conexão demo criada para ${platformLabel(demoPlatform)}. Configure as credenciais no servidor para conectar uma conta real.`
      );
    } else if (error) {
      toast.error(`Falha na conexão: ${error}`);
    }

    router.replace("/configuracoes");
  }, [searchParams, router]);

  return null;
}

export default function ConfiguracoesPage() {
  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Gerencie suas conexões, modelo de IA padrão e integrações do servidor."
      />

      <Suspense fallback={null}>
        <OAuthQueryParamsHandler />
      </Suspense>

      <div className="space-y-6">
        <ConnectionsSection />

        <div className="grid gap-6 lg:grid-cols-2">
          <AiModelsSection />
          <EnvironmentSection />
        </div>
      </div>
    </div>
  );
}
