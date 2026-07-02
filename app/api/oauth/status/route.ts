import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Retorna quais integrações estão configuradas no servidor (apenas booleans —
 * nunca expõe os valores das variáveis de ambiente).
 */
export async function GET() {
  return NextResponse.json({
    instagram: !!process.env.META_APP_ID,
    facebook: !!process.env.META_APP_ID,
    youtube: !!process.env.GOOGLE_CLIENT_ID,
    tiktok: !!process.env.TIKTOK_CLIENT_KEY,
    openrouter: !!process.env.OPENROUTER_API_KEY,
  });
}
