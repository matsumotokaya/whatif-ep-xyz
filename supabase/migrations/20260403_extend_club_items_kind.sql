-- Extend club_items.kind to include "book".

alter table public.club_items
  drop constraint if exists club_items_kind_check;

alter table public.club_items
  add constraint club_items_kind_check
  check (kind in ('wallpaper', 'zip', 'reel', 'other', 'book'));
