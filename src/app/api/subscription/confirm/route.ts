import { NextRequest, NextResponse } from "next/server";
import { getAccountData } from "@/lib/account/membership";
import { getStripe, getSubscriptionPriceId } from "@/lib/stripe";
import {
  stripeCustomerId,
  syncCustomerSubscriptionState,
} from "@/lib/subscription-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const account = await getAccountData();
  if (!account) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  let sessionId = "";
  try {
    const body = (await request.json()) as { sessionId?: unknown };
    sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  } catch {
    sessionId = "";
  }
  if (!sessionId.startsWith("cs_")) {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  });
  const sessionUserId = session.client_reference_id || session.metadata?.user_id;
  if (session.mode !== "subscription" || sessionUserId !== account.user.id) {
    return NextResponse.json({ error: "session_forbidden" }, { status: 403 });
  }

  const subscription =
    typeof session.subscription === "string" ? null : session.subscription;
  const configuredPrice = getSubscriptionPriceId();
  if (
    !subscription ||
    !configuredPrice ||
    !subscription.items.data.some((item) => item.price.id === configuredPrice)
  ) {
    return NextResponse.json({ error: "invalid_subscription" }, { status: 400 });
  }

  const customerId = stripeCustomerId(session.customer);
  if (!customerId) {
    return NextResponse.json({ error: "customer_missing" }, { status: 500 });
  }

  const result = await syncCustomerSubscriptionState({
    stripe,
    customerId,
    priceId: configuredPrice,
    userId: account.user.id,
  });

  if (result.tier !== "premium") {
    return NextResponse.json(
      { status: "processing", tier: result.tier },
      { status: 202 }
    );
  }

  return NextResponse.json({
    status: result.status,
    tier: result.tier,
    expiresAt: result.expiresAt,
  });
}
