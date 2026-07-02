"use client";

import { format } from "date-fns";
import { PLATFORMS, POST_TYPES_BY_PLATFORM } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ScheduledPost } from "@/lib/types";

export function platformColor(platform: ScheduledPost["platform"]): string {
  return PLATFORMS.find((p) => p.id === platform)?.color ?? "#888888";
}

export function postTypeLabel(post: ScheduledPost): string {
  return (
    POST_TYPES_BY_PLATFORM[post.platform]?.find((t) => t.id === post.post_type)
      ?.label ?? post.post_type
  );
}

export function PostChip({
  post,
  onClick,
}: {
  post: ScheduledPost;
  onClick: (post: ScheduledPost) => void;
}) {
  const color = platformColor(post.platform);
  const time = format(new Date(post.scheduled_at), "HH:mm");
  const isFinal =
    post.status === "published" ||
    post.status === "cancelled" ||
    post.status === "failed";

  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", post.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick(post);
      }}
      title={post.title || post.caption || postTypeLabel(post)}
      className={cn(
        "flex w-full cursor-grab items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-white transition-opacity hover:opacity-90 active:cursor-grabbing",
        post.status === "cancelled" && "line-through opacity-60",
        post.status === "failed" && "ring-1 ring-red-300"
      )}
      style={{ backgroundColor: color }}
    >
      <span className="shrink-0 tabular-nums">{time}</span>
      <span className="truncate">{postTypeLabel(post)}</span>
      {isFinal && post.status === "published" && (
        <span className="ml-auto shrink-0">✓</span>
      )}
    </button>
  );
}
