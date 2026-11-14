-- Motion series: short animated works (formerly Instagram reels).
--
-- 1. Rename the unused "reel" series (0 works) to "motion".
-- 2. Let a work variant carry a video. The poster image stays in
--    original_storage_key / thumbnail_storage_key, so every image-only code
--    path (cards, OG image, Ref Library) keeps working unchanged; video-aware
--    UI reads the two new columns. Both store full public URLs on
--    assets.whatif-ep.xyz (resolveAssetUrl passes full URLs through).
--    Videos are published without audio (music rights; muted autoplay).

update public.work_series
set slug = 'motion',
    name = 'Motion',
    route_base = '/works/motion',
    updated_at = timezone('utc'::text, now())
where slug = 'reel'
  and not exists (select 1 from public.works w where w.series_id = work_series.id);

alter table public.work_variants
  add column if not exists video_storage_key text,
  add column if not exists video_preview_storage_key text;

alter table public.work_variants
  drop constraint work_variants_variant_type_check,
  add constraint work_variants_variant_type_check
    check (variant_type = any (array['image'::text, 'scene'::text, 'angle'::text, 'edit'::text, 'video'::text]));

comment on column public.work_variants.video_storage_key is
  'Full-size silent H.264 MP4 (public URL) for the detail page. Poster stays in original_storage_key.';
comment on column public.work_variants.video_preview_storage_key is
  'Small silent H.264 MP4 (public URL) autoplayed muted on gallery cards.';
