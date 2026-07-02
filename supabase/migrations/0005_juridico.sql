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
