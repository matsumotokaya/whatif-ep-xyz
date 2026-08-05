-- A financial ledger must retain every paid Stripe Checkout Session. The old
-- partial unique index prevented a second completed payment for the same
-- signed-in user and wallpaper from being recorded, even though Stripe had
-- already charged it. Entitlement queries already use EXISTS semantics, so
-- duplicate paid rows are safe and preserve the accounting trail.
drop index if exists public.wallpaper_purchases_user_wallpaper_paid_uidx;

create index if not exists wallpaper_purchases_user_wallpaper_status_idx
  on public.wallpaper_purchases (user_id, wallpaper_id, status);
