import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  sendPremiumActivatedNotifications,
  sendWallpaperPurchaseNotifications,
} from "@/lib/email-notifications";
import {
  markWallpaperPurchaseNotification,
  recordWallpaperPurchase,
} from "@/lib/wallpaper-purchases";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getStripe,
  getSubscriptionPriceId,
} from "@/lib/stripe";
import {
  stripeCustomerId,
  syncCustomerSubscriptionState,
} from "@/lib/subscription-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function notifyPremiumActivation(
  result: Awaited<ReturnType<typeof syncCustomerSubscriptionState>>
) {
  if (!result.becamePremium || !result.email) return;

  try {
    await sendPremiumActivatedNotifications({
      notificationId: `${result.userId}/${result.expiresAt ?? "no-expiry"}`,
      email: result.email,
      fullName: result.fullName,
      status: result.status,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    // Membership state is already durable. Notification delivery must not
    // cause Stripe to replay the financial state transition.
    console.error(
      "Stripe webhook: Premium notification failed:",
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function handleSubscriptionCheckout(session: Stripe.Checkout.Session) {
  const stripe = getStripe();
  const priceId = getSubscriptionPriceId();
  if (!priceId) throw new Error("Subscription price is not configured.");

  const userId = session.client_reference_id || session.metadata?.user_id;
  if (!userId) {
    throw new Error("Premium Checkout Session has no user_id.");
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;
  if (!subscriptionId) {
    throw new Error("Premium Checkout Session has no subscription.");
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  if (!subscription.items.data.some((item) => item.price.id === priceId)) {
    console.warn(
      `Ignoring Checkout Session ${session.id}: it is not the configured Premium price.`
    );
    return;
  }

  const customerId = stripeCustomerId(session.customer);
  if (!customerId) throw new Error("Premium Checkout Session has no customer.");

  const result = await syncCustomerSubscriptionState({
    stripe,
    customerId,
    priceId,
    userId,
  });
  await notifyPremiumActivation(result);
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const priceId = getSubscriptionPriceId();
  if (!priceId) throw new Error("Subscription price is not configured.");

  if (!subscription.items.data.some((item) => item.price.id === priceId)) {
    return;
  }

  const customerId = stripeCustomerId(subscription.customer);
  if (!customerId) throw new Error("Subscription event has no customer.");

  const result = await syncCustomerSubscriptionState({
    stripe: getStripe(),
    customerId,
    priceId,
    userId: subscription.metadata?.user_id,
  });
  await notifyPremiumActivation(result);
}

async function handleWallpaperCheckout(session: Stripe.Checkout.Session) {
  if (session.mode !== "payment") return;
  if (session.payment_status !== "paid") return;

  const metadata = session.metadata ?? {};
  const userId = metadata.user_id || null;
  const wallpaperId = metadata.wallpaper_id;
  if (!wallpaperId) {
    // Other one-time Checkout products may share the Stripe account. They are
    // not fulfilled by this endpoint.
    console.warn(`Ignoring non-wallpaper Checkout Session ${session.id}.`);
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);
  const variantRaw = metadata.variant_number;
  const variantNumber = variantRaw ? Number.parseInt(variantRaw, 10) : null;
  const resolvedVariant = Number.isFinite(variantNumber as number)
    ? (variantNumber as number)
    : null;
  const buyerEmail =
    session.customer_details?.email ?? session.customer_email ?? null;

  const purchaseResult = await recordWallpaperPurchase({
    userId,
    buyerEmail,
    wallpaperId,
    seriesSlug: metadata.series_slug ?? null,
    displayCode: metadata.display_code ?? null,
    variantNumber: resolvedVariant,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: paymentIntentId,
    amount: session.amount_total,
    currency: session.currency,
  });
  if (!purchaseResult.ok) {
    throw new Error("Failed to record wallpaper purchase.");
  }
  if (purchaseResult.notificationStatus === "sent") return;

  const adminClient = createAdminClient();
  let buyerName = session.customer_details?.name ?? null;
  let resolvedBuyerEmail = buyerEmail;
  if ((!resolvedBuyerEmail || !buyerName) && userId && adminClient) {
    const { data: profile } = await adminClient
      .from("profiles")
      .select("email, full_name")
      .eq("id", userId)
      .maybeSingle();
    const billingProfile = profile as unknown as {
      email: string | null;
      full_name: string | null;
    } | null;
    resolvedBuyerEmail = resolvedBuyerEmail ?? billingProfile?.email ?? null;
    buyerName = buyerName ?? billingProfile?.full_name ?? null;
  }

  if (!resolvedBuyerEmail) {
    throw new Error("Paid wallpaper Checkout Session has no buyer email.");
  }

  try {
    await sendWallpaperPurchaseNotifications({
      notificationId: session.id,
      buyerEmail: resolvedBuyerEmail,
      buyerName,
      seriesSlug: metadata.series_slug ?? null,
      displayCode: metadata.display_code ?? null,
      variantNumber: resolvedVariant,
      amount: session.amount_total,
      currency: session.currency,
      downloadToken: purchaseResult.downloadToken,
      isGuest: !userId,
    });
    const marked = await markWallpaperPurchaseNotification({
      stripeCheckoutSessionId: session.id,
      status: "sent",
    });
    if (!marked) {
      throw new Error("Purchase email was sent but delivery state was not saved.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markWallpaperPurchaseNotification({
      stripeCheckoutSessionId: session.id,
      status: "failed",
      error: message,
    });
    // Return 5xx so Stripe retries guest delivery. The purchase insert is
    // idempotent and its stable token is reused on every attempt.
    throw new Error(`Wallpaper notification failed: ${message}`);
  }
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  if (!charge.refunded) return;
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;
  if (!paymentIntentId) return;

  const supabase = createAdminClient();
  if (!supabase) throw new Error("Supabase admin client is not configured.");

  const { error } = await (
    supabase.from("wallpaper_purchases") as unknown as {
      update: (values: { status: string; updated_at: string }) => {
        eq: (column: string, value: string) => {
          eq: (column: string, value: string) => Promise<{
            error: { message: string } | null;
          }>;
        };
      };
    }
  )
    .update({ status: "refunded", updated_at: new Date().toISOString() })
    .eq("stripe_payment_intent_id", paymentIntentId)
    .eq("status", "paid");
  if (error) {
    throw new Error(`Wallpaper refund reconciliation failed: ${error.message}`);
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    );
  } catch (error) {
    console.error(
      "Stripe webhook signature verification failed:",
      error instanceof Error ? error.message : String(error)
    );
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription") {
          await handleSubscriptionCheckout(session);
        } else {
          await handleWallpaperCheckout(session);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionChange(
          event.data.object as Stripe.Subscription
        );
        break;
      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      default:
        break;
    }
  } catch (error) {
    console.error(
      `Stripe webhook processing failed for ${event.id}:`,
      error instanceof Error ? error.message : String(error)
    );
    // Stripe retries 5xx deliveries. Never acknowledge a financial state
    // transition that failed before its durable database update.
    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
