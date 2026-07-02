"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Server, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface EnvStatus {
  instagram: boolean;
  facebook: boolean;
  youtube: boolean;
  tiktok: boolean;
  openrouter: boolean;
}

const INTEGRATIONS: {
  key: keyof EnvStatus;
  label: string;
  envHint: string;
}[] = [
  { key: "instagram", label: "Instagram (Meta)", envHint: "META_APP_ID" },
  { key: "facebook", label: "Facebook (Meta)", envHint: "META_APP_ID" },
  { key: "youtube", label: "YouTube (Google)", envHint: "GOOGLE_CLIENT_ID" },
  { key: "tiktok", label: "TikTok", envHint: "TIKTOK_CLIENT_KEY" },
  {
    key: "openrouter",
    label: "IA (OpenRouter)",
    envHint: "OPENROUTER_API_KEY",
  },
];

export function EnvironmentSection() {
  const [status, setStatus] = useState<EnvStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/oauth/status");
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as EnvStatus;
        if (!cancelled) setStatus(data);
      } catch {
        if (!cancelled) {
          toast.error("Não foi possível verificar o ambiente do servidor.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const missingCount = status
    ? INTEGRATIONS.filter((i) => !status[i.key]).length
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          Ambiente
        </CardTitle>
        <CardDescription>
          Integrações configuradas no servidor. Sem credenciais, as conexões
          usam o modo demo (simulado).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : status === null ? (
          <p className="text-sm text-muted-foreground">
            Não foi possível verificar as integrações agora. Tente recarregar a
            página.
          </p>
        ) : (
          <div className="space-y-3">
            {INTEGRATIONS.map((integration) => {
              const configured = status[integration.key];
              return (
                <div
                  key={integration.key}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    {configured ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">
                      {integration.label}
                    </span>
                  </div>
                  {configured ? (
                    <Badge variant="success">Configurada</Badge>
                  ) : (
                    <Badge variant="outline">
                      Falta {integration.envHint}
                    </Badge>
                  )}
                </div>
              );
            })}
            {missingCount > 0 && (
              <p className="pt-1 text-xs text-muted-foreground">
                Defina as variáveis de ambiente indicadas no servidor (arquivo
                .env) para habilitar as integrações reais. Os valores nunca são
                exibidos aqui.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
