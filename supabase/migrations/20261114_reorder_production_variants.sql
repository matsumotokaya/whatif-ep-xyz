-- Content Factory: reorder a work's variant numbers (枝番) atomically.
--
-- Called from /mydesign/factory with the complete, desired order of every
-- production project of one work. Position 1 becomes variant 1 (primary),
-- position N becomes variant N. Drafts and published variants are handled
-- together, so public URLs such as ?variant=2 follow the new numbering.
--
-- Output files are stored under the project id (…/production/<project_id>/…),
-- so no storage objects move. Rendered images do not contain the variant
-- number (the feed credit is "EP0473" only).
--
-- The unique constraints on (work_id, variant_number) and
-- (project_type, work_series_slug, work_number, variant_number) stay
-- non-deferrable because app code upserts on them (ON CONFLICT cannot use a
-- deferrable constraint). Rows are therefore moved through temporary numbers
-- (99-N+1 … 99) first, one row per statement, then to their final numbers.
--
-- Safety:
-- - admin only (public.is_admin()).
-- - all of the work's projects and variants are locked FOR UPDATE, so
--   concurrent reorders / publishes serialize instead of producing duplicates.
-- - the caller must send exactly the current set of projects; a stale list
--   (a project was added/removed meanwhile) is rejected.
-- - refuses when wallpaper purchases exist for a variant whose number would
--   change, so billing records are never rewritten by this function.
-- - any failure rolls back the whole call (single transaction).

create or replace function public.reorder_production_variants(
  p_series_slug text,
  p_work_number integer,
  p_project_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := coalesce(array_length(p_project_ids, 1), 0);
  v_current_ids uuid[];
  v_requested_ids uuid[];
  v_display_code text;
  v_work_id uuid;
  v_max_current integer;
  v_temp_base integer;
  v_project record;
  v_variant_id uuid;
  i integer;
begin
  if not public.is_admin() then
    raise exception 'reorder_production_variants: admin only'
      using errcode = '42501';
  end if;

  if v_count = 0 then
    raise exception 'reorder_production_variants: p_project_ids is empty';
  end if;
  if v_count > 49 then
    raise exception 'reorder_production_variants: too many variants (%)', v_count;
  end if;

  select array_agg(distinct x order by x) into v_requested_ids
  from unnest(p_project_ids) as x;
  if coalesce(array_length(v_requested_ids, 1), 0) <> v_count then
    raise exception 'reorder_production_variants: duplicate project ids';
  end if;

  -- Lock every project of the work, then compare with the requested set.
  perform 1
  from public.production_projects pp
  where pp.project_type = 'variant_pack'
    and pp.work_series_slug = p_series_slug
    and pp.work_number = p_work_number
  for update;

  select
    array_agg(pp.id order by pp.id),
    max(pp.variant_number),
    min(pp.work_display_code)
  into v_current_ids, v_max_current, v_display_code
  from public.production_projects pp
  where pp.project_type = 'variant_pack'
    and pp.work_series_slug = p_series_slug
    and pp.work_number = p_work_number;

  if v_current_ids is null or v_current_ids <> v_requested_ids then
    raise exception 'reorder_production_variants: project list is stale, reload and try again'
      using errcode = 'P0001', hint = 'stale_project_list';
  end if;

  select w.id into v_work_id
  from public.works w
  join public.work_series ws on ws.id = w.series_id
  where ws.slug = p_series_slug
    and w.sequence_number = p_work_number;

  if v_work_id is not null then
    perform 1 from public.work_variants wv where wv.work_id = v_work_id for update;

    -- Every canonical variant must belong to one of the projects; an unlinked
    -- variant keeps its number and could collide with the new numbering.
    if exists (
      select 1
      from public.work_variants wv
      where wv.work_id = v_work_id
        and not exists (
          select 1
          from public.production_projects pp
          where pp.variant_id = wv.id
            and pp.id = any(p_project_ids)
        )
    ) then
      raise exception 'reorder_production_variants: work % has variants without a Content Factory project', v_display_code;
    end if;

    select greatest(v_max_current, coalesce(max(wv.variant_number), 0))
    into v_max_current
    from public.work_variants wv
    where wv.work_id = v_work_id;
  end if;

  -- Never rewrite billing records: refuse if a purchased variant would move.
  if exists (
    select 1
    from unnest(p_project_ids) with ordinality as req(project_id, new_number)
    join public.production_projects pp on pp.id = req.project_id
    join public.wallpaper_purchases wp
      on wp.series_slug = p_series_slug
     and wp.display_code = v_display_code
     and wp.variant_number = pp.variant_number
    where pp.variant_number <> req.new_number
  ) then
    raise exception 'reorder_production_variants: wallpaper purchases exist for a variant that would be renumbered'
      using hint = 'purchases_exist';
  end if;

  v_temp_base := 99 - v_count;
  if v_max_current > v_temp_base then
    raise exception 'reorder_production_variants: current variant numbers too high to reorder safely (max %)', v_max_current;
  end if;

  -- Phase 1: move everything to temporary numbers above the current range.
  if v_work_id is not null then
    update public.work_variants
    set is_primary = false
    where work_id = v_work_id and is_primary;
  end if;

  for i in 1..v_count loop
    update public.production_projects
    set variant_number = v_temp_base + i
    where id = p_project_ids[i]
    returning variant_id into v_variant_id;

    if v_variant_id is not null then
      update public.work_variants
      set variant_number = v_temp_base + i,
          display_code = v_display_code || '-tmp' || i
      where id = v_variant_id;
    end if;
  end loop;

  -- Phase 2: final numbers and every place that mirrors them.
  for i in 1..v_count loop
    select pp.id, pp.variant_id
    into v_project
    from public.production_projects pp
    where pp.id = p_project_ids[i];

    update public.production_projects
    set variant_number = i,
        title = regexp_replace(title, v_display_code || '-[0-9]+', v_display_code || '-' || i)
    where id = v_project.id;

    update public.default_images di
    set variant_number = i
    from public.production_project_assets ppa
    where ppa.project_id = v_project.id
      and ppa.default_image_id = di.id;

    update public.banners b
    set name = regexp_replace(b.name, v_display_code || '-[0-9]+', v_display_code || '-' || i)
    from public.production_project_banners ppb
    where ppb.project_id = v_project.id
      and ppb.banner_id = b.id
      and b.name ~ (v_display_code || '-[0-9]+');

    update public.templates t
    set name = regexp_replace(t.name, v_display_code || '-[0-9]+', v_display_code || '-' || i)
    where t.production_project_id = v_project.id
      and t.name ~ (v_display_code || '-[0-9]+');

    if v_project.variant_id is not null then
      update public.work_variants
      set variant_number = i,
          display_code = v_display_code || '-' || i,
          sort_order = i,
          is_primary = (i = 1)
      where id = v_project.variant_id;

      update public.work_offers
      set target_url = '/works/' || p_series_slug || '/' || v_display_code || '/wallpaper'
        || case when i > 1 then '?variant=' || i else '' end
      where variant_id = v_project.variant_id
        and offer_type = 'wallpaper'
        and target_url like '/works/%/wallpaper%';
    end if;
  end loop;
end;
$$;

revoke all on function public.reorder_production_variants(text, integer, uuid[]) from public, anon;
grant execute on function public.reorder_production_variants(text, integer, uuid[]) to authenticated;

comment on function public.reorder_production_variants(text, integer, uuid[]) is
  'Content Factory: atomically renumber all variants (枝番) of one work in the given project order. Admin only.';
