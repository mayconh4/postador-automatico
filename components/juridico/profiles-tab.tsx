"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ExternalLink, Loader2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { PLATFORMS, PLATFORM_LABELS, STATUS_LABELS } from "@/lib/constants";
import type { LegalCase, Platform, ReferenceProfile } from "@/lib/types";

const PROFILE_URL_BY_PLATFORM: Record<Platform, (u: string) => string> = {
  instagram: (u) => `https://instagram.com/${u}`,
  youtube: (u) => `https://youtube.com/@${u}`,
  tiktok: (u) => `https://tiktok.com/@${u}`,
  facebook: (u) => `https://facebook.com/${u}`,
};

export function ProfilesTab({ legalCase }: { legalCase: LegalCase }) {
  const [profiles, setProfiles] = useState<ReferenceProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [handles, setHandles] = useState("");
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("references")
      .select("*")
      .eq("niche", "Jurídico")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar perfis: " + error.message);
    } else {
      setProfiles((data ?? []) as unknown as ReferenceProfile[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function bulkImport() {
    const parsed = Array.from(
      new Set(
        handles
          .split("\n")
          .map((l) => l.trim().replace(/^@/, ""))
          .filter((l) => /^[a-zA-Z0-9._-]{2,60}$/.test(l))
      )
    );
    if (parsed.length === 0) {
      toast.error("Nenhum @ válido encontrado — um por linha.");
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sessão expirada — faça login novamente.");
      return;
    }

    setImporting(true);
    const existing = new Set(
      profiles
        .filter((p) => p.platform === platform)
        .map((p) => p.username.toLowerCase())
    );
    const fresh = parsed.filter((h) => !existing.has(h.toLowerCase()));
    const skipped = parsed.length - fresh.length;

    if (fresh.length > 0) {
      const { error } = await supabase.from("references").insert(
        fresh.map((username) => ({
          user_id: user.id,
          project_id: legalCase.project_id,
          platform,
          username,
          profile_url: PROFILE_URL_BY_PLATFORM[platform](username),
          niche: "Jurídico",
          status: "pending",
        }))
      );
      if (error) {
        toast.error("Erro na importação: " + error.message);
        setImporting(false);
        return;
      }
    }

    toast.success(
      `${fresh.length} perfil(is) importado(s)` +
        (skipped > 0 ? ` — ${skipped} já existia(m)` : "")
    );
    setHandles("");
    setImporting(false);
    void load();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Importação em massa</CardTitle>
          <CardDescription>
            Cole os @ dos perfis jurídicos de referência — um por linha. Eles vão
            para a aba Referência, onde você pode raspar posts e gerar insights.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Plataforma</Label>
            <Select
              value={platform}
              onValueChange={(v) => setPlatform(v as Platform)}
            >
              <SelectTrigger className="sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Perfis (um @ por linha)</Label>
            <Textarea
              value={handles}
              onChange={(e) => setHandles(e.target.value)}
              rows={8}
              placeholder={"@advogadotrabalhista\n@dra.direitodofamilia\n@consumidor.legal"}
            />
          </div>
          <Button
            onClick={() => void bulkImport()}
            disabled={importing || !handles.trim()}
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Importando…
              </>
            ) : (
              "Importar perfis"
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Perfis jurídicos importados</CardTitle>
          <CardDescription>
            {profiles.length} perfil(is) no nicho Jurídico.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-md" />
              ))}
            </div>
          ) : profiles.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
              <Users className="h-8 w-8" />
              Nenhum perfil ainda — importe ao lado.
            </div>
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {profiles.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-md border p-2.5"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {p.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">@{p.username}</p>
                    <p className="text-xs text-muted-foreground">
                      {PLATFORM_LABELS[p.platform]}
                    </p>
                  </div>
                  <Badge
                    variant={p.status === "completed" ? "success" : "secondary"}
                  >
                    {STATUS_LABELS[p.status] ?? p.status}
                  </Badge>
                  <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                    <Link href={`/referencia/${p.id}`} title="Abrir na Referência">
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
