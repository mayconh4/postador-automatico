"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InsightsTab } from "@/components/referencia/insights-tab";
import { NotesTab } from "@/components/referencia/notes-tab";
import { PLATFORM_LABELS, STATUS_LABELS } from "@/lib/constants";
import { formatNumber } from "@/lib/utils";
import type {
  Platform,
  ReferenceInsights,
  ReferenceProfile,
  ScrapedComment,
  ScrapedPost,
} from "@/lib/types";
import {
  ArrowLeft,
  Copy,
  Frown,
  Meh,
  MessageCircle,
  Smile,
  ThumbsUp,
} from "lucide-react";

const PLATFORM_GRADIENTS: Record<Platform, string> = {
  instagram: "from-purple-500 via-pink-500 to-orange-400",
  youtube: "from-red-500 to-red-700",
  tiktok: "from-zinc-700 via-zinc-900 to-black",
  facebook: "from-blue-500 to-blue-700",
};

function erBadgeVariant(er: number): "success" | "warning" | "secondary" {
  if (er >= 8) return "success";
  if (er >= 4) return "warning";
  return "secondary";
}

const SENTIMENT_META: Record<
  string,
  { label: string; variant: "success" | "destructive" | "secondary"; Icon: typeof Smile }
> = {
  positive: { label: "Positivo", variant: "success", Icon: Smile },
  negative: { label: "Negativo", variant: "destructive", Icon: Frown },
  neutral: { label: "Neutro", variant: "secondary", Icon: Meh },
};

export default function ReferenciaDetalhePage() {
  const params = useParams<{ id: string }>();
  const referenceId = params.id;

  const [profile, setProfile] = useState<ReferenceProfile | null>(null);
  const [posts, setPosts] = useState<ScrapedPost[]>([]);
  const [comments, setComments] = useState<ScrapedComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: ref } = await supabase
      .from("references")
      .select("*")
      .eq("id", referenceId)
      .maybeSingle();

    if (!ref) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setProfile(ref as unknown as ReferenceProfile);

    const { data: postRows } = await supabase
      .from("scraped_posts")
      .select("*")
      .eq("reference_id", referenceId)
      .order("engagement_rate", { ascending: false });
    const postList = (postRows ?? []) as unknown as ScrapedPost[];
    setPosts(postList);

    if (postList.length > 0) {
      const { data: commentRows } = await supabase
        .from("scraped_comments")
        .select("*")
        .in(
          "scraped_post_id",
          postList.map((p) => p.id)
        )
        .order("likes", { ascending: false });
      setComments((commentRows ?? []) as unknown as ScrapedComment[]);
    } else {
      setComments([]);
    }
    setLoading(false);
  }, [referenceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const topCopys = useMemo(
    () =>
      posts
        .filter((p) => (p.caption ?? "").trim().length > 0)
        .slice(0, 8),
    [posts]
  );

  function copyCaption(caption: string) {
    void navigator.clipboard.writeText(caption);
    toast.success("Copy copiada para a área de transferência!");
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-16 text-center">
          <h3 className="text-lg font-semibold">Perfil não encontrado</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Esse perfil de referência não existe ou foi removido.
          </p>
          <Button className="mt-6" asChild>
            <Link href="/referencia">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para Referência
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" asChild>
        <Link href="/referencia">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Link>
      </Button>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-2xl font-bold text-white ${PLATFORM_GRADIENTS[profile.platform]}`}
          >
            {profile.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              @{profile.username}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline">
                {PLATFORM_LABELS[profile.platform]}
              </Badge>
              {profile.niche && (
                <Badge variant="secondary">{profile.niche}</Badge>
              )}
              <Badge
                variant={
                  profile.status === "completed"
                    ? "success"
                    : profile.status === "failed"
                      ? "destructive"
                      : "secondary"
                }
              >
                {STATUS_LABELS[profile.status] ?? profile.status}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {posts.length} posts raspados
              </span>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="videos">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="videos">Top Vídeos</TabsTrigger>
          <TabsTrigger value="copys">Top Copys</TabsTrigger>
          <TabsTrigger value="comentarios">Comentários</TabsTrigger>
          <TabsTrigger value="insights">Insights IA</TabsTrigger>
          <TabsTrigger value="notas">Notas</TabsTrigger>
        </TabsList>

        <TabsContent value="videos">
          {posts.length === 0 ? (
            <EmptyScrape />
          ) : (
            <Card>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead className="text-right">Views</TableHead>
                      <TableHead className="text-right">Likes</TableHead>
                      <TableHead className="text-right">Comentários</TableHead>
                      <TableHead className="text-right">ER%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {posts.map((p, i) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium text-muted-foreground">
                          {i + 1}º
                        </TableCell>
                        <TableCell className="max-w-[320px]">
                          <p className="truncate font-medium">
                            {p.title ?? "Sem título"}
                          </p>
                          {p.post_type && (
                            <p className="text-xs text-muted-foreground">
                              {p.post_type}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(p.views)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(p.likes)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(p.comments)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={erBadgeVariant(Number(p.engagement_rate))}>
                            {Number(p.engagement_rate).toFixed(2)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="copys">
          {topCopys.length === 0 ? (
            <EmptyScrape />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {topCopys.map((p, i) => (
                <Card key={p.id}>
                  <CardContent className="pt-6">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{i + 1}º</Badge>
                        <Badge variant={erBadgeVariant(Number(p.engagement_rate))}>
                          ER {Number(p.engagement_rate).toFixed(2)}%
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyCaption(p.caption ?? "")}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copiar
                      </Button>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {p.caption}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="comentarios">
          {comments.length === 0 ? (
            <EmptyScrape message="Nenhum comentário raspado ainda." />
          ) : (
            <div className="space-y-3">
              {comments.map((c) => {
                const meta = SENTIMENT_META[c.sentiment ?? "neutral"] ?? SENTIMENT_META.neutral;
                return (
                  <Card key={c.id}>
                    <CardContent className="flex items-start justify-between gap-3 pt-6">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{c.text}</p>
                        <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <ThumbsUp className="h-3 w-3" />
                          {formatNumber(c.likes)} curtidas
                        </p>
                      </div>
                      <Badge variant={meta.variant} className="shrink-0">
                        <meta.Icon className="mr-1 h-3 w-3" />
                        {meta.label}
                      </Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="insights">
          <InsightsTab
            profile={profile}
            posts={posts}
            comments={comments}
            onInsightsSaved={(insights: ReferenceInsights) =>
              setProfile((prev) =>
                prev ? { ...prev, insights_json: insights } : prev
              )
            }
          />
        </TabsContent>

        <TabsContent value="notas">
          <NotesTab referenceId={profile.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyScrape({ message }: { message?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center py-12 text-center">
        <MessageCircle className="h-10 w-10 text-muted-foreground/50" />
        <p className="mt-3 text-sm text-muted-foreground">
          {message ??
            "Nenhum post raspado ainda. Volte à lista e clique em \"Raspar\"."}
        </p>
        <Button className="mt-4" variant="outline" asChild>
          <Link href="/referencia">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para a lista
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
