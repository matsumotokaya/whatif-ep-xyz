-- Episodes table for gallery data.
-- Public users can read published episodes.
-- Admin users (public.profiles.role = 'admin') can manage all episodes.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role::text = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create table if not exists public.episodes (
  id integer primary key,
  number text not null unique,
  title text not null,
  category text not null default '',
  product_url text,
  released_on date,
  original_storage_key text not null unique,
  thumbnail_storage_key text unique,
  is_published boolean not null default true,
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint episodes_number_format_check
    check (number ~ '^[0-9]{4,}$'),
  constraint episodes_id_number_match_check
    check (id = number::integer)
);

comment on table public.episodes is 'Gallery episode master data.';
comment on column public.episodes.id is 'Numeric episode id. Expected to match number::integer.';
comment on column public.episodes.number is 'Display episode number, zero-padded like 0001.';
comment on column public.episodes.original_storage_key is 'R2 object key for the original image.';
comment on column public.episodes.thumbnail_storage_key is 'R2 object key for the gallery thumbnail image.';
comment on column public.episodes.released_on is 'Optional public-facing release date.';

create index if not exists episodes_public_listing_idx
  on public.episodes (is_published, id desc);

create index if not exists episodes_published_at_idx
  on public.episodes (published_at desc nulls last);

create or replace function public.set_episodes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists set_episodes_updated_at on public.episodes;

create trigger set_episodes_updated_at
before update on public.episodes
for each row
execute function public.set_episodes_updated_at();

alter table public.episodes enable row level security;

grant select on public.episodes to anon, authenticated;
grant insert, update, delete on public.episodes to authenticated;

drop policy if exists "episodes_select_published" on public.episodes;
create policy "episodes_select_published"
  on public.episodes
  for select
  to anon, authenticated
  using (
    is_published = true
    or (select public.is_admin())
  );

drop policy if exists "episodes_insert_admin" on public.episodes;
create policy "episodes_insert_admin"
  on public.episodes
  for insert
  to authenticated
  with check ((select public.is_admin()));

drop policy if exists "episodes_update_admin" on public.episodes;
create policy "episodes_update_admin"
  on public.episodes
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "episodes_delete_admin" on public.episodes;
create policy "episodes_delete_admin"
  on public.episodes
  for delete
  to authenticated
  using ((select public.is_admin()));
