-- Revision the canonical banner document and its derived preview independently.
-- Preview files are still rendered by the browser in this phase, but an old
-- upload can no longer become current after a newer document save wins.

-- Keep this migration self-contained. Some existing environments have the
-- banners table but do not have the earlier preview-status migration recorded.
alter table public.banners
  add column if not exists preview_status text not null default 'pending',
  add column if not exists preview_source text not null default 'none',
  add column if not exists preview_error text;

alter table public.banners
  drop constraint if exists banners_preview_status_check,
  drop constraint if exists banners_preview_source_check;

alter table public.banners
  add constraint banners_preview_status_check
    check (preview_status in ('pending', 'ready', 'failed')),
  add constraint banners_preview_source_check
    check (preview_source in ('none', 'template', 'generated'));

-- Only fill states that still carry the column defaults. Never overwrite an
-- explicit failed/pending state from an environment that already uses them.
update public.banners
set
  preview_status = case
    when preview_status = 'pending'
      and preview_source = 'none'
      and preview_error is null
      and coalesce(thumbnail_key, thumbnail_url) is not null
      then 'ready'
    else preview_status
  end,
  preview_source = case
    when preview_source = 'none'
      and coalesce(thumbnail_key, thumbnail_url) is not null
      then 'generated'
    when preview_source = 'none'
      and coalesce(template->>'thumbnail', '') <> ''
      then 'template'
    else preview_source
  end
where preview_status = 'pending'
   or preview_source = 'none';

alter table public.banners
  add column if not exists document_revision bigint not null default 1,
  add column if not exists preview_revision bigint not null default 0,
  add column if not exists preview_requested_at timestamptz,
  add column if not exists preview_completed_at timestamptz;

-- A template thumbnail is a valid ready fallback for untouched legacy
-- documents. These rows never requested generated preview work, so leaving
-- them pending would show an "updating" state forever.
update public.banners
set preview_status = 'ready'
where preview_status = 'pending'
  and preview_source = 'template'
  and preview_error is null
  and preview_requested_at is null
  and coalesce(template->>'thumbnail', '') <> '';

update public.banners
set
  document_revision = greatest(document_revision, 1),
  preview_revision = case
    when preview_status = 'ready'
      and (
        coalesce(thumbnail_key, thumbnail_url) is not null
        or (
          preview_source = 'template'
          and coalesce(template->>'thumbnail', '') <> ''
        )
      )
      then greatest(document_revision, 1)
    else least(preview_revision, greatest(document_revision, 1))
  end,
  preview_completed_at = case
    when preview_status = 'ready'
      and (
        coalesce(thumbnail_key, thumbnail_url) is not null
        or (
          preview_source = 'template'
          and coalesce(template->>'thumbnail', '') <> ''
        )
      )
      then coalesce(preview_completed_at, updated_at)
    else preview_completed_at
  end
where true;

alter table public.banners
  drop constraint if exists banners_document_revision_check,
  drop constraint if exists banners_preview_revision_check;

alter table public.banners
  add constraint banners_document_revision_check
    check (document_revision >= 1),
  add constraint banners_preview_revision_check
    check (preview_revision >= 0 and preview_revision <= document_revision);

comment on column public.banners.document_revision is
  'Monotonic revision of the canonical template/elements/canvas document.';
comment on column public.banners.preview_revision is
  'Document revision represented by the current ready preview assets.';
comment on column public.banners.preview_requested_at is
  'Time at which preview generation was requested for the current document.';
comment on column public.banners.preview_completed_at is
  'Time at which the last ready preview assets were committed.';

create index if not exists banners_pending_preview_idx
  on public.banners (preview_requested_at asc)
  where preview_status = 'pending';

create or replace function public.save_banner_document(
  p_banner_id uuid,
  p_elements jsonb,
  p_canvas_color text,
  p_template jsonb
)
returns setof public.banners
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return query
  update public.banners
  set
    elements = coalesce(p_elements, elements),
    canvas_color = coalesce(p_canvas_color, canvas_color),
    template = coalesce(p_template, template),
    document_revision = document_revision + 1,
    preview_status = 'pending',
    preview_error = null,
    preview_requested_at = timezone('utc'::text, now()),
    updated_at = timezone('utc'::text, now())
  where id = p_banner_id
    and user_id = (select auth.uid())
  returning public.banners.*;
end;
$$;

create or replace function public.finalize_banner_preview(
  p_banner_id uuid,
  p_document_revision bigint,
  p_thumbnail_key text,
  p_fullres_key text
)
returns setof public.banners
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return query
  update public.banners
  set
    thumbnail_key = coalesce(p_thumbnail_key, thumbnail_key),
    fullres_key = coalesce(p_fullres_key, fullres_key),
    preview_revision = p_document_revision,
    preview_status = 'ready',
    preview_source = 'generated',
    preview_error = null,
    preview_completed_at = timezone('utc'::text, now()),
    updated_at = timezone('utc'::text, now())
  where id = p_banner_id
    and user_id = (select auth.uid())
    and document_revision = p_document_revision
  returning public.banners.*;
end;
$$;

create or replace function public.fail_banner_preview(
  p_banner_id uuid,
  p_document_revision bigint,
  p_error text
)
returns setof public.banners
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return query
  update public.banners
  set
    preview_status = 'failed',
    preview_error = left(coalesce(p_error, 'Preview generation failed.'), 1000),
    updated_at = timezone('utc'::text, now())
  where id = p_banner_id
    and user_id = (select auth.uid())
    and document_revision = p_document_revision
  returning public.banners.*;
end;
$$;

-- Supabase grants new public-schema functions to anon/authenticated/service_role
-- through default privileges. Revoke every implicit API role explicitly, then
-- expose this user-owned browser save path only to signed-in users.
revoke all on function public.save_banner_document(uuid, jsonb, text, jsonb)
  from PUBLIC, anon, service_role;
revoke all on function public.finalize_banner_preview(uuid, bigint, text, text)
  from PUBLIC, anon, service_role;
revoke all on function public.fail_banner_preview(uuid, bigint, text)
  from PUBLIC, anon, service_role;

grant execute on function public.save_banner_document(uuid, jsonb, text, jsonb) to authenticated;
grant execute on function public.finalize_banner_preview(uuid, bigint, text, text) to authenticated;
grant execute on function public.fail_banner_preview(uuid, bigint, text) to authenticated;
