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
