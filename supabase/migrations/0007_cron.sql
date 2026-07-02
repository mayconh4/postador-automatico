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
