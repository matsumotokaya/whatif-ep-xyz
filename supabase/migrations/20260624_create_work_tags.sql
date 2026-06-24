create table if not exists public.work_tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  tag_type text not null default 'general',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint work_tags_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists public.work_tag_map (
  work_id uuid not null references public.works(id) on delete cascade,
  tag_id uuid not null references public.work_tags(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now()),
  primary key (work_id, tag_id)
);

create index if not exists work_tags_label_idx
  on public.work_tags (label asc);

create index if not exists work_tag_map_tag_idx
  on public.work_tag_map (tag_id, work_id);

drop trigger if exists set_work_tags_updated_at on public.work_tags;

create trigger set_work_tags_updated_at
before update on public.work_tags
for each row
execute function public.set_work_records_updated_at();

alter table public.work_tags enable row level security;
alter table public.work_tag_map enable row level security;

grant select on public.work_tags to anon, authenticated;
grant insert, update, delete on public.work_tags to authenticated;

grant select on public.work_tag_map to anon, authenticated;
grant insert, update, delete on public.work_tag_map to authenticated;

drop policy if exists "work_tags_select_public" on public.work_tags;
create policy "work_tags_select_public"
  on public.work_tags
  for select
  to anon, authenticated
  using (true);

drop policy if exists "work_tags_insert_admin" on public.work_tags;
create policy "work_tags_insert_admin"
  on public.work_tags
  for insert
  to authenticated
  with check ((select public.is_admin()));

drop policy if exists "work_tags_update_admin" on public.work_tags;
create policy "work_tags_update_admin"
  on public.work_tags
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "work_tags_delete_admin" on public.work_tags;
create policy "work_tags_delete_admin"
  on public.work_tags
  for delete
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "work_tag_map_select_visible" on public.work_tag_map;
create policy "work_tag_map_select_visible"
  on public.work_tag_map
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.works w
      where w.id = work_tag_map.work_id
        and (
          w.status = 'published'
          or (select public.is_admin())
        )
    )
  );

drop policy if exists "work_tag_map_insert_admin" on public.work_tag_map;
create policy "work_tag_map_insert_admin"
  on public.work_tag_map
  for insert
  to authenticated
  with check ((select public.is_admin()));

drop policy if exists "work_tag_map_delete_admin" on public.work_tag_map;
create policy "work_tag_map_delete_admin"
  on public.work_tag_map
  for delete
  to authenticated
  using ((select public.is_admin()));
