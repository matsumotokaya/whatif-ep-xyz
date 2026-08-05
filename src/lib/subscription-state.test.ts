import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import {
  deriveAppSubscriptionState,
  getSubscriptionPeriodEnd,
} from "@/lib/subscription-state";

function subscription(
  overrides: Partial<Stripe.Subscription> & {
    id: string;
    status: Stripe.Subscription.Status;
  }
): Stripe.Subscription {
  return {
    cancel_at_period_end: false,
    items: {
      object: "list",
      data: [],
      has_more: false,
      url: `/v1/subscription_items?subscription=${overrides.id}`,
    },
    ...overrides,
  } as Stripe.Subscription;
}

describe("subscription state reconciliation", () => {
  it("reads Clover billing periods from subscription items", () => {
    const value = subscription({
      id: "sub_clover",
      status: "active",
      items: {
        object: "list",
        data: [{ current_period_end: 1_800_000_000 } as Stripe.SubscriptionItem],
        has_more: false,
        url: "/v1/subscription_items?subscription=sub_clover",
      },
    });

    expect(getSubscriptionPeriodEnd(value)).toBe(1_800_000_000);
  });

  it("keeps a legacy subscription-level period fallback", () => {
    const value = subscription({
      id: "sub_legacy",
      status: "active",
      current_period_end: 1_700_000_000,
    } as Partial<Stripe.Subscription> & {
      id: string;
      status: Stripe.Subscription.Status;
    });

    expect(getSubscriptionPeriodEnd(value)).toBe(1_700_000_000);
  });

  it("shows canceling while access remains active", () => {
    const state = deriveAppSubscriptionState([
      subscription({
        id: "sub_canceling",
        status: "active",
        cancel_at_period_end: true,
        items: {
          object: "list",
          data: [{ current_period_end: 1_800_000_000 } as Stripe.SubscriptionItem],
          has_more: false,
          url: "/v1/subscription_items?subscription=sub_canceling",
        },
      }),
    ]);

    expect(state).toMatchObject({
      tier: "premium",
      status: "canceling",
      activeSubscriptionIds: ["sub_canceling"],
    });
  });

  it("does not downgrade when another active subscription exists", () => {
    const state = deriveAppSubscriptionState([
      subscription({ id: "sub_deleted", status: "canceled" }),
      subscription({ id: "sub_active", status: "active" }),
    ]);

    expect(state).toMatchObject({
      tier: "premium",
      status: "active",
      activeSubscriptionIds: ["sub_active"],
    });
  });

  it("converges to free after all subscriptions have ended", () => {
    expect(
      deriveAppSubscriptionState([
        subscription({ id: "sub_deleted", status: "canceled" }),
      ])
    ).toEqual({
      tier: "free",
      status: "canceled",
      expiresAt: null,
      activeSubscriptionIds: [],
    });
  });

  it("keeps access during Stripe's past-due retry window", () => {
    expect(
      deriveAppSubscriptionState([
        subscription({ id: "sub_retrying", status: "past_due" }),
      ])
    ).toMatchObject({ tier: "premium", status: "active" });
  });
});
