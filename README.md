# Postador Automático

Plataforma de produção de conteúdo em escala para vídeos curtos (Shorts / Reels / TikTok / Stories):
**receba vídeo/ideia → edite em massa → agende → publique automaticamente em múltiplas redes.**

## Stack

| Camada | Tecnologia |
| --- | --- |
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui |
| Backend | Supabase (Auth, Postgres, Storage, Edge Functions) |
| Vídeo | FFmpeg.wasm + Canvas API (processamento 100% no navegador) |
| IA | OpenRouter (Claude Sonnet, GPT-4o, Gemini Flash) |
| Publicação | Edge Functions + APIs oficiais (Meta, YouTube, TikTok) |
| Deploy | Vercel + Supabase |

## Setorização (abas)

1. **Descobrir** — trending por rede (50 vídeos mock com filtros), importar vídeo para projeto
2. **Projetos** — CRUD de projetos, importados, assets, gerador de roteiro IA (hook/corpo/CTA)
3. **Editor** — CapCut leve: timeline com cortes/split/reordenação, filtros, textos, watermark, fundo 9:16, áudio, preview em Canvas e export via FFmpeg.wasm
4. **Agendar** — calendário por rede + tipo com drag-and-drop, modal de criação, analytics e sugestão de melhor horário
5. **Referência** — scraping de perfis (@), vídeos top, copys top, comentários top, insights de IA, notas
6. **Batch Edit** — upload em massa (10+), Template Builder, aplicação de preset em N vídeos (worker paralelo 3x), download ZIP, agendamento em lote
7. **Jurídico** — máquina de conteúdo viral para advogados: mapear vídeos virais, extrair padrões, replicar com IA, publicar em escala
8. **Configurações** — OAuth das 4 redes (Instagram, YouTube, TikTok, Facebook) + modelos de IA

## Setup

### 1. Dependências

```bash
npm install
```

### 2. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Rode as migrations na ordem (SQL Editor ou `supabase db push`):
   - `supabase/migrations/0001_core.sql` — projetos, trending, assets, edições, templates
   - `supabase/migrations/0002_referencia.sql` — perfis de referência (`"references"`), posts/comentários raspados, notas
   - `supabase/migrations/0003_publishing.sql` — conexões OAuth, posts agendados, publicações
   - `supabase/migrations/0004_batch.sql` — batch jobs e itens
   - `supabase/migrations/0005_juridico.sql` — casos jurídicos, padrões virais, conteúdo gerado
   - `supabase/migrations/0006_storage.sql` — buckets (`videos`, `images`, `audio`, `exports`, `batch-exports`, `screenshots`) + RLS
   - `supabase/migrations/0007_cron.sql` — cron de publicação (pg_cron + pg_net, a cada minuto)
3. Ative o provider **Google** em Authentication → Providers (para login social).
4. Deploy das edge functions: veja `supabase/functions/README.md`.

> Todas as tabelas têm **RLS** habilitado — cada usuário só acessa os próprios dados.
> No Storage, o primeiro segmento do caminho é sempre o `user_id`.

### 3. Variáveis de ambiente

```bash
cp .env.example .env.local
```

| Variável | Uso | Obrigatória |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | app inteiro | sim |
| `SUPABASE_SERVICE_ROLE_KEY` | rotas server e edge functions | para publicação |
| `OPENROUTER_API_KEY` | roteiros, insights, módulo jurídico | não (usa mock) |
| `META_APP_ID` / `META_APP_SECRET` | OAuth Instagram + Facebook | não (modo demo) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth YouTube | não (modo demo) |
| `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` | OAuth TikTok | não (modo demo) |

**Sem nenhuma env de IA/OAuth o app continua utilizável**: rotas de IA devolvem mocks determinísticos e o OAuth cria conexões demo — ideal para desenvolvimento e demonstração.

### 4. Rodar

```bash
npm run dev
# http://localhost:3000
```

## Publicação automática

- O agendamento cria linhas em `scheduled_posts` (`status = pending`).
- O cron (pg_cron, a cada minuto — `0007_cron.sql`) chama a edge function `publish-now`.
- `publish-now` busca posts vencidos e despacha para `publish-instagram` / `publish-youtube` / `publish-tiktok` / `publish-facebook`.
- **Retry automático**: em falha, `retry_count + 1` e reagendamento para +5 min; após 3 tentativas o post é marcado `failed` (histórico completo em `publications`).
- Tokens são renovados pela função `refresh-oauth`.

## Caso de uso: automação jurídica

O módulo **Jurídico** (`/juridico`) implementa a esteira completa para o nicho:

1. **Bulk import** de perfis jurídicos de referência (um `@` por linha)
2. **Análise de padrões virais** com IA (tipo de padrão, hook, estrutura, CTA, score)
3. **Geração de conteúdo replicado** (roteiro completo + legenda + hashtags, com disclaimer jurídico)
4. **Agendamento em escala** direto para o calendário

## Estrutura

```
app/
  (dashboard)/          # abas com sidebar: descobrir, projetos, editar, agendar,
                        # referencia, batch, juridico, configuracoes
  api/                  # roteiro IA, insights, oauth (start/callback/status), juridico
  login/ cadastro/ auth/callback
components/
  ui/                   # shadcn/ui
  layout/ descobrir/ projetos/ editor/ agendar/ referencia/ batch/ juridico/ configuracoes/
lib/
  supabase/             # clients browser/server/middleware
  video/                # FFmpeg.wasm + pipeline de export
  types.ts constants.ts storage.ts utils.ts
supabase/
  migrations/           # 7 migrations com RLS
  functions/            # 12 edge functions (scraping, IA, publicação, cron worker)
```

## Critérios de aceite

- [x] Login e-mail + Google; OAuth das 4 redes (com modo demo sem envs)
- [x] Trending lista vídeos por rede com filtros e importação
- [x] Referência raspa perfis + comentários + insights IA
- [x] Editor exporta vídeo com fundo + watermark + legenda + áudio
- [x] Agendamento por rede + tipo; cron a cada minuto; retry 3x/5min
- [x] Upload em massa (10+), Template Builder, batch com worker paralelo 3x
- [x] Download ZIP do lote e Batch → Agendar (N posts de uma vez)
- [x] Módulo jurídico: importa perfis, extrai padrões, gera conteúdo replicado
