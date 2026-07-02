// ===== Cliente OpenRouter com extração robusta de JSON =====

const DEFAULT_MODEL = "anthropic/claude-sonnet-4.5";

/**
 * Extrai o primeiro objeto JSON válido de um texto — aceita cercas de código
 * (```json ... ```) ou o primeiro bloco `{...}` encontrado.
 */
export function extractJson(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const candidates: string[] = [];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) candidates.push(fenced[1]);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) candidates.push(text.slice(start, end + 1));
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // tenta o próximo candidato
    }
  }
  return null;
}

/**
 * Chama o OpenRouter e retorna o JSON extraído da resposta.
 * Retorna null quando OPENROUTER_API_KEY não está configurada ou quando a
 * chamada/parse falha — o caller deve usar o mock determinístico nesse caso.
 */
export async function chatJSON(
  system: string,
  user: string,
  model?: string,
): Promise<Record<string, unknown> | null> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) return null;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.8,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    return extractJson(content);
  } catch {
    return null;
  }
}
