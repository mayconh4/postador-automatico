"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { PLATFORM_LABELS, STATUS_LABELS } from "@/lib/constants";
import type { Platform, ReferenceProfile } from "@/lib/types";
import { generateMockComments, generateMockPosts } from "./mock-scrape";
import { Eye, Loader2, RefreshCw, Trash2 } from "lucide-react";

const PLATFORM_GRADIENTS: Record<Platform, string> = {
  instagram: "from-purple-500 via-pink-500 to-orange-400",
  youtube: "from-red-500 to-red-700",
  tiktok: "from-zinc-700 via-zinc-900 to-black",
  facebook: "from-blue-500 to-blue-700",
};

const STATUS_VARIANTS: Record<
  ReferenceProfile["status"],
  "secondary" | "warning" | "success" | "destructive"
> = {
  pending: "secondary",
  scraping: "warning",
  completed: "success",
  failed: "destructive",
};

export function ProfileCard({
  profile,
  postCount,
  onChanged,
}: {
  profile: ReferenceProfile;
  postCount: number;
  onChanged: () => void;
}) {
  const [scraping, setScraping] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleScrape() {
    setScraping(true);
    const supabase = createClient();
    try {
      await supabase
        .from("references")
        .update({ status: "scraping", error_message: null })
        .eq("id", profile.id);

      let usedMock = false;
      try {
        const { error } = await supabase.functions.invoke(
          `scrape-${profile.platform}`,
          { body: { reference_id: profile.id } }
        );
        if (error) throw error;
      } catch {
        // Fallback dev: função edge não deployada — gera dados mock determinísticos
        usedMock = true;
        await runMockScrape(profile);
      }

      await supabase
        .from("references")
        .update({ status: "completed" })
        .eq("id", profile.id);

      toast.success(
        usedMock
          ? `Raspagem simulada (mock) de @${profile.username} concluída.`
          : `Raspagem real de @${profile.username} concluída.`
      );
      onChanged();
    } catch (e) {
      await supabase
        .from("references")
        .update({
          status: "failed",
          error_message: e instanceof Error ? e.message : "Erro na raspagem",
        })
        .eq("id", profile.id);
      toast.error("Falha na raspagem do perfil.");
      onChanged();
    } finally {
      setScraping(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("references")
        .delete()
        .eq("id", profile.id);
      if (error) throw error;
      toast.success(`Perfil @${profile.username} removido.`);
      onChanged();
    } catch {
      toast.error("Erro ao remover o perfil.");
    } finally {
      setDeleting(false);
    }
  }

  const initial = profile.username.charAt(0).toUpperCase();

  return (
    <Card className="flex flex-col">
      <CardContent className="flex-1 pt-6">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-lg font-bold text-white ${PLATFORM_GRADIENTS[profile.platform]}`}
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">@{profile.username}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline">{PLATFORM_LABELS[profile.platform]}</Badge>
              {profile.niche && (
                <Badge variant="secondary">{profile.niche}</Badge>
              )}
              <Badge variant={STATUS_VARIANTS[profile.status]}>
                {STATUS_LABELS[profile.status] ?? profile.status}
              </Badge>
            </div>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {postCount > 0
            ? `${postCount} post${postCount > 1 ? "s" : ""} raspado${postCount > 1 ? "s" : ""}`
            : "Nenhum post raspado ainda"}
        </p>
        {profile.status === "failed" && profile.error_message && (
          <p className="mt-1 truncate text-xs text-destructive">
            {profile.error_message}
          </p>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        <Button
          size="sm"
          onClick={() => void handleScrape()}
          disabled={scraping || profile.status === "scraping"}
        >
          {scraping ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Raspar
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href={`/referencia/${profile.id}`}>
            <Eye className="mr-2 h-4 w-4" />
            Ver análise
          </Link>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto text-muted-foreground hover:text-destructive"
          onClick={() => void handleDelete()}
          disabled={deleting}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}

/** Insere posts e comentários mock determinísticos para o perfil. */
export async function runMockScrape(profile: ReferenceProfile): Promise<void> {
  const supabase = createClient();

  // Limpa raspagens anteriores para não duplicar
  await supabase.from("scraped_posts").delete().eq("reference_id", profile.id);

  const posts = generateMockPosts(
    profile.id,
    profile.username,
    profile.platform,
    profile.niche
  );

  const { data: inserted, error } = await supabase
    .from("scraped_posts")
    .insert(posts.map((p) => ({ ...p, reference_id: profile.id })))
    .select("id, platform_post_id, engagement_rate");
  if (error) throw error;

  const rows = (inserted ?? []) as unknown as {
    id: string;
    platform_post_id: string | null;
    engagement_rate: number;
  }[];

  // Comentários apenas nos posts top (metade com maior engajamento)
  const topRows = [...rows]
    .sort((a, b) => Number(b.engagement_rate) - Number(a.engagement_rate))
    .slice(0, Math.max(3, Math.ceil(rows.length / 2)));

  const commentRows = topRows.flatMap((row) =>
    generateMockComments(`${profile.id}|${row.platform_post_id ?? row.id}`).map(
      (c) => ({ ...c, scraped_post_id: row.id })
    )
  );

  if (commentRows.length > 0) {
    const { error: cErr } = await supabase
      .from("scraped_comments")
      .insert(commentRows);
    if (cErr) throw cErr;
  }
}
