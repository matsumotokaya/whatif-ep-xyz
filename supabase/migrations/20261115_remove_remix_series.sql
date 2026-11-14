-- Remove the never-used "remix" series (shown as "Coming soon"). Remix works
-- now live in the Experiment series, tagged "Remix" (2026-11-15 user decision).
-- Guarded: only deletes while the series has no works or Content Factory data.
delete from public.work_series ws
where ws.slug = 'remix'
  and not exists (select 1 from public.works w where w.series_id = ws.id)
  and not exists (select 1 from public.production_projects pp where pp.work_series_slug = 'remix')
  and not exists (select 1 from public.default_images di where di.work_series_slug = 'remix');
