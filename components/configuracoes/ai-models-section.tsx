"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AI_MODELS } from "@/lib/constants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const STORAGE_KEY = "pa:default-model";
const FALLBACK_MODEL = AI_MODELS[0].id;

export function AiModelsSection() {
  const [model, setModel] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const valid = AI_MODELS.some((m) => m.id === stored);
      setModel(valid && stored ? stored : FALLBACK_MODEL);
    } catch {
      setModel(FALLBACK_MODEL);
    }
  }, []);

  const handleChange = (value: string) => {
    setModel(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // localStorage indisponível — mantém apenas em memória
    }
    const label = AI_MODELS.find((m) => m.id === value)?.label ?? value;
    toast.success(`Modelo padrão alterado para ${label}.`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Modelos de IA
        </CardTitle>
        <CardDescription>
          Escolha o modelo de IA padrão usado na plataforma.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="default-model">Modelo padrão</Label>
          {model === null ? (
            <Skeleton className="h-10 w-full max-w-sm" />
          ) : (
            <Select value={model} onValueChange={handleChange}>
              <SelectTrigger id="default-model" className="max-w-sm">
                <SelectValue placeholder="Selecione um modelo" />
              </SelectTrigger>
              <SelectContent>
                {AI_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}{" "}
                    <span className="text-muted-foreground">
                      · {m.provider}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Este modelo é usado como padrão na geração de roteiros, nos insights
          de perfis de referência e no módulo jurídico. Você pode trocar o
          modelo pontualmente em cada geração.
        </p>
      </CardContent>
    </Card>
  );
}
