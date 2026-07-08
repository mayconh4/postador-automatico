-- ===== Cron de publicação (executa publish-now a cada minuto) =====
-- Requer as extensões pg_cron e pg_net (Dashboard → Database → Extensions).
--
-- Substitua:
--   <PROJECT_REF>        → ref do seu projeto Supabase
--   <SERVICE_ROLE_KEY>   → service role key (Settings → API)
--
-- Depois execute este bloco no SQL Editor:

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- select cron.schedule(
--   'publish-scheduled-posts',
--   '* * * * *', -- a cada minuto
--   $$
--   select net.http_post(
--     url := 'https://<PROJECT_REF>.supabase.co/functions/v1/publish-now',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );

-- Para remover: select cron.unschedule('publish-scheduled-posts');

-- ===== Renovação de tokens OAuth (refresh-oauth a cada 30 minutos) =====
-- OBRIGATÓRIO para o TikTok: os access tokens expiram em 24h — sem esta
-- rotina, toda conexão TikTok morre em 1 dia. Também renova Google e Meta.

-- select cron.schedule(
--   'refresh-oauth-tokens',
--   '*/30 * * * *', -- a cada 30 minutos
--   $$
--   select net.http_post(
--     url := 'https://<PROJECT_REF>.supabase.co/functions/v1/refresh-oauth',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );

-- Para remover: select cron.unschedule('refresh-oauth-tokens');
