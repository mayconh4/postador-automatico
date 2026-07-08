import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Transcrição de áudio com Whisper (OpenAI) para legendas automáticas.
 * POST multipart: file (áudio mp3/m4a/wav ≤ 4MB), duration (segundos, p/ mock).
 * Resposta: { segments: [{start, end, text}], source: "ai" | "mock" }
 *
 * Sem OPENAI_API_KEY, devolve segmentos mock determinísticos para o fluxo
 * continuar demonstrável (mesma filosofia das demais rotas de IA).
 */

interface Segment {
  start: number;
  end: number;
  text: string;
}

const MAX_BYTES = 4 * 1024 * 1024;

const MOCK_LINES = [
  "Você sabia que isso pode mudar tudo?",
  "A maioria das pessoas comete esse erro",
  "e nem percebe o quanto perde com isso.",
  "Presta atenção nesse detalhe importante:",
  "existe um jeito muito mais simples de resolver.",
  "O primeiro passo é entender o contexto.",
  "Depois, aplique isso na prática hoje mesmo.",
  "E o resultado aparece mais rápido do que você imagina.",
  "Salva esse vídeo para não esquecer",
  "e me segue para mais conteúdos como esse!",
];

function mockSegments(durationSeconds: number): Segment[] {
  const duration = Math.max(10, Math.min(durationSeconds || 45, 120));
  const count = Math.min(MOCK_LINES.length, Math.max(4, Math.round(duration / 5)));
  const per = duration / count;
  return Array.from({ length: count }, (_, i) => ({
    start: Math.round(i * per * 100) / 100,
    end: Math.round((i + 1) * per * 100) / 100,
    text: MOCK_LINES[i % MOCK_LINES.length],
  }));
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Envie multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  const duration = Number(form.get("duration") ?? 0);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ segments: mockSegments(duration), source: "mock" });
  }

  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "Arquivo de áudio ausente" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Áudio maior que 4MB — use um vídeo mais curto" },
      { status: 413 }
    );
  }

  try {
    const upstream = new FormData();
    upstream.append("file", file, "audio.mp3");
    upstream.append("model", "whisper-1");
    upstream.append("language", "pt");
    upstream.append("response_format", "verbose_json");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      throw new Error(err?.error?.message ?? `Whisper respondeu ${res.status}`);
    }

    const data = (await res.json()) as {
      segments?: { start: number; end: number; text: string }[];
      text?: string;
      duration?: number;
    };

    const segments: Segment[] = (data.segments ?? []).map((s) => ({
      start: Math.round(s.start * 100) / 100,
      end: Math.round(s.end * 100) / 100,
      text: s.text.trim(),
    }));

    if (segments.length === 0 && data.text) {
      segments.push({
        start: 0,
        end: data.duration ?? duration ?? 30,
        text: data.text.trim(),
      });
    }

    return NextResponse.json({ segments, source: "ai" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha na transcrição";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
