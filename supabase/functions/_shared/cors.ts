// ===== CORS compartilhado entre todas as edge functions =====

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

/** Responde ao preflight CORS. Retorna null quando a requisição não é OPTIONS. */
export function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  return null;
}

/** Resposta JSON padronizada com headers de CORS. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Resposta de erro padronizada (`{ error: mensagem }`). */
export function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status);
}

/** Extrai a mensagem de um erro desconhecido de forma segura. */
export function errorMessage(err: unknown, fallback = "Erro inesperado"): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return fallback;
}
