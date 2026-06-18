-- Work-oriented gallery schema.
-- Creates the long-term canonical model for series -> works -> variants -> offers.
-- Existing public.episodes rows are imported as series = 'episode'.

create or replace function public.set_work_records_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

create table if not exists public.work_series (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  route_base text not null,
  number_padding integer not null default 4,
  sort_order integer not null default 0,
  is_public boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint work_series_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint work_series_number_padding_check
    check (number_padding between 1 and 10)
);

comment on table public.work_series is 'Top-level gallery series such as episode, reel, experiment, remix.';
comment on column public.work_series.route_base is 'Primary route segment, e.g. /works/episode.';

create index if not exists work_series_public_sort_idx
  on public.work_series (is_public, sort_order asc, slug asc);

drop trigger if exists set_work_series_updated_at on public.work_series;

create trigger set_work_series_updated_at
before update on public.work_series
for each row
execute function public.set_work_records_updated_at();

create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.work_series(id) on delete restrict,
  legacy_episode_id integer unique references public.episodes(id) on delete set null,
  sequence_number integer not null,
  display_code text not null,
  slug text unique,
  title text not null,
  theme_category text not null default '',
  summary text,
  released_on date,
  status text not null default 'draft',
  published_at timestamptz,
  is_featured boolean not null default false,
  source_prompt text,
  source_model text,
  source_notes text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint works_sequence_number_check
    check (sequence_number > 0),
  constraint works_status_check
    check (status in ('draft', 'published', 'archived')),
  unique (series_id, sequence_number),
  unique (series_id, display_code)
);

comment on table public.works is 'Canonical work records across all series.';
comment on column public.works.legacy_episode_id is 'Back-reference to the imported public.episodes row when applicable.';
comment on column public.works.display_code is 'Public-facing sequence label within a series, e.g. 0001.';

create index if not exists works_series_listing_idx
  on public.works (series_id, status, sequence_number desc);

create index if not exists works_published_at_idx
  on public.works (published_at desc nulls last);

create index if not exists works_featured_idx
  on public.works (is_featured desc, sequence_number desc);

drop trigger if exists set_works_updated_at on public.works;

create trigger set_works_updated_at
before update on public.works
for each row
execute function public.set_work_records_updated_at();

create table if not exists public.work_variants (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  variant_number integer not null,
  display_code text not null,
  title text,
  caption text,
  variant_type text not null default 'image',
  original_storage_key text,
  thumbnail_storage_key text,
  width integer,
  height integer,
  status text not null default 'preparing',
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint work_variants_variant_number_check
    check (variant_number between 1 and 99),
  constraint work_variants_variant_type_check
    check (variant_type in ('image', 'scene', 'angle', 'edit')),
  constraint work_variants_status_check
    check (status in ('ready', 'preparing', 'hidden')),
  constraint work_variants_dimensions_check
    check (
      (width is null or width > 0)
      and (height is null or height > 0)
    ),
  constraint work_variants_ready_requires_original_check
    check (status <> 'ready' or original_storage_key is not null),
  unique (work_id, variant_number),
  unique (work_id, display_code),
  unique (id, work_id)
);

comment on table public.work_variants is 'Image/scene/angle variants inside a work.';
comment on column public.work_variants.display_code is 'Public-facing variant label, e.g. 0001-1.';
comment on column public.work_variants.is_primary is 'Single primary variant used by gallery list views and detail defaults.';

create index if not exists work_variants_work_sort_idx
  on public.work_variants (work_id, sort_order asc, variant_number asc);

create index if not exists work_variants_visible_idx
  on public.work_variants (work_id, status, is_primary desc);

create unique index if not exists work_variants_primary_unique
  on public.work_variants (work_id)
  where is_primary = true;

drop trigger if exists set_work_variants_updated_at on public.work_variants;

create trigger set_work_variants_updated_at
before update on public.work_variants
for each row
execute function public.set_work_records_updated_at();

create table if not exists public.work_offers (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  variant_id uuid,
  offer_type text not null,
  plan_type text not null,
  status text not null default 'preparing',
  title text,
  description text,
  target_ref text,
  target_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint work_offers_offer_type_check
    check (offer_type in ('wallpaper', 'imagine_starter', 'imagine_template', 'store_product')),
  constraint work_offers_plan_type_check
    check (plan_type in ('public', 'free', 'premium', 'paid')),
  constraint work_offers_status_check
    check (status in ('ready', 'preparing', 'requested', 'hidden')),
  constraint work_offers_ready_requires_target_check
    check (status <> 'ready' or target_ref is not null or target_url is not null),
  constraint work_offers_variant_matches_work_fk
    foreign key (variant_id, work_id)
    references public.work_variants (id, work_id)
    on delete cascade
);

comment on table public.work_offers is 'Actionable offers attached to a work or a specific variant.';
comment on column public.work_offers.target_ref is 'Internal identifier such as a club item slug or an Imagine template id.';
comment on column public.work_offers.target_url is 'Direct URL when the offer is fulfilled by an external or already-routed page.';

create index if not exists work_offers_work_sort_idx
  on public.work_offers (work_id, sort_order asc, offer_type asc);

create index if not exists work_offers_variant_sort_idx
  on public.work_offers (variant_id, sort_order asc, offer_type asc);

create unique index if not exists work_offers_work_offer_unique
  on public.work_offers (work_id, offer_type)
  where variant_id is null;

create unique index if not exists work_offers_variant_offer_unique
  on public.work_offers (variant_id, offer_type)
  where variant_id is not null;

drop trigger if exists set_work_offers_updated_at on public.work_offers;

create trigger set_work_offers_updated_at
before update on public.work_offers
for each row
execute function public.set_work_records_updated_at();

alter table public.work_series enable row level security;
alter table public.works enable row level security;
alter table public.work_variants enable row level security;
alter table public.work_offers enable row level security;

grant select on public.work_series to anon, authenticated;
grant insert, update, delete on public.work_series to authenticated;

grant select on public.works to anon, authenticated;
grant insert, update, delete on public.works to authenticated;

grant select on public.work_variants to anon, authenticated;
grant insert, update, delete on public.work_variants to authenticated;

grant select on public.work_offers to anon, authenticated;
grant insert, update, delete on public.work_offers to authenticated;

drop policy if exists "work_series_select_public" on public.work_series;
create policy "work_series_select_public"
  on public.work_series
  for select
  to anon, authenticated
  using (
    is_public = true
    or (select public.is_admin())
  );

drop policy if exists "work_series_insert_admin" on public.work_series;
create policy "work_series_insert_admin"
  on public.work_series
  for insert
  to authenticated
  with check ((select public.is_admin()));

drop policy if exists "work_series_update_admin" on public.work_series;
create policy "work_series_update_admin"
  on public.work_series
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "work_series_delete_admin" on public.work_series;
create policy "work_series_delete_admin"
  on public.work_series
  for delete
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "works_select_published" on public.works;
create policy "works_select_published"
  on public.works
  for select
  to anon, authenticated
  using (
    status = 'published'
    or (select public.is_admin())
  );

drop policy if exists "works_insert_admin" on public.works;
create policy "works_insert_admin"
  on public.works
  for insert
  to authenticated
  with check ((select public.is_admin()));

drop policy if exists "works_update_admin" on public.works;
create policy "works_update_admin"
  on public.works
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "works_delete_admin" on public.works;
create policy "works_delete_admin"
  on public.works
  for delete
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "work_variants_select_visible" on public.work_variants;
create policy "work_variants_select_visible"
  on public.work_variants
  for select
  to anon, authenticated
  using (
    (
      status in ('ready', 'preparing')
      and exists (
        select 1
        from public.works w
        where w.id = work_variants.work_id
          and w.status = 'published'
      )
    )
    or (select public.is_admin())
  );

drop policy if exists "work_variants_insert_admin" on public.work_variants;
create policy "work_variants_insert_admin"
  on public.work_variants
  for insert
  to authenticated
  with check ((select public.is_admin()));

drop policy if exists "work_variants_update_admin" on public.work_variants;
create policy "work_variants_update_admin"
  on public.work_variants
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "work_variants_delete_admin" on public.work_variants;
create policy "work_variants_delete_admin"
  on public.work_variants
  for delete
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "work_offers_select_visible" on public.work_offers;
create policy "work_offers_select_visible"
  on public.work_offers
  for select
  to anon, authenticated
  using (
    (
      status in ('ready', 'preparing', 'requested')
      and exists (
        select 1
        from public.works w
        where w.id = work_offers.work_id
          and w.status = 'published'
      )
      and (
        variant_id is null
        or exists (
          select 1
          from public.work_variants v
          where v.id = work_offers.variant_id
            and v.status in ('ready', 'preparing')
        )
      )
    )
    or (select public.is_admin())
  );

drop policy if exists "work_offers_insert_admin" on public.work_offers;
create policy "work_offers_insert_admin"
  on public.work_offers
  for insert
  to authenticated
  with check ((select public.is_admin()));

drop policy if exists "work_offers_update_admin" on public.work_offers;
create policy "work_offers_update_admin"
  on public.work_offers
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "work_offers_delete_admin" on public.work_offers;
create policy "work_offers_delete_admin"
  on public.work_offers
  for delete
  to authenticated
  using ((select public.is_admin()));

insert into public.work_series (
  slug,
  name,
  route_base,
  number_padding,
  sort_order,
  is_public
)
values
  ('episode', 'Episode', '/works/episode', 4, 10, true),
  ('reel', 'Reel', '/works/reel', 4, 20, true),
  ('experiment', 'Experiment', '/works/experiment', 4, 30, true),
  ('remix', 'Remix', '/works/remix', 4, 40, true)
on conflict (slug) do update
set
  name = excluded.name,
  route_base = excluded.route_base,
  number_padding = excluded.number_padding,
  sort_order = excluded.sort_order,
  is_public = excluded.is_public,
  updated_at = timezone('utc'::text, now());

with episode_series as (
  select id
  from public.work_series
  where slug = 'episode'
)
insert into public.works (
  series_id,
  legacy_episode_id,
  sequence_number,
  display_code,
  slug,
  title,
  theme_category,
  released_on,
  status,
  published_at,
  created_at,
  updated_at
)
select
  s.id,
  e.id,
  e.id,
  e.number,
  'episode-' || e.number,
  e.title,
  e.category,
  e.released_on,
  case when e.is_published then 'published' else 'draft' end,
  coalesce(e.published_at, case when e.is_published then e.created_at else null end),
  e.created_at,
  e.updated_at
from public.episodes e
cross join episode_series s
on conflict (legacy_episode_id) do update
set
  series_id = excluded.series_id,
  sequence_number = excluded.sequence_number,
  display_code = excluded.display_code,
  slug = excluded.slug,
  title = excluded.title,
  theme_category = excluded.theme_category,
  released_on = excluded.released_on,
  status = excluded.status,
  published_at = excluded.published_at,
  updated_at = excluded.updated_at;

insert into public.work_variants (
  work_id,
  variant_number,
  display_code,
  title,
  variant_type,
  original_storage_key,
  thumbnail_storage_key,
  status,
  sort_order,
  is_primary,
  created_at,
  updated_at
)
select
  w.id,
  1,
  e.number || '-1',
  e.title,
  'image',
  e.original_storage_key,
  e.thumbnail_storage_key,
  case when e.is_published then 'ready' else 'hidden' end,
  1,
  true,
  e.created_at,
  e.updated_at
from public.episodes e
join public.works w
  on w.legacy_episode_id = e.id
on conflict (work_id, variant_number) do update
set
  display_code = excluded.display_code,
  title = excluded.title,
  variant_type = excluded.variant_type,
  original_storage_key = excluded.original_storage_key,
  thumbnail_storage_key = excluded.thumbnail_storage_key,
  status = excluded.status,
  sort_order = excluded.sort_order,
  is_primary = excluded.is_primary,
  updated_at = excluded.updated_at;

insert into public.work_offers (
  work_id,
  variant_id,
  offer_type,
  plan_type,
  status,
  title,
  description,
  target_url,
  sort_order,
  created_at,
  updated_at
)
select
  w.id,
  v.id,
  'store_product',
  'paid',
  case when e.is_published then 'ready' else 'hidden' end,
  'Legacy store item',
  'Imported from public.episodes.product_url',
  e.product_url,
  1,
  e.created_at,
  e.updated_at
from public.episodes e
join public.works w
  on w.legacy_episode_id = e.id
join public.work_variants v
  on v.work_id = w.id
 and v.variant_number = 1
where e.product_url is not null
  and btrim(e.product_url) <> ''
  and not exists (
    select 1
    from public.work_offers o
    where o.variant_id = v.id
      and o.offer_type = 'store_product'
  );
