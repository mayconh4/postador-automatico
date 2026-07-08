/**
 * Extração robusta de JSON de respostas de modelos de IA — versão canônica
 * (espelha supabase/functions/_shared/openrouter.ts). Aceita cercas de código
 * (```json ... ```) ou o primeiro bloco `{...}` do texto, e rejeita arrays
 * soltos/valores primitivos.
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
