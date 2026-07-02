"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { AI_MODELS } from "@/lib/constants";
import type { Roteiro } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Check,
  Copy,
  Loader2,
  Megaphone,
  MessageSquareText,
  RefreshCw,
  Sparkles,
  Zap,
} from "lucide-react";

const TONS = ["Educativo", "Polêmico", "Storytelling", "Urgente", "Humor"];
const DURACOES = ["30s", "60s", "90s"];

interface RoteiroGeneratorProps {
  /** contexto opcional enviado ao prompt (ex.: nicho do projeto) */
  contexto?: string;
}

interface HistoricoItem {
  roteiro: Roteiro;
  tema: string;
  tom: string;
  duracao: string;
  source: string;
  geradoEm: Date;
}

function CopyButton({
  text,
  label,
  size = "sm",
}: {
  text: string;
  label?: string;
  size?: "sm" | "default";
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      className="h-7 px-2 text-muted-foreground"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          toast.success("Copiado para a área de transferência");
          setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.error("Não foi possível copiar");
        }
      }}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {label && <span className="ml-1 text-xs">{label}</span>}
    </Button>
  );
}

function BlocoRoteiro({
  titulo,
  icon: Icon,
  texto,
  colorClass,
}: {
  titulo: string;
  icon: typeof Zap;
  texto: string;
  colorClass: string;
}) {
  return (
    <div className={cn("rounded-lg border-l-4 bg-muted/50 p-4", colorClass)}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-wider">
            {titulo}
          </span>
        </div>
        <CopyButton text={texto} />
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{texto}</p>
    </div>
  );
}

function roteiroCompleto(r: Roteiro): string {
  return [
    `HOOK:\n${r.hook}`,
    `CORPO:\n${r.corpo}`,
    `CTA:\n${r.cta}`,
    r.hashtags && r.hashtags.length > 0 ? `HASHTAGS:\n${r.hashtags.join(" ")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function RoteiroGenerator({ contexto }: RoteiroGeneratorProps) {
  const [tema, setTema] = useState("");
  const [tom, setTom] = useState(TONS[0]);
  const [duracao, setDuracao] = useState("60s");
  const [modelo, setModelo] = useState(AI_MODELS[0].id);
  const [cta, setCta] = useState("");
  const [gerando, setGerando] = useState(false);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);

  async function gerar() {
    if (!tema.trim()) {
      toast.error("Descreva o tema ou a ideia do vídeo");
      return;
    }
    setGerando(true);
    try {
      const res = await fetch("/api/roteiro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tema: tema.trim(),
          tom,
          duracao,
          modelo,
          cta: cta.trim() || undefined,
          contexto:
            historico.length > 0
              ? [contexto, `Gere uma variação diferente da anterior (variação #${historico.length + 1}).`]
                  .filter(Boolean)
                  .join(" ")
              : contexto,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "Falha ao gerar roteiro");
      }
      const data = (await res.json()) as { roteiro: Roteiro; source?: string };
      setHistorico((prev) => [
        {
          roteiro: data.roteiro,
          tema: tema.trim(),
          tom,
          duracao,
          source: data.source ?? "ai",
          geradoEm: new Date(),
        },
        ...prev,
      ]);
      toast.success(
        historico.length > 0 ? "Nova variação gerada!" : "Roteiro gerado!"
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar roteiro");
    }
    setGerando(false);
  }

  const atual = historico[0];
  const anteriores = historico.slice(1);

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      {/* Formulário */}
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-purple-500" />
            Gerador de Roteiro IA
          </CardTitle>
          <CardDescription>
            Descreva a ideia e a IA monta o roteiro com hook, corpo e CTA.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="roteiro-tema">Tema / ideia do vídeo</Label>
            <Textarea
              id="roteiro-tema"
              placeholder="Ex.: 5 direitos trabalhistas que quase ninguém conhece"
              rows={3}
              value={tema}
              onChange={(e) => setTema(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tom</Label>
              <Select value={tom} onValueChange={setTom}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Duração alvo</Label>
              <Select value={duracao} onValueChange={setDuracao}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURACOES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Modelo de IA</Label>
            <Select value={modelo} onValueChange={setModelo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label} · {m.provider}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="roteiro-cta">CTA desejado (opcional)</Label>
            <Input
              id="roteiro-cta"
              placeholder="Ex.: Agende uma consulta pelo link da bio"
              value={cta}
              onChange={(e) => setCta(e.target.value)}
            />
          </div>
          <Button className="w-full" onClick={gerar} disabled={gerando}>
            {gerando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : historico.length > 0 ? (
              <RefreshCw className="mr-2 h-4 w-4" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {gerando
              ? "Gerando..."
              : historico.length > 0
                ? "Gerar variação"
                : "Gerar roteiro"}
          </Button>
        </CardContent>
      </Card>

      {/* Resultado */}
      <div className="space-y-4">
        {!atual && !gerando && (
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <h3 className="font-semibold">Seu roteiro aparece aqui</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Preencha o tema ao lado e clique em “Gerar roteiro”. Você pode
              gerar quantas variações quiser.
            </p>
          </div>
        )}

        {gerando && !atual && (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border p-8 text-center">
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-purple-500" />
            <p className="text-sm text-muted-foreground">
              A IA está escrevendo seu roteiro...
            </p>
          </div>
        )}

        {atual && (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base">
                  Roteiro · {atual.tom} · {atual.duracao}
                </CardTitle>
                <CardDescription className="mt-1 line-clamp-1">
                  {atual.tema}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {atual.source === "mock" && (
                  <Badge variant="outline">Modo demonstração</Badge>
                )}
                <CopyButton
                  text={roteiroCompleto(atual.roteiro)}
                  label="Copiar tudo"
                  size="default"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <BlocoRoteiro
                titulo="Hook"
                icon={Zap}
                texto={atual.roteiro.hook}
                colorClass="border-l-purple-500"
              />
              <BlocoRoteiro
                titulo="Corpo"
                icon={MessageSquareText}
                texto={atual.roteiro.corpo}
                colorClass="border-l-blue-500"
              />
              <BlocoRoteiro
                titulo="CTA"
                icon={Megaphone}
                texto={atual.roteiro.cta}
                colorClass="border-l-emerald-500"
              />
              {atual.roteiro.hashtags && atual.roteiro.hashtags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {atual.roteiro.hashtags.map((h) => (
                    <Badge key={h} variant="secondary">
                      {h}
                    </Badge>
                  ))}
                  <CopyButton text={atual.roteiro.hashtags.join(" ")} />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {anteriores.length > 0 && (
          <div className="space-y-3">
            <Separator />
            <h4 className="text-sm font-semibold text-muted-foreground">
              Variações anteriores ({anteriores.length})
            </h4>
            {anteriores.map((item, i) => (
              <Card key={`${item.geradoEm.getTime()}-${i}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.tema}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.tom} · {item.duracao} ·{" "}
                      {item.geradoEm.toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <CopyButton
                    text={roteiroCompleto(item.roteiro)}
                    label="Copiar"
                    size="default"
                  />
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {item.roteiro.hook}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
