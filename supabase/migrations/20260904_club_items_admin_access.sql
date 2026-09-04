-- Let admins read the published Club catalog without a premium subscription.
--
-- Premium is an entitlement to *use* premium features; admins operate the
-- catalog itself and need the same read access. Deciding this on role keeps the
-- billing columns honest: writing subscription_tier = 'premium' by hand would be
-- undone on the next /account visit for any profile that has a
-- stripe_customer_id (see reconcileAccountSubscription in
-- src/lib/account/membership.ts), and it would misreport the account as paying.
--
-- Mirrors hasPremiumFeatureAccess() in src/lib/access/entitlement.ts. This is
-- the only RLS policy in the database that reads subscription_tier.

alter policy club_items_select_premium on public.club_items
using (
  is_published = true
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and (p.subscription_tier = 'premium' or p.role = 'admin')
  )
);
