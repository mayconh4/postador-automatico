"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { PostChip } from "@/components/agendar/post-chip";
import type { ScheduledPost } from "@/lib/types";

const MAX_CHIPS = 3;

export type CalendarViewMode = "month" | "week";

export function CalendarView({
  currentDate,
  view,
  posts,
  onChipClick,
  onDropPost,
  onDayClick,
}: {
  currentDate: Date;
  view: CalendarViewMode;
  posts: ScheduledPost[];
  onChipClick: (post: ScheduledPost) => void;
  onDropPost: (postId: string, day: Date) => void;
  onDayClick: (day: Date) => void;
}) {
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  const days = useMemo(() => {
    if (view === "week") {
      const start = startOfWeek(currentDate, { locale: ptBR });
      return eachDayOfInterval({ start, end: addDays(start, 6) });
    }
    const start = startOfWeek(startOfMonth(currentDate), { locale: ptBR });
    const end = endOfWeek(endOfMonth(currentDate), { locale: ptBR });
    return eachDayOfInterval({ start, end });
  }, [currentDate, view]);

  const weekdayLabels = useMemo(() => {
    const start = startOfWeek(new Date(), { locale: ptBR });
    return Array.from({ length: 7 }).map((_, i) =>
      format(addDays(start, i), "EEEEEE", { locale: ptBR })
    );
  }, []);

  const postsByDay = useMemo(() => {
    const map = new Map<string, ScheduledPost[]>();
    for (const post of posts) {
      const key = format(new Date(post.scheduled_at), "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(post);
      map.set(key, list);
    }
    for (const list of Array.from(map.values())) {
      list.sort(
        (a, b) =>
          new Date(a.scheduled_at).getTime() -
          new Date(b.scheduled_at).getTime()
      );
    }
    return map;
  }, [posts]);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-7 border-b text-center">
          {weekdayLabels.map((label) => (
            <div
              key={label}
              className="py-2 text-xs font-medium uppercase text-muted-foreground"
            >
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayPosts = postsByDay.get(key) ?? [];
            const visible = dayPosts.slice(0, MAX_CHIPS);
            const overflow = dayPosts.length - visible.length;
            const outsideMonth =
              view === "month" && !isSameMonth(day, currentDate);

            return (
              <div
                key={key}
                onClick={() => onDayClick(day)}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragOverDay(key);
                }}
                onDragLeave={() => {
                  setDragOverDay((cur) => (cur === key ? null : cur));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverDay(null);
                  const postId = e.dataTransfer.getData("text/plain");
                  if (postId) onDropPost(postId, day);
                }}
                className={cn(
                  "flex cursor-pointer flex-col gap-1 border-b border-r p-1.5 transition-colors hover:bg-muted/50",
                  view === "week" ? "min-h-[220px]" : "min-h-[110px]",
                  outsideMonth && "bg-muted/30 text-muted-foreground",
                  dragOverDay === key && "bg-primary/10 ring-1 ring-inset ring-primary"
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                      isToday(day) && "bg-primary text-primary-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {dayPosts.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {dayPosts.length}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  {visible.map((post) => (
                    <PostChip key={post.id} post={post} onClick={onChipClick} />
                  ))}
                  {overflow > 0 && (
                    <span className="px-1 text-[11px] font-medium text-muted-foreground">
                      +{overflow}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
