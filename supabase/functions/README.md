# Edge Functions — Postador Automático

12 funções Deno que cuidam de scraping, IA e publicação automática.

## Deploy

```bash
supabase link --project-ref <PROJECT_REF>

# todas de uma vez
supabase functions deploy scrape-youtube scrape-instagram scrape-tiktok \
  generate-roteiro refresh-oauth publish-now publish-instagram \
  publish-youtube publish-tiktok publish-facebook \
  analyze-viral-patterns generate-legal-content
```

O `supabase/config.toml` já define `verify_jwt` por função (`publish-now` é a
única com `verify_jwt = false` — ela valida manualmente a service role key).

## Secrets

```bash
supabase secrets set OPENROUTER_API_KEY=sk-or-...   # IA (roteiro/insights/jurídico)
supabase secrets set YOUTUBE_API_KEY=...            # scraping YouTube (Data API v3)
supabase secrets set IG_GRAPH_TOKEN=...             # scraping Instagram (opcional)
supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...   # refresh-oauth
supabase secrets set META_APP_ID=... META_APP_SECRET=...             # refresh-oauth
supabase secrets set TIKTOK_CLIENT_KEY=... TIKTOK_CLIENT_SECRET=...  # refresh-oauth
```

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetadas automaticamente.

**Sem secrets configuradas, as funções de IA/scraping caem em mocks
determinísticos** — o fluxo completo continua demonstrável.

## Cron (publicação a cada minuto)

Ative `pg_cron` + `pg_net` e rode o bloco de `supabase/migrations/0007_cron.sql`
substituindo `<PROJECT_REF>` e `<SERVICE_ROLE_KEY>`. O job chama `publish-now`
a cada minuto; ela processa até 10 posts vencidos por execução com retry
automático (3 tentativas, +5 min entre elas) e histórico em `publications`.

## Matriz função → envs

| Função | Envs necessárias | Fallback sem env |
| --- | --- | --- |
| scrape-youtube | `YOUTUBE_API_KEY` | mock determinístico |
| scrape-instagram | `IG_GRAPH_TOKEN` (conta business) | mock determinístico |
| scrape-tiktok | — (API oficial exige app aprovado) | mock sempre |
| generate-roteiro | `OPENROUTER_API_KEY` | mock |
| analyze-viral-patterns | `OPENROUTER_API_KEY` | mock (7 padrões jurídicos) |
| generate-legal-content | `OPENROUTER_API_KEY` | mock (banco de temas por área) |
| refresh-oauth | client id/secret de cada rede | pula a conexão |
| publish-now | — (usa service key) | simula publicação p/ conexões demo |
| publish-instagram | token do usuário (oauth_connections) | — |
| publish-youtube | token do usuário | — |
| publish-tiktok | token do usuário | — |
| publish-facebook | token do usuário | — |

## Limitações conhecidas

- **TikTok**: a publicação usa `FILE_UPLOAD` (a função baixa o vídeo e sobe
  em chunks) porque `PULL_FROM_URL` exigiria verificar o domínio do Supabase
  Storage. Enquanto o app não for **auditado** pelo TikTok, a API só permite
  posts privados — a função consulta `creator_info` e usa o nível mais
  público permitido automaticamente (force com a env `TIKTOK_PRIVACY_LEVEL`).
  **Tokens do TikTok expiram em 24h**: agende o cron do `refresh-oauth`
  (bloco em `supabase/migrations/0007_cron.sql`) ou as conexões morrem em 1 dia.
- **Instagram**: publicação exige conta profissional (business/creator)
  vinculada a uma página do Facebook; o vídeo precisa estar em URL pública
  (as signed URLs do Storage funcionam).
- **YouTube**: o upload usa o escopo `youtube.upload`; contas novas podem ter
  cota diária de API limitada.
- **Facebook**: `account_id` deve ser o ID da **página** e o token um page
  token com `pages_manage_posts`.
