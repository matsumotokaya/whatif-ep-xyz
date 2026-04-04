-- Add legacy login ID for former The Club accounts.

alter table public.profiles
  add column if not exists legacy_login_id text;

create unique index if not exists profiles_legacy_login_id_unique
  on public.profiles (legacy_login_id)
  where legacy_login_id is not null;
