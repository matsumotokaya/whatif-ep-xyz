import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { recordWallpaperPurchase } from "@/lib/wallpaper-purchases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    console.error("Stripe webhook: missing signature or webhook secret.");
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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.payment_status !== "paid") {
      return NextResponse.json({ received: true });
    }

    const metadata = session.metadata ?? {};
    const userId = metadata.user_id;
    const wallpaperId = metadata.wallpaper_id;

    if (!userId || !wallpaperId) {
      // Log and ack to avoid Stripe retry storms; nothing actionable here.
      console.error(
        "Stripe webhook: checkout.session.completed missing user_id/wallpaper_id metadata.",
        session.id
      );
      return NextResponse.json({ received: true });
    }

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null);

    const variantRaw = metadata.variant_number;
    const variantNumber = variantRaw ? Number.parseInt(variantRaw, 10) : null;

    const ok = await recordWallpaperPurchase({
      userId,
      wallpaperId,
      seriesSlug: metadata.series_slug ?? null,
      displayCode: metadata.display_code ?? null,
      variantNumber: Number.isFinite(variantNumber as number)
        ? (variantNumber as number)
        : null,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
      amount: session.amount_total,
      currency: session.currency,
    });

    if (!ok) {
      // Returning 500 lets Stripe retry the delivery.
      return NextResponse.json(
        { error: "Failed to record purchase." },
        { status: 500 }
      );
    }

    return NextResponse.json({ received: true });
  }

  // Ignore other event types.
  return NextResponse.json({ received: true });
}
