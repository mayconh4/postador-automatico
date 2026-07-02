"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AuthShell, GoogleIcon } from "@/components/auth/auth-shell";

function traduzErro(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed"))
    return "E-mail ainda não confirmado. Verifique sua caixa de entrada.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas. Aguarde um momento e tente novamente.";
  if (m.includes("network") || m.includes("fetch"))
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  return "Não foi possível entrar. Tente novamente.";
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/descobrir";

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [carregandoGoogle, setCarregandoGoogle] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim() || !senha) {
      toast.error("Preencha e-mail e senha.");
      return;
    }
    setCarregando(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      });
      if (error) {
        toast.error(traduzErro(error.message));
        return;
      }
      toast.success("Login realizado com sucesso!");
      router.push(next);
      router.refresh();
    } catch {
      toast.error("Erro inesperado ao entrar. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  async function handleGoogle() {
    setCarregandoGoogle(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) {
        toast.error("Não foi possível entrar com o Google. Tente novamente.");
        setCarregandoGoogle(false);
      }
      // em caso de sucesso o navegador é redirecionado pelo Supabase
    } catch {
      toast.error("Erro inesperado ao entrar com o Google.");
      setCarregandoGoogle(false);
    }
  }

  return (
    <AuthShell
      title="Bem-vindo de volta"
      description="Entre na sua conta para gerenciar e publicar seus vídeos"
      footer={
        <>
          Ainda não tem conta?{" "}
          <Link
            href="/cadastro"
            className="font-medium text-purple-600 hover:underline dark:text-purple-400"
          >
            Criar conta grátis
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            placeholder="voce@exemplo.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={carregando || carregandoGoogle}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="senha">Senha</Label>
          <Input
            id="senha"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            disabled={carregando || carregandoGoogle}
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={carregando || carregandoGoogle}>
          {carregando ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <LogIn className="mr-2 h-4 w-4" />
          )}
          Entrar
        </Button>
      </form>

      <div className="my-4 flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs uppercase text-muted-foreground">ou</span>
        <Separator className="flex-1" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGoogle}
        disabled={carregando || carregandoGoogle}
      >
        {carregandoGoogle ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <GoogleIcon className="mr-2 h-4 w-4" />
        )}
        Entrar com Google
      </Button>
    </AuthShell>
  );
}
