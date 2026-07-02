"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AddProfileDialog } from "@/components/referencia/add-profile-dialog";
import { ProfileCard } from "@/components/referencia/profile-card";
import type { ReferenceProfile } from "@/lib/types";
import { Plus, Telescope } from "lucide-react";

export default function ReferenciaPage() {
  const [profiles, setProfiles] = useState<ReferenceProfile[]>([]);
  const [postCounts, setPostCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("references")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) {
      const list = (data ?? []) as unknown as ReferenceProfile[];
      setProfiles(list);

      if (list.length > 0) {
        const { data: posts } = await supabase
          .from("scraped_posts")
          .select("reference_id")
          .in(
            "reference_id",
            list.map((p) => p.id)
          );
        const counts: Record<string, number> = {};
        for (const row of (posts ?? []) as unknown as {
          reference_id: string;
        }[]) {
          counts[row.reference_id] = (counts[row.reference_id] ?? 0) + 1;
        }
        setPostCounts(counts);
      } else {
        setPostCounts({});
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Referência"
        description="Espione perfis de sucesso, raspe dados de posts e descubra padrões virais do seu nicho."
      >
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar perfil
        </Button>
      </PageHeader>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                </div>
                <Skeleton className="mt-4 h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white">
              <Telescope className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">
              Nenhum perfil de referência ainda
            </h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Adicione perfis que fazem sucesso no seu nicho para analisar os
              vídeos, copys e comentários que mais engajam.
            </p>
            <Button className="mt-6" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar primeiro perfil
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              postCount={postCounts[profile.id] ?? 0}
              onChanged={() => void load()}
            />
          ))}
        </div>
      )}

      <AddProfileDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => void load()}
      />
    </div>
  );
}
