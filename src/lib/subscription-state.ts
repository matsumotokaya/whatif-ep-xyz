import type Stripe from "stripe";

type CompatibleSubscription = Pick<
  Stripe.Subscription,
  "id" | "status" | "cancel_at_period_end" | "items"
> & {
  // Stripe removed these subscription-level fields in 2025-03-31.basil.
  // Keep the optional fallback so older persisted fixtures remain readable.
  current_period_end?: number | null;
};

const ACCESS_STATUSES = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
  // Keep access during Stripe's payment-retry window. Stripe will emit another
  // update if the subscription becomes unpaid or canceled.
  "past_due",
]);

// Statuses Stripe uses for subscriptions that no longer exist for billing
// purposes. Anything else may still invoice the customer, so account deletion
// must not proceed while such a subscription is attached.
const TERMINAL_STATUSES = new Set<Stripe.Subscription.Status>([
  "canceled",
  "incomplete_expired",
]);

// True when the customer still has a subscription Stripe could bill. Broader
// than ACCESS_STATUSES on purpose: `incomplete` grants no access yet but can
// still become active, and deleting the account would orphan it.
export function hasBillableSubscription(
  subscriptions: Pick<Stripe.Subscription, "status">[]
): boolean {
  return subscriptions.some(
    (subscription) => !TERMINAL_STATUSES.has(subscription.status)
  );
}

export interface AppSubscriptionState {
  tier: "free" | "premium";
  status: "active" | "canceling" | "canceled";
  expiresAt: string | null;
  activeSubscriptionIds: string[];
}

export function getSubscriptionPeriodEnd(
  subscription: CompatibleSubscription
): number | null {
  const itemEnds = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value): value is number => Number.isFinite(value) && value > 0);

  if (itemEnds.length > 0) {
    return Math.max(...itemEnds);
  }

  const legacyEnd = subscription.current_period_end;
  return Number.isFinite(legacyEnd) && (legacyEnd ?? 0) > 0
    ? (legacyEnd as number)
    : null;
}

export function deriveAppSubscriptionState(
  subscriptions: CompatibleSubscription[]
): AppSubscriptionState {
  const entitled = subscriptions.filter((subscription) =>
    ACCESS_STATUSES.has(subscription.status)
  );

  if (entitled.length === 0) {
    return {
      tier: "free",
      status: "canceled",
      expiresAt: null,
      activeSubscriptionIds: [],
    };
  }

  const periodEnds = entitled
    .map(getSubscriptionPeriodEnd)
    .filter((value): value is number => value !== null);
  const periodEnd = periodEnds.length > 0 ? Math.max(...periodEnds) : null;
  const allEnding = entitled.every(
    (subscription) => subscription.cancel_at_period_end
  );

  return {
    tier: "premium",
    status: allEnding ? "canceling" : "active",
    expiresAt: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    activeSubscriptionIds: entitled.map((subscription) => subscription.id),
  };
}
