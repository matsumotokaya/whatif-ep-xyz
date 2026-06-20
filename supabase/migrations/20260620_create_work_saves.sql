-- Saved works (bookmarks) for signed-in users. Private to each user.
create table if not exists public.work_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  work_id uuid not null references public.works(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, work_id)
);

alter table public.work_saves enable row level security;

create policy "work_saves_select_own" on public.work_saves
  for select using (auth.uid() = user_id);
create policy "work_saves_insert_own" on public.work_saves
  for insert with check (auth.uid() = user_id);
create policy "work_saves_delete_own" on public.work_saves
  for delete using (auth.uid() = user_id);

create index if not exists work_saves_user_idx on public.work_saves(user_id);
create index if not exists work_saves_work_idx on public.work_saves(work_id);
