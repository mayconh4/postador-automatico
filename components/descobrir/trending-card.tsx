"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatDuration, formatNumber } from "@/lib/utils";
import { PLATFORM_LABELS } from "@/lib/constants";
import type { TrendingVideo } from "@/lib/mock/trending";
import {
  Download,
  Eye,
  Heart,
  MessageCircle,
  Play,
  Share2,
  TrendingUp,
} from "lucide-react";

const PLATFORM_BADGE_CLASS: Record<TrendingVideo["platform"], string> = {
  instagram: "bg-pink-500 text-white hover:bg-pink-500",
  youtube: "bg-red-500 text-white hover:bg-red-500",
  tiktok: "bg-zinc-900 text-white hover:bg-zinc-900",
  facebook: "bg-blue-500 text-white hover:bg-blue-500",
};

export function TrendingCard({
  video,
  onImport,
}: {
  video: TrendingVideo;
  onImport: (video: TrendingVideo) => void;
}) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-lg border bg-card shadow-sm transition-shadow hover:shadow-md">
      {/* Thumbnail fake 9:16 */}
      <div className={cn("relative aspect-[9/16] w-full", video.gradient)}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-black/30 p-3 opacity-0 transition-opacity group-hover:opacity-100">
            <Play className="h-6 w-6 fill-white text-white" />
          </div>
        </div>
        <Badge
          className={cn(
            "absolute left-2 top-2 border-0",
            PLATFORM_BADGE_CLASS[video.platform]
          )}
        >
          {PLATFORM_LABELS[video.platform]}
        </Badge>
        <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-xs font-medium text-white">
          {formatDuration(video.durationSeconds)}
        </span>
        <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-xs font-medium text-white">
          <TrendingUp className="h-3 w-3" />
          {video.engagementRate.toFixed(1).replace(".", ",")}%
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-2 text-sm font-medium leading-snug" title={video.title}>
          {video.title}
        </p>
        <p className="text-xs text-muted-foreground">{video.author}</p>

        <div className="mt-auto grid grid-cols-4 gap-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1" title="Visualizações">
            <Eye className="h-3.5 w-3.5" />
            {formatNumber(video.views)}
          </span>
          <span className="flex items-center gap-1" title="Curtidas">
            <Heart className="h-3.5 w-3.5" />
            {formatNumber(video.likes)}
          </span>
          <span className="flex items-center gap-1" title="Comentários">
            <MessageCircle className="h-3.5 w-3.5" />
            {formatNumber(video.comments)}
          </span>
          <span className="flex items-center gap-1" title="Compartilhamentos">
            <Share2 className="h-3.5 w-3.5" />
            {formatNumber(video.shares)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <Badge variant="outline" className="text-xs font-normal">
            {video.niche}
          </Badge>
          <Button size="sm" onClick={() => onImport(video)}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Importar
          </Button>
        </div>
      </div>
    </div>
  );
}
