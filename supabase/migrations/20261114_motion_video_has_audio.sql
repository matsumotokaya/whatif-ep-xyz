-- Motion works may keep their soundtrack on the detail page (user decision,
-- per video). Card previews are always silent. The detail player starts muted
-- (browser autoplay policy) and shows an unmute button only when this is true.
alter table public.work_variants
  add column if not exists video_has_audio boolean not null default false;

comment on column public.work_variants.video_has_audio is
  'True when video_storage_key keeps an audio track (detail page shows an unmute button).';
