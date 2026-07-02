"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";
import { PLATFORM_LABELS } from "@/lib/constants";
import type { TrendImport } from "@/lib/types";
import { ExternalLink, TrendingUp } from "lucide-react";

const PLATFORM_BADGE_CLASS: Record<string, string> = {
  instagram: "bg-pink-500 text-white hover:bg-pink-500",
  youtube: "bg-red-500 text-white hover:bg-red-500",
  tiktok: "bg-zinc-900 text-white hover:bg-zinc-900",
  facebook: "bg-blue-500 text-white hover:bg-blue-500",
};

export function ImportsTab({ projectId }: { projectId: string }) {
  const [imports, setImports] = useState<TrendImport[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("trend_imports")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar importações");
    } else {
      setImports((data ?? []) as unknown as TrendImport[]);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (imports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
        <TrendingUp className="mb-3 h-10 w-10 text-muted-foreground" />
        <h3 className="font-semibold">Nenhuma importação ainda</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Use a página Descobrir para importar vídeos em alta para este
          projeto.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Plataforma</TableHead>
            <TableHead>Título</TableHead>
            <TableHead className="text-right">Views</TableHead>
            <TableHead className="text-right">Likes</TableHead>
            <TableHead className="text-right">Comentários</TableHead>
            <TableHead className="text-right">Engajamento</TableHead>
            <TableHead>Data</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {imports.map((t) => (
            <TableRow key={t.id}>
              <TableCell>
                <Badge
                  className={
                    PLATFORM_BADGE_CLASS[t.platform] ??
                    "bg-muted text-foreground"
                  }
                >
                  {PLATFORM_LABELS[t.platform] ?? t.platform}
                </Badge>
              </TableCell>
              <TableCell className="max-w-[280px] truncate font-medium">
                {t.title || "Sem título"}
              </TableCell>
              <TableCell className="text-right">
                {formatNumber(t.views)}
              </TableCell>
              <TableCell className="text-right">
                {formatNumber(t.likes)}
              </TableCell>
              <TableCell className="text-right">
                {formatNumber(t.comments)}
              </TableCell>
              <TableCell className="text-right">
                {Number(t.engagement_rate).toFixed(1)}%
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {format(new Date(t.created_at), "dd/MM/yyyy", { locale: ptBR })}
              </TableCell>
              <TableCell>
                {t.url && (
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-muted-foreground hover:text-foreground"
                    title="Abrir original"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
