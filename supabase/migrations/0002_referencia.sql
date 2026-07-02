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
