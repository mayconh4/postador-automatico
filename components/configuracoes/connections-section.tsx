"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  Facebook,
  Instagram,
  Link2,
  Loader2,
  Music2,
  Plug,
  RefreshCw,
  Unplug,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { PLATFORMS } from "@/lib/constants";
import type { OAuthConnection, Platform } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const PLATFORM_ICONS: Record<Platform, LucideIcon> = {
  instagram: Instagram,
  youtube: Youtube,
  tiktok: Music2,
  facebook: Facebook,
};

function isExpired(connection: OAuthConnection): boolean {
  if (!connection.expires_at) return false;
  return new Date(connection.expires_at).getTime() < Date.now();
}

export function ConnectionsSection() {
  const [connections, setConnections] = useState<OAuthConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyPlatform, setBusyPlatform] = useState<Platform | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("oauth_connections")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar conexões: " + error.message);
    } else {
      setConnections((data ?? []) as unknown as OAuthConnection[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const connect = (platform: Platform) => {
    setBusyPlatform(platform);
    window.location.href = `/api/oauth/${platform}/start`;
  };

  const disconnect = async (connection: OAuthConnection) => {
    setBusyPlatform(connection.platform);
    const supabase = createClient();
    const { error } = await supabase
      .from("oauth_connections")
      .delete()
      .eq("id", connection.id);
    setBusyPlatform(null);
    if (error) {
      toast.error("Erro ao desconectar: " + error.message);
      return;
    }
    setConnections((prev) => prev.filter((c) => c.id !== connection.id));
    const label =
      PLATFORMS.find((p) => p.id === connection.platform)?.label ??
      connection.platform;
    toast.success(`${label} desconectado.`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Conexões
        </CardTitle>
        <CardDescription>
          Conecte suas contas para publicar automaticamente em cada plataforma.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {PLATFORMS.map((platform) => {
              const connection =
                connections.find((c) => c.platform === platform.id) ?? null;
              const expired = connection ? isExpired(connection) : false;
              const Icon = PLATFORM_ICONS[platform.id];
              const busy = busyPlatform === platform.id;

              return (
                <div
                  key={platform.id}
                  className="flex flex-col justify-between gap-4 rounded-lg border p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-lg text-white",
                          platform.bgClass
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold">{platform.label}</p>
                        {connection ? (
                          <p className="text-xs text-muted-foreground">
                            {connection.account_name ?? "Conta conectada"}{" "}
                            <span className="text-muted-foreground/70">
                              ({connection.account_id})
                            </span>
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Nenhuma conta conectada
                          </p>
                        )}
                      </div>
                    </div>
                    {connection ? (
                      expired ? (
                        <Badge variant="warning">Expirado</Badge>
                      ) : (
                        <Badge variant="success">Conectado</Badge>
                      )
                    ) : (
                      <Badge variant="outline">Desconectado</Badge>
                    )}
                  </div>

                  {connection && connection.expires_at && (
                    <p className="text-xs text-muted-foreground">
                      {expired ? "Expirou" : "Expira"}{" "}
                      {formatDistanceToNow(new Date(connection.expires_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {connection ? (
                      <>
                        {expired && (
                          <Button
                            size="sm"
                            onClick={() => connect(platform.id)}
                            disabled={busy}
                          >
                            {busy ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="mr-2 h-4 w-4" />
                            )}
                            Reconectar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void disconnect(connection)}
                          disabled={busy}
                        >
                          {busy ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Unplug className="mr-2 h-4 w-4" />
                          )}
                          Desconectar
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => connect(platform.id)}
                        disabled={busy}
                      >
                        {busy ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Plug className="mr-2 h-4 w-4" />
                        )}
                        Conectar
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
