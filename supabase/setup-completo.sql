-- ============================================================
-- POSTADOR AUTOMÁTICO — SETUP COMPLETO DO BANCO
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute.
-- Combina as migrations 0001–0006 (0007/cron fica por último, manual).
-- ============================================================

-- ============ supabase/migrations/0001_core.sql ============
-- ===== Núcleo: projetos, trending, assets, edições, templates =====

-- Função utilitária para updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Projetos
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  niche text,
  created_at timestamptz default now()
);
alter table projects enable row level security;
create policy "Users manage own projects" on projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Importações de trending
create table if not exists trend_imports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  platform text not null,
  title text, url text, thumbnail_url text,
  views bigint default 0, likes bigint default 0, comments bigint default 0, shares bigint default 0,
  engagement_rate numeric default 0,
  created_at timestamptz default now()
);
alter table trend_imports enable row level security;
create policy "Users manage own trend_imports" on trend_imports
  for all using (
    exists (select 1 from projects p where p.id = trend_imports.project_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from projects p where p.id = trend_imports.project_id and p.user_id = auth.uid())
  );

-- Assets de vídeo/áudio/imagem
create table if not exists video_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  type text not null check (type in ('video','audio','image','background','watermark')),
  url text not null, filename text, meta jsonb,
  created_at timestamptz default now()
);
alter table video_assets enable row level security;
create policy "Users manage own video_assets" on video_assets
  for all using (
    exists (select 1 from projects p where p.id = video_assets.project_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from projects p where p.id = video_assets.project_id and p.user_id = auth.uid())
  );

-- Edições (estado do editor)
create table if not exists edits (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  video_asset_id uuid references video_assets(id) on delete cascade,
  name text,
  timeline_json jsonb not null default '[]',
  background jsonb,
  watermark jsonb,
  texts jsonb,
  filters jsonb,
  audio_overlay uuid references video_assets(id),
  export_path text,
  status text default 'draft',
  created_at timestamptz default now()
);
alter table edits enable row level security;
create policy "Users manage own edits" on edits
  for all using (
    exists (select 1 from projects p where p.id = edits.project_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from projects p where p.id = edits.project_id and p.user_id = auth.uid())
  );

-- Templates de edição (Template Builder / Batch)
create table if not exists edit_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  thumbnail text,
  config jsonb not null,
  created_at timestamptz default now()
);
alter table edit_templates enable row level security;
create policy "Users manage own edit_templates" on edit_templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Índices
create index if not exists idx_trend_imports_project on trend_imports(project_id);
create index if not exists idx_video_assets_project on video_assets(project_id);
create index if not exists idx_edits_project on edits(project_id);
create index if not exists idx_edit_templates_user on edit_templates(user_id);

-- ============ supabase/migrations/0002_referencia.sql ============
-- ===== Referência: perfis raspados, posts, comentários, notas =====
-- Obs.: "references" é palavra reservada no Postgres — o nome precisa de aspas.

create table if not exists "references" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  platform text not null,
  username text not null,
  profile_url text, niche text, insights_json jsonb,
  status text default 'pending', error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table "references" enable row level security;
create policy "Users manage own references" on "references"
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger references_updated_at
  before update on "references"
  for each row execute function public.set_updated_at();

create table if not exists scraped_posts (
  id uuid primary key default gen_random_uuid(),
  reference_id uuid references "references"(id) on delete cascade,
  platform_post_id text, title text, caption text, url text, thumbnail_url text,
  views bigint default 0, likes bigint default 0, comments bigint default 0, shares bigint default 0,
  engagement_rate numeric default 0, post_type text,
  created_at timestamptz default now()
);
alter table scraped_posts enable row level security;
create policy "Users manage own scraped_posts" on scraped_posts
  for all using (
    exists (select 1 from "references" r where r.id = scraped_posts.reference_id and r.user_id = auth.uid())
  ) with check (
    exists (select 1 from "references" r where r.id = scraped_posts.reference_id and r.user_id = auth.uid())
  );

create table if not exists scraped_comments (
  id uuid primary key default gen_random_uuid(),
  scraped_post_id uuid references scraped_posts(id) on delete cascade,
  text text not null, likes int default 0, sentiment text,
  created_at timestamptz default now()
);
alter table scraped_comments enable row level security;
create policy "Users manage own scraped_comments" on scraped_comments
  for all using (
    exists (
      select 1 from scraped_posts sp
      join "references" r on r.id = sp.reference_id
      where sp.id = scraped_comments.scraped_post_id and r.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from scraped_posts sp
      join "references" r on r.id = sp.reference_id
      where sp.id = scraped_comments.scraped_post_id and r.user_id = auth.uid()
    )
  );

create table if not exists reference_notes (
  id uuid primary key default gen_random_uuid(),
  reference_id uuid references "references"(id) on delete cascade,
  note text not null, created_at timestamptz default now()
);
alter table reference_notes enable row level security;
create policy "Users manage own reference_notes" on reference_notes
  for all using (
    exists (select 1 from "references" r where r.id = reference_notes.reference_id and r.user_id = auth.uid())
  ) with check (
    exists (select 1 from "references" r where r.id = reference_notes.reference_id and r.user_id = auth.uid())
  );

create index if not exists idx_references_user on "references"(user_id);
create index if not exists idx_scraped_posts_reference on scraped_posts(reference_id);
create index if not exists idx_scraped_posts_engagement on scraped_posts(engagement_rate desc);
create index if not exists idx_scraped_comments_post on scraped_comments(scraped_post_id);
create index if not exists idx_reference_notes_reference on reference_notes(reference_id);

-- ============ supabase/migrations/0003_publishing.sql ============
-- ===== Publicação: conexões OAuth, agendamentos, publicações =====

create table if not exists oauth_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  platform text not null check (platform in ('instagram','youtube','tiktok','facebook')),
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  account_id text not null,
  account_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, platform, account_id)
);
alter table oauth_connections enable row level security;
create policy "Users manage own connections" on oauth_connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger oauth_connections_updated_at
  before update on oauth_connections
  for each row execute function public.set_updated_at();

create table if not exists scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  edit_id uuid references edits(id) on delete cascade,
  platform text not null,
  post_type text not null,
  title text, caption text, media_path text,
  scheduled_at timestamptz not null,
  publish_method text default 'api',
  status text not null default 'pending',
  publish_response jsonb,
  error_message text,
  retry_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table scheduled_posts enable row level security;
create policy "Users manage own posts" on scheduled_posts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger scheduled_posts_updated_at
  before update on scheduled_posts
  for each row execute function public.set_updated_at();

create table if not exists publications (
  id uuid primary key default gen_random_uuid(),
  scheduled_post_id uuid references scheduled_posts(id) on delete cascade,
  platform text not null,
  response_id text, url text,
  status text not null default 'sent',
  error_message text,
  executed_at timestamptz default now()
);
alter table publications enable row level security;
create policy "Users manage own publications" on publications
  for all using (
    exists (select 1 from scheduled_posts sp where sp.id = publications.scheduled_post_id and sp.user_id = auth.uid())
  ) with check (
    exists (select 1 from scheduled_posts sp where sp.id = publications.scheduled_post_id and sp.user_id = auth.uid())
  );

-- Índices para o worker de publicação (cron a cada minuto)
create index if not exists idx_scheduled_posts_due
  on scheduled_posts(status, scheduled_at)
  where status in ('pending','failed');
create index if not exists idx_scheduled_posts_user on scheduled_posts(user_id);
create index if not exists idx_publications_post on publications(scheduled_post_id);
create index if not exists idx_oauth_connections_user on oauth_connections(user_id);

-- ============ supabase/migrations/0004_batch.sql ============
-- ===== Batch Edit: jobs e itens =====

create table if not exists batch_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  template_id uuid references edit_templates(id) on delete cascade,
  name text not null,
  status text default 'pending',
  total_items int default 0,
  completed_items int default 0,
  failed_items int default 0,
  output_zip_path text,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table batch_jobs enable row level security;
create policy "Users manage own batch_jobs" on batch_jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger batch_jobs_updated_at
  before update on batch_jobs
  for each row execute function public.set_updated_at();

create table if not exists batch_items (
  id uuid primary key default gen_random_uuid(),
  batch_job_id uuid references batch_jobs(id) on delete cascade,
  video_asset_id uuid references video_assets(id) on delete cascade,
  edit_id uuid references edits(id) on delete cascade,
  status text default 'pending',
  progress int default 0,
  export_path text,
  error_message text,
  created_at timestamptz default now()
);
alter table batch_items enable row level security;
create policy "Users manage own batch_items" on batch_items
  for all using (
    exists (select 1 from batch_jobs bj where bj.id = batch_items.batch_job_id and bj.user_id = auth.uid())
  ) with check (
    exists (select 1 from batch_jobs bj where bj.id = batch_items.batch_job_id and bj.user_id = auth.uid())
  );

create index if not exists idx_batch_jobs_user on batch_jobs(user_id);
create index if not exists idx_batch_items_job on batch_items(batch_job_id);

-- ============ supabase/migrations/0005_juridico.sql ============
-- ===== Módulo Jurídico: casos, padrões virais, conteúdo gerado =====

create table if not exists legal_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  legal_area text,
  target_audience text,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table legal_cases enable row level security;
create policy "Users manage own legal_cases" on legal_cases
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger legal_cases_updated_at
  before update on legal_cases
  for each row execute function public.set_updated_at();

create table if not exists legal_viral_patterns (
  id uuid primary key default gen_random_uuid(),
  legal_case_id uuid references legal_cases(id) on delete cascade,
  source_url text,
  source_platform text,
  pattern_type text,
  hook text,
  structure text,
  cta text,
  metrics jsonb,
  analysis text,
  score numeric default 0,
  created_at timestamptz default now()
);
alter table legal_viral_patterns enable row level security;
create policy "Users manage own legal_viral_patterns" on legal_viral_patterns
  for all using (
    exists (select 1 from legal_cases lc where lc.id = legal_viral_patterns.legal_case_id and lc.user_id = auth.uid())
  ) with check (
    exists (select 1 from legal_cases lc where lc.id = legal_viral_patterns.legal_case_id and lc.user_id = auth.uid())
  );

create table if not exists legal_generated_content (
  id uuid primary key default gen_random_uuid(),
  legal_case_id uuid references legal_cases(id) on delete cascade,
  pattern_id uuid references legal_viral_patterns(id) on delete set null,
  title text,
  hook text,
  body text,
  cta text,
  full_script text,
  caption text,
  hashtags text[],
  status text default 'draft',
  scheduled_post_id uuid references scheduled_posts(id) on delete set null,
  created_at timestamptz default now()
);
alter table legal_generated_content enable row level security;
create policy "Users manage own legal_generated_content" on legal_generated_content
  for all using (
    exists (select 1 from legal_cases lc where lc.id = legal_generated_content.legal_case_id and lc.user_id = auth.uid())
  ) with check (
    exists (select 1 from legal_cases lc where lc.id = legal_generated_content.legal_case_id and lc.user_id = auth.uid())
  );

create index if not exists idx_legal_cases_user on legal_cases(user_id);
create index if not exists idx_legal_patterns_case on legal_viral_patterns(legal_case_id);
create index if not exists idx_legal_content_case on legal_generated_content(legal_case_id);

-- ============ supabase/migrations/0006_storage.sql ============
-- ===== Buckets de Storage + policies =====
-- Convenção: primeiro segmento do caminho = user_id (ex.: `${userId}/arquivo.mp4`)

insert into storage.buckets (id, name, public)
values
  ('videos', 'videos', false),
  ('images', 'images', false),
  ('audio', 'audio', false),
  ('exports', 'exports', false),
  ('batch-exports', 'batch-exports', false),
  ('screenshots', 'screenshots', false)
on conflict (id) do nothing;

-- Cada usuário gerencia apenas a própria pasta em cada bucket
create policy "Users read own files" on storage.objects
  for select using (
    bucket_id in ('videos','images','audio','exports','batch-exports','screenshots')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users upload own files" on storage.objects
  for insert with check (
    bucket_id in ('videos','images','audio','exports','batch-exports','screenshots')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users update own files" on storage.objects
  for update using (
    bucket_id in ('videos','images','audio','exports','batch-exports','screenshots')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users delete own files" on storage.objects
  for delete using (
    bucket_id in ('videos','images','audio','exports','batch-exports','screenshots')
    and auth.uid()::text = (storage.foldername(name))[1]
  );
