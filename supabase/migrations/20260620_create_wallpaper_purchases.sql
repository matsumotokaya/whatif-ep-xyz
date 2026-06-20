-- Wallpaper one-time purchases (Stripe Checkout, mode=payment).
-- Separate from the IMAGINE premium subscription. One row = one paid wallpaper pack.
create table if not exists public.wallpaper_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  wallpaper_id uuid not null,
  series_slug text,
  display_code text,
  variant_number integer,
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text,
  amount integer,
  currency text,
  status text not null default 'paid'
    check (status in ('pending', 'paid', 'refunded', 'failed')),
  purchased_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists wallpaper_purchases_user_wallpaper_paid_uidx
  on public.wallpaper_purchases (user_id, wallpaper_id)
  where status = 'paid';

create index if not exists wallpaper_purchases_user_idx
  on public.wallpaper_purchases (user_id);

alter table public.wallpaper_purchases enable row level security;

create policy "wallpaper_purchases_select_own"
  on public.wallpaper_purchases for select
  using (auth.uid() = user_id);
