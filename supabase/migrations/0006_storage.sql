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
