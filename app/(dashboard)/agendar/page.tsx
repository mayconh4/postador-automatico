"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addMonths,
  addWeeks,
  endOfWeek,
  format,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarView,
  type CalendarViewMode,
} from "@/components/agendar/calendar-view";
import { NewPostDialog } from "@/components/agendar/new-post-dialog";
import { PostDetailsDialog } from "@/components/agendar/post-details-dialog";
import { AnalyticsTab } from "@/components/agendar/analytics-tab";
import {
  PLATFORMS,
  POST_TYPES_BY_PLATFORM,
  STATUS_LABELS,
} from "@/lib/constants";
import type { Platform, ScheduledPost } from "@/lib/types";
import {
  BarChart3,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const ALL = "__all__";
const STATUS_OPTIONS = [
  "pending",
  "processing",
  "published",
  "failed",
  "cancelled",
] as const;

const ALL_POST_TYPES = Array.from(
  new Map(
    (Object.keys(POST_TYPES_BY_PLATFORM) as Platform[]).flatMap((p) =>
      POST_TYPES_BY_PLATFORM[p].map((t) => [t.id, t] as const)
    )
  ).values()
);

export default function AgendarPage() {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [view, setView] = useState<CalendarViewMode>("month");

  const [filterPlatform, setFilterPlatform] = useState(ALL);
  const [filterType, setFilterType] = useState(ALL);
  const [filterStatus, setFilterStatus] = useState(ALL);

  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [newPostOpen, setNewPostOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<ScheduledPost | null>(null);
  const [newPostDate, setNewPostDate] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("scheduled_posts")
      .select("*")
      .order("scheduled_at", { ascending: true });
    if (error) {
      toast.error("Erro ao carregar agendamentos: " + error.message);
    } else {
      setPosts((data ?? []) as unknown as ScheduledPost[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredPosts = useMemo(
    () =>
      posts.filter(
        (p) =>
          (filterPlatform === ALL || p.platform === filterPlatform) &&
          (filterType === ALL || p.post_type === filterType) &&
          (filterStatus === ALL || p.status === filterStatus)
      ),
    [posts, filterPlatform, filterType, filterStatus]
  );

  const periodLabel = useMemo(() => {
    if (view === "week") {
      const start = startOfWeek(currentDate, { locale: ptBR });
      const end = endOfWeek(currentDate, { locale: ptBR });
      return `${format(start, "dd MMM", { locale: ptBR })} – ${format(end, "dd MMM yyyy", { locale: ptBR })}`;
    }
    const label = format(currentDate, "MMMM yyyy", { locale: ptBR });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [currentDate, view]);

  const navigate = (dir: -1 | 1) => {
    setCurrentDate((d) =>
      view === "week"
        ? dir === 1
          ? addWeeks(d, 1)
          : subWeeks(d, 1)
        : dir === 1
          ? addMonths(d, 1)
          : subMonths(d, 1)
    );
  };

  const handleDropPost = async (postId: string, day: Date) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const old = new Date(post.scheduled_at);
    const next = new Date(day);
    next.setHours(old.getHours(), old.getMinutes(), 0, 0);
    if (next.getTime() === old.getTime()) return;

    // Atualização otimista
    const nextIso = next.toISOString();
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, scheduled_at: nextIso } : p))
    );

    const supabase = createClient();
    const { error } = await supabase
      .from("scheduled_posts")
      .update({ scheduled_at: nextIso })
      .eq("id", postId);
    if (error) {
      toast.error("Erro ao mover o post: " + error.message);
      void load();
      return;
    }
    toast.success(
      `Post movido para ${format(next, "dd/MM 'às' HH:mm", { locale: ptBR })}.`
    );
  };

  const openNewPost = (date?: Date | null) => {
    setEditingPost(null);
    setNewPostDate(date ?? null);
    setNewPostOpen(true);
  };

  const openEditPost = (post: ScheduledPost) => {
    setEditingPost(post);
    setNewPostDate(null);
    setNewPostOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Agendar"
        description="Calendário de publicações e desempenho dos seus posts."
      >
        <Button onClick={() => openNewPost()}>
          <CalendarPlus className="mr-2 h-4 w-4" />
          Novo post
        </Button>
      </PageHeader>

      <Tabs defaultValue="calendario">
        <TabsList>
          <TabsTrigger value="calendario">
            <CalendarDays className="mr-2 h-4 w-4" />
            Calendário
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="mr-2 h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendario" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigate(-1)}
                aria-label="Período anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigate(1)}
                aria-label="Próximo período"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(new Date())}
              >
                Hoje
              </Button>
            </div>
            <span className="min-w-[180px] text-sm font-semibold">
              {periodLabel}
            </span>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                <SelectTrigger className="h-9 w-[140px]">
                  <SelectValue placeholder="Plataforma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas plataformas</SelectItem>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-9 w-[130px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos os tipos</SelectItem>
                  {ALL_POST_TYPES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9 w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos os status</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s] ?? s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex overflow-hidden rounded-md border">
                <Button
                  variant={view === "month" ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-none"
                  onClick={() => setView("month")}
                >
                  Mês
                </Button>
                <Button
                  variant={view === "week" ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-none"
                  onClick={() => setView("week")}
                >
                  Semana
                </Button>
              </div>
            </div>
          </div>

          {loading ? (
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: 35 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <CalendarView
                  currentDate={currentDate}
                  view={view}
                  posts={filteredPosts}
                  onChipClick={(post) => {
                    setSelectedPost(post);
                    setDetailsOpen(true);
                  }}
                  onDropPost={(postId, day) => void handleDropPost(postId, day)}
                  onDayClick={(day) => openNewPost(day)}
                />
              </CardContent>
            </Card>
          )}

          {!loading && posts.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-white">
                  <CalendarDays className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">
                  Nenhum post agendado
                </h3>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Agende seu primeiro post e deixe a publicação acontecer no
                  piloto automático. Dica: clique em um dia do calendário para
                  agendar direto naquela data.
                </p>
                <Button className="mt-6" onClick={() => openNewPost()}>
                  <CalendarPlus className="mr-2 h-4 w-4" />
                  Agendar primeiro post
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <AnalyticsTab posts={posts} loading={loading} />
        </TabsContent>
      </Tabs>

      <PostDetailsDialog
        post={selectedPost}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onChanged={() => void load()}
        onEdit={openEditPost}
      />

      <NewPostDialog
        open={newPostOpen}
        onOpenChange={setNewPostOpen}
        onSaved={() => void load()}
        editingPost={editingPost}
        defaultDate={newPostDate}
        allPosts={posts}
      />
    </div>
  );
}
