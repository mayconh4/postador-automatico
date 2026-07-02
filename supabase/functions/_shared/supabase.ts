// ===== Cliente Supabase (service role) + helpers de autenticação =====

import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Cliente administrativo (service role) — ignora RLS.
 * Use apenas dentro das edge functions, nunca exponha a key ao cliente.
 */
export function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar configuradas",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Extrai o token do header `Authorization: Bearer <token>`. */
export function bearerToken(req: Request): string | null {
  const header = req.headers.get("Authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/** True quando a requisição usa a service role key (chamadas internas/cron). */
export function isServiceRoleRequest(req: Request): boolean {
  const token = bearerToken(req);
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return Boolean(token && key && token === key);
}

/**
 * Valida o JWT do header Authorization via auth.getUser e retorna o user_id,
 * ou null quando o token é inválido/ausente (ex.: service role ou anon key).
 */
export async function userIdFromAuthHeader(req: Request): Promise<string | null> {
  const token = bearerToken(req);
  if (!token) return null;
  try {
    const supabase = adminClient();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}
