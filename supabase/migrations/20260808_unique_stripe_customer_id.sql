-- Billing rebuild Phase B0-c: make one Stripe customer belong to exactly one profile.
--
-- Background (docs/BILLING_REBUILD_PLAN.md "Phase B1 / 突合結果"):
-- cus_Tz3oVVH4RyExCc was held by two different profiles at once. That is not
-- merely bad data: loadProfile() in src/lib/subscription-sync.ts resolves a
-- profile by stripe_customer_id with .maybeSingle(), which errors on multiple
-- rows and makes the webhook return 500 forever. It also lets
-- src/app/api/subscription/checkout/route.ts attach a new subscription to
-- another user's Stripe customer.
--
-- PRECONDITION: no duplicate values may remain, or this migration fails.
-- Verify first:
--   select stripe_customer_id, count(*) from public.profiles
--   where stripe_customer_id is not null
--   group by stripe_customer_id having count(*) > 1;
-- The result must be empty.

-- One Stripe customer maps to at most one profile. Partial index so the many
-- profiles without a Stripe customer (NULL) are unconstrained, matching the
-- existing profiles_legacy_login_id_unique convention.
create unique index if not exists profiles_stripe_customer_id_unique
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

-- Defence in depth. auth.users already enforces email uniqueness upstream, but
-- public.profiles is written by the service-role client, which bypasses that.
create unique index if not exists profiles_email_unique
  on public.profiles (email)
  where email is not null;
