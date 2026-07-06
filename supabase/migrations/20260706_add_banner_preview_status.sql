alter table public.banners
  add column if not exists preview_status text not null default 'pending',
  add column if not exists preview_source text not null default 'none',
  add column if not exists preview_error text;

alter table public.banners
  drop constraint if exists banners_preview_status_check;

alter table public.banners
  add constraint banners_preview_status_check
  check (preview_status in ('pending', 'ready', 'failed'));

alter table public.banners
  drop constraint if exists banners_preview_source_check;

alter table public.banners
  add constraint banners_preview_source_check
  check (preview_source in ('none', 'template', 'generated'));

update public.banners
set
  preview_status = case
    when coalesce(thumbnail_key, thumbnail_url) is not null then 'ready'
    when coalesce(template->>'thumbnail', '') <> '' then 'pending'
    else 'pending'
  end,
  preview_source = case
    when thumbnail_key like 'user-images/%/banners/%' then 'generated'
    when coalesce(thumbnail_key, thumbnail_url) is not null then 'generated'
    when coalesce(template->>'thumbnail', '') <> '' then 'template'
    else 'none'
  end,
  preview_error = null
where true;
