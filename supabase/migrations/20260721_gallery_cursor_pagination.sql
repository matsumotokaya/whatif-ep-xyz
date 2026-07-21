-- Gallery list read model: keyset pagination over published works.
--
-- The current application loads and enriches every work in a series before it
-- slices a 20-card page. These service-role-only functions make Postgres select
-- the bounded page first and enrich only those rows. No source tables or RLS
-- policies are changed.

create or replace function public.get_gallery_work_cards_page(
  p_series_slug text,
  p_sort text default 'newest',
  p_limit integer default 20,
  p_cursor_sequence integer default null,
  p_range_start integer default null,
  p_range_end integer default null,
  p_tag_slug text default null,
  p_wallpaper_only boolean default false,
  p_ids uuid[] default null
)
returns table (
  work_id uuid,
  series_slug text,
  display_code text,
  title text,
  theme_category text,
  sequence_number integer,
  variant_id uuid,
  variant_number integer,
  thumbnail_storage_key text,
  original_storage_key text,
  variant_updated_at timestamptz,
  feed_storage_provider text,
  feed_storage_bucket text,
  feed_storage_path text,
  feed_thumb_storage_provider text,
  feed_thumb_storage_bucket text,
  feed_thumb_storage_path text,
  tags jsonb,
  has_wallpaper_offer boolean,
  has_starter_offer boolean,
  total_count bigint
)
language sql
stable
set search_path = ''
as $$
  with requested_series as (
    select ws.id, ws.slug
    from public.work_series ws
    where ws.slug = p_series_slug
      and ws.is_public = true
    limit 1
  ),
  filtered_works as materialized (
    select
      w.id,
      rs.slug as series_slug,
      w.display_code,
      w.title,
      w.theme_category,
      w.sequence_number
    from public.works w
    join requested_series rs on rs.id = w.series_id
    where w.status = 'published'
      and (p_range_start is null or w.sequence_number >= p_range_start)
      and (p_range_end is null or w.sequence_number <= p_range_end)
      and (p_ids is null or w.id = any(p_ids))
      and (
        p_tag_slug is null
        or exists (
          select 1
          from public.work_tag_map wtm
          join public.work_tags wt on wt.id = wtm.tag_id
          where wtm.work_id = w.id
            and wt.slug = p_tag_slug
        )
      )
      and (
        not p_wallpaper_only
        or exists (
          select 1
          from public.work_variants filter_variant
          join public.work_offers filter_offer
            on filter_offer.variant_id = filter_variant.id
          where filter_variant.work_id = w.id
            and filter_variant.is_primary = true
            and filter_variant.status in ('ready', 'preparing')
            and filter_offer.offer_type = 'wallpaper'
            and filter_offer.status in ('ready', 'preparing', 'requested')
        )
      )
  ),
  page_works as (
    select fw.*
    from filtered_works fw
    where p_cursor_sequence is null
      or (p_sort = 'oldest' and fw.sequence_number > p_cursor_sequence)
      or (p_sort <> 'oldest' and fw.sequence_number < p_cursor_sequence)
    order by
      case when p_sort = 'oldest' then fw.sequence_number end asc,
      case when p_sort <> 'oldest' then fw.sequence_number end desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50) + 1
  )
  select
    pw.id as work_id,
    pw.series_slug,
    pw.display_code,
    pw.title,
    pw.theme_category,
    pw.sequence_number,
    primary_variant.id as variant_id,
    primary_variant.variant_number,
    primary_variant.thumbnail_storage_key,
    primary_variant.original_storage_key,
    primary_variant.updated_at as variant_updated_at,
    production_images.feed_storage_provider,
    production_images.feed_storage_bucket,
    production_images.feed_storage_path,
    production_images.feed_thumb_storage_provider,
    production_images.feed_thumb_storage_bucket,
    production_images.feed_thumb_storage_path,
    tag_data.tags,
    exists (
      select 1
      from public.work_offers wallpaper_offer
      where wallpaper_offer.variant_id = primary_variant.id
        and wallpaper_offer.offer_type = 'wallpaper'
        and wallpaper_offer.status in ('ready', 'preparing', 'requested')
    ) as has_wallpaper_offer,
    exists (
      select 1
      from public.work_offers starter_offer
      where starter_offer.variant_id = primary_variant.id
        and starter_offer.offer_type = 'imagine_starter'
        and starter_offer.status in ('ready', 'preparing', 'requested')
    ) as has_starter_offer,
    (select count(*) from filtered_works) as total_count
  from page_works pw
  left join lateral (
    select
      wv.id,
      wv.variant_number,
      wv.thumbnail_storage_key,
      wv.original_storage_key,
      wv.updated_at
    from public.work_variants wv
    where wv.work_id = pw.id
      and wv.status in ('ready', 'preparing')
    order by wv.is_primary desc, wv.sort_order asc, wv.variant_number asc
    limit 1
  ) primary_variant on true
  left join lateral (
    select
      max(po.storage_provider) filter (where po.role = 'instagram_feed')
        as feed_storage_provider,
      max(po.storage_bucket) filter (where po.role = 'instagram_feed')
        as feed_storage_bucket,
      max(po.storage_path) filter (where po.role = 'instagram_feed')
        as feed_storage_path,
      max(po.storage_provider) filter (where po.role = 'feed_thumb')
        as feed_thumb_storage_provider,
      max(po.storage_bucket) filter (where po.role = 'feed_thumb')
        as feed_thumb_storage_bucket,
      max(po.storage_path) filter (where po.role = 'feed_thumb')
        as feed_thumb_storage_path
    from public.production_projects pp
    join public.production_outputs po on po.project_id = pp.id
    where pp.work_series_slug = pw.series_slug
      and pp.work_number = pw.sequence_number
      and pp.variant_number = primary_variant.variant_number
      and pp.status = 'published'
      and po.role in ('instagram_feed', 'feed_thumb')
      and po.status = 'ready'
      and po.is_current = true
  ) production_images on true
  left join lateral (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', wt.id,
          'slug', wt.slug,
          'label', wt.label,
          'tagType', wt.tag_type
        )
        order by wt.label, wt.slug
      ),
      '[]'::jsonb
    ) as tags
    from public.work_tag_map wtm
    join public.work_tags wt on wt.id = wtm.tag_id
    where wtm.work_id = pw.id
  ) tag_data on true
  order by
    case when p_sort = 'oldest' then pw.sequence_number end asc,
    case when p_sort <> 'oldest' then pw.sequence_number end desc;
$$;

revoke all on function public.get_gallery_work_cards_page(
  text, text, integer, integer, integer, integer, text, boolean, uuid[]
) from public, anon, authenticated;
grant execute on function public.get_gallery_work_cards_page(
  text, text, integer, integer, integer, integer, text, boolean, uuid[]
) to service_role;

create or replace function public.get_gallery_work_filter_meta(
  p_series_slug text
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with visible_works as materialized (
    select w.id, w.sequence_number
    from public.works w
    join public.work_series ws on ws.id = w.series_id
    where ws.slug = p_series_slug
      and ws.is_public = true
      and w.status = 'published'
  ),
  stats as (
    select
      count(*)::bigint as total,
      coalesce(max(vw.sequence_number), 0)::integer as max_sequence
    from visible_works vw
  ),
  tag_counts as (
    select
      wt.slug,
      wt.label,
      count(*)::bigint as count
    from visible_works vw
    join public.work_tag_map wtm on wtm.work_id = vw.id
    join public.work_tags wt on wt.id = wtm.tag_id
    group by wt.slug, wt.label
    order by count(*) desc, wt.label asc, wt.slug asc
  )
  select jsonb_build_object(
    'total', stats.total,
    'maxSequence', stats.max_sequence,
    'tagFilters', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', tc.slug,
            'label', tc.label,
            'count', tc.count
          )
          order by tc.count desc, tc.label asc, tc.slug asc
        )
        from tag_counts tc
      ),
      '[]'::jsonb
    )
  )
  from stats;
$$;

revoke all on function public.get_gallery_work_filter_meta(text)
  from public, anon, authenticated;
grant execute on function public.get_gallery_work_filter_meta(text)
  to service_role;
