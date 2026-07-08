import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";

/**
 * Callback de exclusão de dados exigido pela Meta (Data Deletion Callback).
 * O Facebook envia um POST form-encoded com `signed_request` quando um
 * usuário pede a exclusão dos dados do app. Validamos a assinatura HMAC,
 * removemos as conexões Meta do usuário e respondemos com a URL de
 * acompanhamento + código de confirmação, como a Meta exige.
 * Docs: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
 */

function parseSignedRequest(
  signedRequest: string,
  appSecret: string
): Record<string, unknown> | null {
  const [encodedSig, payload] = signedRequest.split(".", 2);
  if (!encodedSig || !payload) return null;

  const sig = Buffer.from(
    encodedSig.replace(/-/g, "+").replace(/_/g, "/"),
    "base64"
  );
  const expected = createHmac("sha256", appSecret).update(payload).digest();
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) {
    return null;
  }

  try {
    return JSON.parse(
      Buffer.from(
        payload.replace(/-/g, "+").replace(/_/g, "/"),
        "base64"
      ).toString("utf8")
    ) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    return NextResponse.json(
      { error: "META_APP_SECRET não configurada" },
      { status: 501 }
    );
  }

  const form = await request.formData().catch(() => null);
  const signedRequest = form?.get("signed_request");
  if (typeof signedRequest !== "string" || !signedRequest) {
    return NextResponse.json(
      { error: "signed_request ausente" },
      { status: 400 }
    );
  }

  const data = parseSignedRequest(signedRequest, appSecret);
  if (!data) {
    return NextResponse.json(
      { error: "assinatura inválida" },
      { status: 400 }
    );
  }

  const metaUserId = String(data.user_id ?? "");
  const confirmationCode = `del-${metaUserId || "anon"}-${Date.now().toString(36)}`;

  // Remove conexões Meta (instagram/facebook) associadas — o account_id
  // armazenado é o da Página/conta IG, então removemos de forma conservadora
  // pelo escopo que temos. A exclusão completa da conta é atendida via
  // solicitação manual (ver /privacidade#exclusao-de-dados).
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && serviceKey && metaUserId) {
      const admin = createClient(url, serviceKey, {
        auth: { persistSession: false },
      });
      await admin
        .from("oauth_connections")
        .delete()
        .in("platform", ["instagram", "facebook"])
        .eq("account_id", metaUserId);
    }
  } catch {
    // Falha na limpeza automática não impede a confirmação — o processo
    // manual descrito na política de privacidade cobre o restante.
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  return NextResponse.json({
    url: `${origin}/privacidade#exclusao-de-dados`,
    confirmation_code: confirmationCode,
  });
}
