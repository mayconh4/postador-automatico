"use client";

import { useMemo } from "react";
import { format, isAfter, subDays } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PLATFORMS, STATUS_LABELS } from "@/lib/constants";
import { formatSlot, suggestBestTimes } from "@/components/agendar/best-times";
import type { ScheduledPost } from "@/lib/types";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Percent,
  XCircle,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  pending: "#94a3b8",
  processing: "#f59e0b",
  published: "#22c55e",
  failed: "#ef4444",
  cancelled: "#64748b",
};

function SummaryCard({
  title,
  value,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-6">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white ${accent}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function AnalyticsTab({
  posts,
  loading,
}: {
  posts: ScheduledPost[];
  loading: boolean;
}) {
  const stats = useMemo(() => {
    const published = posts.filter((p) => p.status === "published").length;
    const failed = posts.filter((p) => p.status === "failed").length;
    const attempts = published + failed;
    return {
      total: posts.length,
      published,
      failed,
      successRate: attempts > 0 ? Math.round((published / attempts) * 100) : null,
    };
  }, [posts]);

  const byPlatform = useMemo(
    () =>
      PLATFORMS.map((p) => ({
        name: p.label,
        total: posts.filter((post) => post.platform === p.id).length,
        color: p.color,
      })),
    [posts]
  );

  const byStatus = useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of posts) {
      counts.set(post.status, (counts.get(post.status) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([status, value]) => ({
      name: STATUS_LABELS[status] ?? status,
      value,
      color: STATUS_COLORS[status] ?? "#a1a1aa",
    }));
  }, [posts]);

  const publishedPerDay = useMemo(() => {
    const start = subDays(new Date(), 29);
    const days: { date: string; label: string; total: number }[] = [];
    for (let i = 0; i < 30; i++) {
      const d = subDays(new Date(), 29 - i);
      days.push({
        date: format(d, "yyyy-MM-dd"),
        label: format(d, "dd/MM"),
        total: 0,
      });
    }
    const index = new Map(days.map((d) => [d.date, d]));
    for (const post of posts) {
      if (post.status !== "published") continue;
      const d = new Date(post.scheduled_at);
      if (!isAfter(d, start)) continue;
      const key = format(d, "yyyy-MM-dd");
      const entry = index.get(key);
      if (entry) entry.total += 1;
    }
    return days;
  }, [posts]);

  const bestByPlatform = useMemo(
    () =>
      PLATFORMS.map((p) => ({
        platform: p,
        slots: suggestBestTimes(posts, p.id),
        hasData: posts.some(
          (post) => post.platform === p.id && post.status === "published"
        ),
      })),
    [posts]
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Total agendados"
          value={String(stats.total)}
          icon={CalendarClock}
          accent="bg-blue-500"
        />
        <SummaryCard
          title="Publicados"
          value={String(stats.published)}
          icon={CheckCircle2}
          accent="bg-green-500"
        />
        <SummaryCard
          title="Falhas"
          value={String(stats.failed)}
          icon={XCircle}
          accent="bg-red-500"
        />
        <SummaryCard
          title="Taxa de sucesso"
          value={stats.successRate === null ? "—" : `${stats.successRate}%`}
          icon={Percent}
          accent="bg-purple-500"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Posts por plataforma</CardTitle>
            <CardDescription>
              Todos os agendamentos, por rede social
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byPlatform}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={12} tickLine={false} />
                <YAxis allowDecimals={false} fontSize={12} width={30} />
                <Tooltip
                  formatter={(value) => [String(value), "Posts"]}
                  cursor={{ fill: "rgba(0,0,0,0.05)" }}
                />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {byPlatform.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por status</CardTitle>
            <CardDescription>Situação atual dos agendamentos</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {byStatus.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Sem dados ainda.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byStatus}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    label={(entry) => `${entry.name} (${entry.value})`}
                    fontSize={11}
                  >
                    {byStatus.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Posts publicados por dia (últimos 30 dias)
          </CardTitle>
          <CardDescription>
            Evolução diária das publicações concluídas
          </CardDescription>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={publishedPerDay}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                fontSize={11}
                tickLine={false}
                interval={4}
              />
              <YAxis allowDecimals={false} fontSize={12} width={30} />
              <Tooltip
                formatter={(value) => [String(value), "Publicados"]}
                labelFormatter={(label) => `Dia ${label}`}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Melhores horários para postar
          </CardTitle>
          <CardDescription>
            Baseado nos seus posts publicados com sucesso. Sem histórico,
            usamos horários recomendados para cada plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {bestByPlatform.map(({ platform, slots, hasData }) => (
              <div key={platform.id} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: platform.color }}
                  />
                  <span className="text-sm font-medium">{platform.label}</span>
                  {!hasData && (
                    <Badge variant="outline" className="ml-auto text-[10px]">
                      Padrão
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {slots.map((slot) => (
                    <Badge
                      key={`${slot.weekday}-${slot.hour}`}
                      variant="secondary"
                    >
                      {formatSlot(slot)}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
