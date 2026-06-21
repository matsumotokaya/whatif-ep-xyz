-- Retain wallpaper_purchases (financial records) when a user/profile is deleted.
--
-- Previously wallpaper_purchases.user_id was NOT NULL with an ON DELETE CASCADE
-- FK to profiles, so deleting an account also removed the purchase rows. Make
-- user_id nullable and switch the FK to ON DELETE SET NULL so the rows survive
-- (orphaned, with user_id nulled) — the Stripe payment/intent ids, amount, and
-- currency remain available for accounting after the account is gone.

alter table public.wallpaper_purchases
  alter column user_id drop not null;

alter table public.wallpaper_purchases
  drop constraint wallpaper_purchases_user_id_fkey;

alter table public.wallpaper_purchases
  add constraint wallpaper_purchases_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;
