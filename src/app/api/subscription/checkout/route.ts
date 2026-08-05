import { NextRequest, NextResponse } from "next/server";
import { getAccountData } from "@/lib/account/membership";
import { safeLocalUrl } from "@/lib/safe-return-url";
import { getStripe, getSubscriptionPriceId } from "@/lib/stripe";
import { deriveAppSubscriptionState } from "@/lib/subscription-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function siteOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (configured) return configured;

  const origin = new URL(request.url).origin;
  if (origin === "http://localhost:3710" || origin === "http://127.0.0.1:3710") {
    return origin;
  }
  return "https://whatif-ep.xyz";
}

export async function POST(request: NextRequest) {
  const account = await getAccountData();
  if (!account) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }
  if (!account.profile) {
    // Never create a charge that the webhook cannot attach to a durable
    // billing profile.
    return NextResponse.json(
      { error: "billing_profile_missing" },
      { status: 409 }
    );
  }

  const priceId = getSubscriptionPriceId();
  if (!priceId) {
    return NextResponse.json(
      { error: "subscription_price_not_configured" },
      { status: 500 }
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // Defaults below are safe.
  }

  const stripe = getStripe();
  const customerId = account.profile.stripe_customer_id;

  if (customerId) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 100,
    });
    if (subscriptions.has_more) {
      throw new Error(
        "Stripe customer has more than 100 subscriptions; checkout stopped."
      );
    }
    const current = deriveAppSubscriptionState(
      subscriptions.data.filter((subscription) =>
        subscription.items.data.some((item) => item.price.id === priceId)
      )
    );
    if (current.tier === "premium") {
      return NextResponse.json(
        { error: "subscription_already_active" },
        { status: 409 }
      );
    }
  } else if (account.profile.subscription_tier === "premium") {
    return NextResponse.json(
      { error: "premium_already_active" },
      { status: 409 }
    );
  }

  const origin = siteOrigin(request);
  const successUrl = safeLocalUrl(origin, body.successPath, "/success");
  const cancelUrl = safeLocalUrl(origin, body.cancelPath, "/plans");
  successUrl.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");

  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl.toString(),
      cancel_url: cancelUrl.toString(),
      client_reference_id: account.user.id,
      customer: customerId ?? undefined,
      customer_email: customerId ? undefined : account.user.email,
      metadata: { user_id: account.user.id },
      subscription_data: { metadata: { user_id: account.user.id } },
    },
    {
      idempotencyKey: `subscription-checkout:${account.user.id}:${Math.floor(Date.now() / 300_000)}`,
    }
  );

  return NextResponse.json({ url: session.url });
}
