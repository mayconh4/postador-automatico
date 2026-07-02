import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Aplica a todas as rotas exceto:
     * - _next/static, _next/image (assets)
     * - favicon e arquivos estáticos
     * - api/oauth (callbacks OAuth de redes sociais)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/oauth|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|woff2?)$).*)",
  ],
};
