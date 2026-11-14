-- Site-wide settings changed by SQL (no admin UI).
-- First use: the Gallery "Recommend" mode shows the works saved by one curator
-- account. Only the server (service role) reads this table: RLS is enabled
-- with no policies, so anon / authenticated clients cannot read or write it.

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  note text,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.site_settings enable row level security;

comment on table public.site_settings is
  'Site-wide settings edited by SQL. Server-only (RLS on, no policies).';

insert into public.site_settings (key, value, note)
select
  'recommend_curator_user_id',
  to_jsonb(u.id::text),
  'Gallery Recommend = published works saved by this auth user. Change: update public.site_settings set value = (select to_jsonb(id::text) from auth.users where email = ''<email>''), updated_at = now() where key = ''recommend_curator_user_id'';'
from auth.users u
where u.email = 'matsumotokaya@gmail.com'
on conflict (key) do update
  set value = excluded.value,
      updated_at = timezone('utc'::text, now());
