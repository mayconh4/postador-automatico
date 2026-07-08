import Link from "next/link";
import { Zap } from "lucide-react";

export const metadata = {
  title: "Política de Privacidade — Postador Automático",
};

export default function PrivacidadePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8 flex items-center gap-2">
        <Zap className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold tracking-tight">
          Postador<span className="text-primary">Auto</span>
        </span>
      </div>

      <h1 className="mb-2 text-3xl font-bold tracking-tight">
        Política de Privacidade
      </h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Última atualização: julho de 2026
      </p>

      <div className="space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="mb-2 text-lg font-semibold">1. Quem somos</h2>
          <p>
            O Postador Automático é uma plataforma de produção, edição e
            agendamento de vídeos curtos com publicação automática em redes
            sociais (Instagram, YouTube, TikTok e Facebook).
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">2. Dados que coletamos</h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <strong>Dados de conta:</strong> nome, e-mail e senha (armazenada
              com hash) usados no cadastro.
            </li>
            <li>
              <strong>Tokens de acesso das redes sociais:</strong> ao conectar
              suas contas via OAuth, armazenamos os tokens de acesso
              necessários para publicar em seu nome. Nunca armazenamos suas
              senhas das redes sociais.
            </li>
            <li>
              <strong>Conteúdo:</strong> vídeos, imagens, áudios, legendas e
              agendamentos que você cria na plataforma.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">3. Como usamos os dados</h2>
          <p>
            Exclusivamente para operar a plataforma: editar e armazenar seus
            vídeos, publicar conteúdo nas contas que você conectou, nos
            horários que você agendou. Não vendemos nem compartilhamos seus
            dados com terceiros para fins de marketing.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">4. Armazenamento e segurança</h2>
          <p>
            Os dados são armazenados na infraestrutura do Supabase com
            isolamento por usuário (Row Level Security): cada usuário só
            acessa os próprios dados. Tokens de redes sociais são usados
            apenas pelas rotinas de publicação.
          </p>
        </section>

        <section id="exclusao-de-dados">
          <h2 className="mb-2 text-lg font-semibold">5. Exclusão de dados</h2>
          <p>
            Você pode desconectar qualquer rede social a qualquer momento na
            página de Configurações — isso remove imediatamente os tokens de
            acesso daquela rede. Para excluir sua conta e todos os dados
            associados (projetos, vídeos, agendamentos e conexões), entre em
            contato pelo e-mail abaixo. A exclusão é processada em até 7 dias.
          </p>
          <p className="mt-2">
            Solicitações de exclusão originadas do Facebook/Instagram (via
            &quot;Excluir dados do app&quot;) são processadas automaticamente
            pelo nosso endpoint de exclusão de dados.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">6. Contato</h2>
          <p>
            Dúvidas sobre privacidade:{" "}
            <a
              href="mailto:maycontuliofs@gmail.com"
              className="text-primary underline"
            >
              maycontuliofs@gmail.com
            </a>
          </p>
        </section>
      </div>

      <div className="mt-10 border-t pt-6 text-sm">
        <Link href="/termos" className="text-primary underline">
          Termos de Uso
        </Link>
        <span className="mx-2 text-muted-foreground">·</span>
        <Link href="/login" className="text-primary underline">
          Entrar na plataforma
        </Link>
      </div>
    </div>
  );
}
