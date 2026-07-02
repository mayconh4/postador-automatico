"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PLATFORM_LABELS, STATUS_LABELS } from "@/lib/constants";
import { platformColor, postTypeLabel } from "@/components/agendar/post-chip";
import type { Publication, ScheduledPost, ScheduledPostStatus } from "@/lib/types";
import {
  ExternalLink,
  Pencil,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";

function statusVariant(
  status: ScheduledPostStatus
): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" {
  switch (status) {
    case "published":
      return "success";
    case "failed":
      return "destructive";
    case "processing":
      return "warning";
    case "cancelled":
      return "outline";
    default:
      return "secondary";
  }
}

export function PostDetailsDialog({
  post,
  open,
  onOpenChange,
  onChanged,
  onEdit,
}: {
  post: ScheduledPost | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
  onEdit: (post: ScheduledPost) => void;
}) {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loadingPubs, setLoadingPubs] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !post) return;
    let cancelled = false;
    const load = async () => {
      setLoadingPubs(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("publications")
        .select("*")
        .eq("scheduled_post_id", post.id)
        .order("executed_at", { ascending: false });
      if (!cancelled) {
        setPublications((data ?? []) as unknown as Publication[]);
        setLoadingPubs(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, post]);

  if (!post) return null;

  const update = async (
    fields: Partial<Pick<ScheduledPost, "status" | "retry_count">>,
    message: string
  ) => {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("scheduled_posts")
      .update(fields)
      .eq("id", post.id);
    setBusy(false);
    if (error) {
      toast.error("Erro ao atualizar o post: " + error.message);
      return;
    }
    toast.success(message);
    onChanged();
    onOpenChange(false);
  };

  const handleDelete = async () => {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("scheduled_posts")
      .delete()
      .eq("id", post.id);
    setBusy(false);
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
      return;
    }
    toast.success("Post excluído.");
    onChanged();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: platformColor(post.platform) }}
            />
            {post.title || "Post agendado"}
          </DialogTitle>
          <DialogDescription>
            {PLATFORM_LABELS[post.platform]} · {postTypeLabel(post)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(post.status)}>
              {STATUS_LABELS[post.status] ?? post.status}
            </Badge>
            <Badge variant="outline">
              {post.publish_method === "api" ? "Via API" : "Manual"}
            </Badge>
            {post.retry_count > 0 && (
              <Badge variant="warning">
                {post.retry_count} tentativa{post.retry_count > 1 ? "s" : ""}
              </Badge>
            )}
          </div>

          <div>
            <span className="font-medium">Data e hora: </span>
            {format(new Date(post.scheduled_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
              locale: ptBR,
            })}
          </div>

          {post.caption && (
            <div>
              <span className="font-medium">Legenda:</span>
              <p className="mt-1 whitespace-pre-wrap rounded-md bg-muted p-2 text-muted-foreground">
                {post.caption}
              </p>
            </div>
          )}

          {post.status === "failed" && post.error_message && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-destructive">
              <span className="font-medium">Erro: </span>
              {post.error_message}
            </div>
          )}

          <Separator />

          <div>
            <h4 className="mb-2 font-medium">Histórico de publicações</h4>
            {loadingPubs ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : publications.length === 0 ? (
              <p className="text-muted-foreground">
                Nenhuma tentativa de publicação registrada.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Executado em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {publications.map((pub) => (
                      <TableRow key={pub.id}>
                        <TableCell>
                          <Badge
                            variant={
                              pub.status === "failed" || pub.error_message
                                ? "destructive"
                                : "success"
                            }
                          >
                            {STATUS_LABELS[pub.status] ?? pub.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {pub.url ? (
                            <a
                              href={pub.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
                            >
                              Abrir
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(pub.executed_at), "dd/MM/yyyy HH:mm", {
                            locale: ptBR,
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2 sm:justify-start">
          {(post.status === "failed" || post.status === "cancelled") && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                void update(
                  { status: "pending", retry_count: 0 },
                  "Post recolocado na fila de publicação."
                )
              }
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Tentar novamente
            </Button>
          )}
          {(post.status === "pending" || post.status === "processing") && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                void update({ status: "cancelled" }, "Agendamento cancelado.")
              }
            >
              <XCircle className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              onOpenChange(false);
              onEdit(post);
            }}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={busy}
            onClick={() => void handleDelete()}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
