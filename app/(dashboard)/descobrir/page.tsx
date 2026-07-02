"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NICHES, PLATFORMS } from "@/lib/constants";
import { TRENDING_VIDEOS, type TrendingVideo } from "@/lib/mock/trending";
import { TrendingCard } from "@/components/descobrir/trending-card";
import { ImportDialog } from "@/components/descobrir/import-dialog";
import { ImportUrlDialog } from "@/components/descobrir/import-url-dialog";
import { Link2, SearchX } from "lucide-react";

type SortKey = "views" | "engagement" | "recent";

const ALL = "all";

export default function DescobrirPage() {
  const [platformTab, setPlatformTab] = useState<string>(ALL);
  const [niche, setNiche] = useState<string>(ALL);
  const [sort, setSort] = useState<SortKey>("views");
  const [search, setSearch] = useState("");

  const [importVideo, setImportVideo] = useState<TrendingVideo | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = TRENDING_VIDEOS.filter((v) => {
      if (platformTab !== ALL && v.platform !== platformTab) return false;
      if (niche !== ALL && v.niche !== niche) return false;
      if (
        term &&
        !v.title.toLowerCase().includes(term) &&
        !v.author.toLowerCase().includes(term)
      ) {
        return false;
      }
      return true;
    });
    return [...list].sort((a, b) => {
      if (sort === "views") return b.views - a.views;
      if (sort === "engagement") return b.engagementRate - a.engagementRate;
      return a.postedDaysAgo - b.postedDaysAgo;
    });
  }, [platformTab, niche, sort, search]);

  function handleImport(video: TrendingVideo) {
    setImportVideo(video);
    setImportOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Descobrir"
        description="Explore vídeos em alta nas redes e importe referências para seus projetos."
      >
        <Button onClick={() => setUrlDialogOpen(true)}>
          <Link2 className="mr-2 h-4 w-4" />
          Importar por URL
        </Button>
      </PageHeader>

      <Tabs value={platformTab} onValueChange={setPlatformTab} className="mb-4">
        <TabsList>
          <TabsTrigger value={ALL}>Todas</TabsTrigger>
          {PLATFORMS.map((p) => (
            <TabsTrigger key={p.id} value={p.id}>
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Buscar por título ou autor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={niche} onValueChange={setNiche}>
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="Nicho" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os nichos</SelectItem>
            {NICHES.map((n) => (
              <SelectItem key={n} value={n}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="views">Mais visualizações</SelectItem>
            <SelectItem value="engagement">Maior engajamento</SelectItem>
            <SelectItem value="recent">Mais recentes</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground sm:ml-auto">
          {filtered.length} {filtered.length === 1 ? "vídeo" : "vídeos"}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <SearchX className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-lg font-medium">Nenhum vídeo encontrado</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Tente ajustar a busca, o nicho ou a plataforma. Você também pode
            importar um vídeo diretamente pelo link.
          </p>
          <Button className="mt-4" variant="outline" onClick={() => setUrlDialogOpen(true)}>
            <Link2 className="mr-2 h-4 w-4" />
            Importar por URL
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((video) => (
            <TrendingCard key={video.id} video={video} onImport={handleImport} />
          ))}
        </div>
      )}

      <ImportDialog video={importVideo} open={importOpen} onOpenChange={setImportOpen} />
      <ImportUrlDialog open={urlDialogOpen} onOpenChange={setUrlDialogOpen} />
    </div>
  );
}
