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
