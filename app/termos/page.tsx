import Link from "next/link";
import { Zap } from "lucide-react";

export const metadata = {
  title: "Termos de Uso — Postador Automático",
};

export default function TermosPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8 flex items-center gap-2">
        <Zap className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold tracking-tight">
          Postador<span className="text-primary">Auto</span>
        </span>
      </div>

      <h1 className="mb-2 text-3xl font-bold tracking-tight">Termos de Uso</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Última atualização: julho de 2026
      </p>

      <div className="space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="mb-2 text-lg font-semibold">1. O serviço</h2>
          <p>
            O Postador Automático permite criar, editar, agendar e publicar
            vídeos curtos em redes sociais conectadas por você. Ao usar a
            plataforma, você concorda com estes termos.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">2. Suas responsabilidades</h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              Você é o único responsável pelo conteúdo que cria e publica,
              incluindo direitos autorais de vídeos, músicas e imagens.
            </li>
            <li>
              O uso das contas conectadas deve respeitar os termos de uso de
              cada plataforma (Meta, Google/YouTube, TikTok).
            </li>
            <li>
              Conteúdo gerado por IA deve ser revisado antes da publicação —
              especialmente conteúdo informativo de nichos regulados (ex.:
              jurídico), que não substitui aconselhamento profissional.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">3. Limitações</h2>
          <p>
            A publicação automática depende das APIs oficiais das redes
            sociais, que podem mudar, limitar ou rejeitar publicações a
            qualquer momento. A plataforma tenta novamente em caso de falha
            (até 3 tentativas), mas não garante a publicação.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">4. Encerramento</h2>
          <p>
            Você pode desconectar redes ou solicitar a exclusão da conta a
            qualquer momento, conforme a{" "}
            <Link href="/privacidade" className="text-primary underline">
              Política de Privacidade
            </Link>
            .
          </p>
        </section>
      </div>

      <div className="mt-10 border-t pt-6 text-sm">
        <Link href="/privacidade" className="text-primary underline">
          Política de Privacidade
        </Link>
        <span className="mx-2 text-muted-foreground">·</span>
        <Link href="/login" className="text-primary underline">
          Entrar na plataforma
        </Link>
      </div>
    </div>
  );
}
