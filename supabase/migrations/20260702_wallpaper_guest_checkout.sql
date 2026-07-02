-- Guest checkout for wallpaper packs (login-free one-time purchase).
--
-- Adds two columns to public.wallpaper_purchases:
--   1. buyer_email    — email collected by Stripe Checkout. Recorded for both
--                       guest purchases (user_id is null) and signed-in
--                       purchases, so the download-link email always has a
--                       destination.
--   2. download_token — unguessable per-purchase token that authorizes the
--                       zip download without a login session. The app
--                       generates it (crypto-random 32 bytes, hex); the
--                       volatile column default backfills every existing row
--                       with its own distinct token and covers any legacy
--                       insert path.
--
-- Notes:
--   * user_id is already nullable with FK -> public.profiles(id) ON DELETE
--     SET NULL (20260621 migration), so guest rows need no FK change.
--   * The partial unique index (user_id, wallpaper_id) WHERE status='paid'
--     does not constrain guest rows (NULLs never conflict) — a guest may buy
--     the same pack twice; each purchase gets its own row and token.
--   * RLS: the existing "wallpaper_purchases_select_own" policy
--     (auth.uid() = user_id) is unchanged. Guest rows (user_id is null) are
--     invisible to every authenticated user; all guest-token reads and all
--     purchase writes go through the service-role client, which bypasses RLS.
--     No policy referencing auth.users is added.

alter table public.wallpaper_purchases
  add column if not exists buyer_email text;

alter table public.wallpaper_purchases
  add column if not exists download_token text not null
    default encode(extensions.gen_random_bytes(32), 'hex');

create unique index if not exists wallpaper_purchases_download_token_uidx
  on public.wallpaper_purchases (download_token);
