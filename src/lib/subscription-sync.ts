import "server-only";

import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { deriveAppSubscriptionState } from "@/lib/subscription-state";

interface BillingProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  subscription_tier: "free" | "premium" | null;
  stripe_customer_id: string | null;
}

export interface SubscriptionSyncResult {
  userId: string;
  email: string | null;
  fullName: string | null;
  tier: "free" | "premium";
  status: "active" | "canceling" | "canceled";
  expiresAt: string | null;
  becamePremium: boolean;
  activeSubscriptionIds: string[];
}

export function stripeCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): string | null {
  if (typeof customer === "string") return customer;
  return customer?.id ?? null;
}

async function loadProfile(params: {
  userId?: string | null;
  customerId: string;
}): Promise<BillingProfile> {
  const supabase = createAdminClient();
  if (!supabase) {
    throw new Error("Supabase admin client is not configured.");
  }

  let query = supabase
    .from("profiles")
    .select(
      "id, email, full_name, subscription_tier, stripe_customer_id"
    );

  query = params.userId
    ? query.eq("id", params.userId)
    : query.eq("stripe_customer_id", params.customerId);

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(`Billing profile lookup failed: ${error.message}`);
  }
  if (!data) {
    throw new Error("No billing profile matched the Stripe event.");
  }

  const profile = data as BillingProfile;
  if (
    profile.stripe_customer_id &&
    profile.stripe_customer_id !== params.customerId
  ) {
    throw new Error("Stripe customer does not match the billing profile.");
  }

  return profile;
}

export async function syncCustomerSubscriptionState(params: {
  stripe: Stripe;
  customerId: string;
  priceId: string;
  userId?: string | null;
}): Promise<SubscriptionSyncResult> {
  const subscriptions = await params.stripe.subscriptions.list({
    customer: params.customerId,
    status: "all",
    limit: 100,
  });
  if (subscriptions.has_more) {
    throw new Error(
      "Stripe customer has more than 100 subscriptions; automatic reconciliation stopped."
    );
  }

  const relevantSubscriptions = subscriptions.data.filter((subscription) =>
    subscription.items.data.some((item) => item.price.id === params.priceId)
  );
  const state = deriveAppSubscriptionState(relevantSubscriptions);
  const profile = await loadProfile(params);
  const supabase = createAdminClient();
  if (!supabase) {
    throw new Error("Supabase admin client is not configured.");
  }

  const { data: updated, error: updateError } = await (
    supabase.from("profiles") as unknown as {
      update: (values: {
        subscription_tier: "free" | "premium";
        subscription_status: "active" | "canceling" | "canceled";
        subscription_expires_at: string | null;
        stripe_customer_id: string;
        updated_at: string;
      }) => {
        eq: (column: string, value: string) => {
          select: (columns: string) => {
            single: () => Promise<{
              data: { id: string } | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    }
  )
    .update({
      subscription_tier: state.tier,
      subscription_status: state.status,
      subscription_expires_at: state.expiresAt,
      stripe_customer_id: params.customerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id)
    .select("id")
    .single();

  if (updateError || !updated) {
    throw new Error(
      `Billing profile update failed: ${updateError?.message ?? "no row updated"}`
    );
  }

  return {
    userId: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    tier: state.tier,
    status: state.status,
    expiresAt: state.expiresAt,
    becamePremium:
      profile.subscription_tier !== "premium" && state.tier === "premium",
    activeSubscriptionIds: state.activeSubscriptionIds,
  };
}
