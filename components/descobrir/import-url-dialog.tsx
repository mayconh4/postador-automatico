"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { PLATFORMS } from "@/lib/constants";
import type { Platform } from "@/lib/types";
import { ProjectPicker } from "./project-picker";
import { Loader2 } from "lucide-react";

/** Deriva um título legível a partir da URL */
function titleFromUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const segments = url.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1] ?? "";
    const readable = decodeURIComponent(last)
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[-_+]+/g, " ")
      .trim();
    if (readable.length >= 3) {
      return readable.charAt(0).toUpperCase() + readable.slice(1);
    }
    return `Vídeo de ${url.hostname.replace(/^www\./, "")}`;
  } catch {
    return "Vídeo importado por URL";
  }
}

function guessPlatform(rawUrl: string): Platform | null {
  const u = rawUrl.toLowerCase();
  if (u.includes("instagram.")) return "instagram";
  if (u.includes("youtube.") || u.includes("youtu.be")) return "youtube";
  if (u.includes("tiktok.")) return "tiktok";
  if (u.includes("facebook.") || u.includes("fb.watch")) return "facebook";
  return null;
}

export function ImportUrlDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [projectId, setProjectId] = useState("");
  const [importing, setImporting] = useState(false);

  function handleUrlChange(value: string) {
    setUrl(value);
    const guessed = guessPlatform(value);
    if (guessed) setPlatform(guessed);
  }

  async function handleImport() {
    if (!url.trim()) {
      toast.error("Informe a URL do vídeo");
      return;
    }
    if (!projectId) {
      toast.error("Selecione um projeto para importar");
      return;
    }
    setImporting(true);
    const supabase = createClient();
    const { error } = await supabase.from("trend_imports").insert({
      project_id: projectId,
      platform,
      title: titleFromUrl(url.trim()),
      url: url.trim(),
      thumbnail_url: null,
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      engagement_rate: 0,
    });
    setImporting(false);
    if (error) {
      toast.error("Erro ao importar por URL");
      return;
    }
    toast.success("Vídeo importado por URL!");
    setUrl("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar por URL</DialogTitle>
          <DialogDescription>
            Cole o link de um vídeo do Instagram, YouTube, TikTok ou Facebook.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="import-url">URL do vídeo</Label>
          <Input
            id="import-url"
            placeholder="https://www.instagram.com/reel/..."
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Plataforma</Label>
          <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
            <SelectTrigger>
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

        <ProjectPicker value={projectId} onChange={setProjectId} />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={importing || !projectId || !url.trim()}>
            {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
