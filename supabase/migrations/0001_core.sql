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
