"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, MailCheck, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AuthShell } from "@/components/auth/auth-shell";

function traduzErro(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Este e-mail já está cadastrado. Faça login.";
  if (m.includes("password") && m.includes("6"))
    return "A senha deve ter no mínimo 6 caracteres.";
  if (m.includes("invalid email") || m.includes("unable to validate email"))
    return "E-mail inválido. Verifique e tente novamente.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas. Aguarde um momento e tente novamente.";
  if (m.includes("network") || m.includes("fetch"))
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  return "Não foi possível criar sua conta. Tente novamente.";
}

export function CadastroForm() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [cadastrado, setCadastrado] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!nome.trim()) {
      toast.error("Informe seu nome.");
      return;
    }
    if (senha.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (senha !== confirmarSenha) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setCarregando(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password: senha,
        options: {
          data: { full_name: nome.trim() },
          emailRedirectTo: `${location.origin}/auth/callback?next=/descobrir`,
        },
      });
      if (error) {
        toast.error(traduzErro(error.message));
        return;
      }
      setCadastrado(true);
      toast.success("Conta criada! Verifique seu e-mail.");
    } catch {
      toast.error("Erro inesperado ao criar conta. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  if (cadastrado) {
    return (
      <AuthShell
        title="Verifique seu e-mail"
        description="Falta pouco para começar a publicar"
        footer={
          <>
            Já confirmou?{" "}
            <Link
              href="/login"
              className="font-medium text-purple-600 hover:underline dark:text-purple-400"
            >
              Fazer login
            </Link>
          </>
        }
      >
        <Alert>
          <MailCheck className="h-4 w-4" />
          <AlertTitle>Confirmação enviada</AlertTitle>
          <AlertDescription>
            Enviamos um link de confirmação para{" "}
            <span className="font-medium text-foreground">{email.trim()}</span>. Abra o
            e-mail e clique no link para ativar sua conta. Não esqueça de olhar a caixa de
            spam.
          </AlertDescription>
        </Alert>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Criar conta"
      description="Comece grátis a editar e agendar seus vídeos em massa"
      footer={
        <>
          Já tem uma conta?{" "}
          <Link
            href="/login"
            className="font-medium text-purple-600 hover:underline dark:text-purple-400"
          >
            Fazer login
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome</Label>
          <Input
            id="nome"
            type="text"
            placeholder="Seu nome completo"
            autoComplete="name"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            disabled={carregando}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            placeholder="voce@exemplo.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={carregando}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="senha">Senha</Label>
          <Input
            id="senha"
            type="password"
            placeholder="Mínimo de 6 caracteres"
            autoComplete="new-password"
            minLength={6}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            disabled={carregando}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmar-senha">Confirmar senha</Label>
          <Input
            id="confirmar-senha"
            type="password"
            placeholder="Repita a senha"
            autoComplete="new-password"
            minLength={6}
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
            disabled={carregando}
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={carregando}>
          {carregando ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="mr-2 h-4 w-4" />
          )}
          Criar conta
        </Button>
      </form>
    </AuthShell>
  );
}
