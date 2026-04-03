-- The Club catalog table + premium-only read access.

create table if not exists public.club_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  kind text not null check (kind in ('wallpaper', 'zip', 'reel', 'other')),
  cover_image_url text,
  storage_key text not null unique,
  file_name text not null,
  file_size_bytes bigint,
  mime_type text,
  is_published boolean not null default false,
  published_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.club_items enable row level security;

grant select on public.club_items to authenticated;

drop policy if exists "club_items_select_premium" on public.club_items;

create policy "club_items_select_premium"
  on public.club_items
  for select
  to authenticated
  using (
    is_published = true
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.subscription_tier = 'premium'
    )
  );
