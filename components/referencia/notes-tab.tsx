"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { ReferenceNote } from "@/lib/types";
import { Loader2, NotebookPen, Plus, Trash2 } from "lucide-react";

export function NotesTab({ referenceId }: { referenceId: string }) {
  const [notes, setNotes] = useState<ReferenceNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("reference_notes")
      .select("*")
      .eq("reference_id", referenceId)
      .order("created_at", { ascending: false });
    setNotes((data ?? []) as unknown as ReferenceNote[]);
    setLoading(false);
  }, [referenceId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAdd() {
    const note = text.trim();
    if (!note) {
      toast.error("Escreva a nota antes de salvar.");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("reference_notes")
        .insert({ reference_id: referenceId, note });
      if (error) throw error;
      setText("");
      toast.success("Nota adicionada!");
      void load();
    } catch {
      toast.error("Erro ao salvar a nota.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("reference_notes")
        .delete()
        .eq("id", id);
      if (error) throw error;
      setNotes((prev) => prev.filter((n) => n.id !== id));
      toast.success("Nota excluída.");
    } catch {
      toast.error("Erro ao excluir a nota.");
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-6">
          <Textarea
            placeholder="Anote aprendizados sobre esse perfil: padrões, ideias de conteúdo, o que replicar..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end">
            <Button onClick={() => void handleAdd()} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Adicionar nota
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <NotebookPen className="h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhuma nota ainda. Registre suas observações sobre esse perfil.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <Card key={n.id}>
              <CardContent className="flex items-start justify-between gap-3 pt-6">
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap text-sm">{n.note}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {format(new Date(n.created_at), "d 'de' MMMM 'de' yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => void handleDelete(n.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
