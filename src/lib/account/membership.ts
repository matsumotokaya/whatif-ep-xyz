import "server-only";

import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getStripe, getSubscriptionPriceId } from "@/lib/stripe";
import { syncCustomerSubscriptionState } from "@/lib/subscription-sync";

// Full profile row needed for the account (My Page) screen. This is a superset
// of ClubProfile in @/lib/club/access — it adds Stripe and legacy fields that
// the account page uses to render membership state and the billing portal CTA.
export interface AccountProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  subscription_tier: "free" | "premium" | null;
  subscription_status: "active" | "canceling" | "canceled" | null;
  subscription_expires_at: string | null;
  stripe_customer_id: string | null;
  legacy_login_id: string | null;
  created_at: string | null;
}

// Membership classification used by the UI. Mirrors the model documented in the
// README "The Club account model": premium can come from a Stripe subscription,
// a migrated legacy member, or a linked /IMAGINE premium account.
export type MembershipKind =
  | "free"
  | "stripe_premium"
  | "legacy_premium"
  | "imagine_premium";

export interface AccountData {
  user: User;
  profile: AccountProfile | null;
  membership: MembershipKind;
  // True only when a Stripe customer exists — gates the billing portal CTA.
  hasStripeCustomer: boolean;
  // Auth provider(s) backing the account (e.g. "google", "email").
  providers: string[];
  displayName: string;
}

// The webhook remains the normal path for subscription changes. Reconcile when
// rendering My Page as well, so a delayed delivery cannot leave a member with
// an alarming, stale "Renews on" message after they have scheduled a cancel.
// Only Stripe-backed accounts enter this path; legacy and manually granted
// Premium access are intentionally never inferred from Stripe.
export async function reconcileAccountSubscription(
  account: AccountData
): Promise<AccountData> {
  const customerId = account.profile?.stripe_customer_id;
  const priceId = getSubscriptionPriceId();
  if (!customerId || !priceId) return account;

  try {
    const state = await syncCustomerSubscriptionState({
      stripe: getStripe(),
      customerId,
      priceId,
      userId: account.user.id,
    });
    const profile = {
      ...account.profile!,
      subscription_tier: state.tier,
      subscription_status: state.status,
      subscription_expires_at: state.expiresAt,
    };

    return {
      ...account,
      profile,
      membership: classifyMembership(profile),
    };
  } catch (error) {
    // Keep the last durable state visible if Stripe is temporarily unavailable.
    // The webhook and a later My Page request will retry reconciliation.
    console.error(
      "Account subscription reconciliation failed:",
      error instanceof Error ? error.message : String(error)
    );
    return account;
  }
}

// Derives the membership kind from profile + auth fields. A premium tier can be
// backed by Stripe, a legacy migration, or /IMAGINE; we distinguish them so the
// UI can show the right management affordances (only Stripe gets a portal).
export function classifyMembership(
  profile: AccountProfile | null
): MembershipKind {
  if (profile?.subscription_tier !== "premium") {
    return "free";
  }
  if (profile.stripe_customer_id) {
    return "stripe_premium";
  }
  if (profile.legacy_login_id) {
    return "legacy_premium";
  }
  return "imagine_premium";
}

const PROFILE_COLUMNS =
  "id, full_name, email, avatar_url, subscription_tier, subscription_status, subscription_expires_at, stripe_customer_id, legacy_login_id, created_at";

// Loads the authenticated user's account data. Returns null when there is no
// signed-in user so callers can redirect to login. Uses the user-scoped server
// client; RLS limits the profile read to the user's own row.
export async function getAccountData(): Promise<AccountData | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", user.id)
    .maybeSingle();

  const profile = (data as AccountProfile | null) ?? null;

  // Identity providers come from the auth user, not the profile. app_metadata
  // exposes the canonical provider list; fall back to identities if absent.
  const appMeta = user.app_metadata as { providers?: string[] } | undefined;
  const providers =
    appMeta?.providers ??
    user.identities?.map((identity) => identity.provider) ??
    [];

  return {
    user,
    profile,
    membership: classifyMembership(profile),
    hasStripeCustomer: Boolean(profile?.stripe_customer_id),
    providers,
    displayName: profile?.full_name ?? user.email ?? "Member",
  };
}
