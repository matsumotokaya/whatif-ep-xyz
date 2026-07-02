import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { recordWallpaperPurchase } from "@/lib/wallpaper-purchases";
import { sendWallpaperPurchaseNotifications } from "@/lib/email-notifications";
import { createAdminClient } from "@/lib/supabase/admin";

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
    // user_id is absent for guest checkout — only wallpaper_id is required.
    const userId = metadata.user_id || null;
    const wallpaperId = metadata.wallpaper_id;

    if (!wallpaperId) {
      // Log and ack to avoid Stripe retry storms; nothing actionable here.
      console.error(
        "Stripe webhook: checkout.session.completed missing wallpaper_id metadata.",
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

    const sessionBuyerEmail =
      session.customer_details?.email ?? session.customer_email ?? null;

    const purchaseResult = await recordWallpaperPurchase({
      userId,
      buyerEmail: sessionBuyerEmail,
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

    if (!purchaseResult.ok) {
      // Returning 500 lets Stripe retry the delivery.
      return NextResponse.json(
        { error: "Failed to record purchase." },
        { status: 500 }
      );
    }

    if (!purchaseResult.alreadyExisted) {
      try {
        const adminClient = createAdminClient();
        let buyerName =
          session.customer_details?.name ??
          null;

        let resolvedBuyerEmail = sessionBuyerEmail;
        // Fall back to the profile only for signed-in buyers; guests have no
        // profile row and Stripe always collects their email at Checkout.
        if ((!resolvedBuyerEmail || !buyerName) && userId && adminClient) {
          const { data: profile } = await (
            adminClient.from("profiles") as unknown as {
              select: (
                columns: string
              ) => {
                eq: (
                  column: string,
                  value: string
                ) => {
                  single: () => Promise<{
                    data: { email: string | null; full_name: string | null } | null;
                  }>;
                };
              };
            }
          )
            .select("email, full_name")
            .eq("id", userId)
            .single();

          resolvedBuyerEmail = resolvedBuyerEmail ?? profile?.email ?? null;
          buyerName = buyerName ?? profile?.full_name ?? null;
        }

        if (resolvedBuyerEmail) {
          await sendWallpaperPurchaseNotifications({
            buyerEmail: resolvedBuyerEmail,
            buyerName,
            seriesSlug: metadata.series_slug ?? null,
            displayCode: metadata.display_code ?? null,
            variantNumber: Number.isFinite(variantNumber as number)
              ? (variantNumber as number)
              : null,
            amount: session.amount_total,
            currency: session.currency,
            downloadToken: purchaseResult.downloadToken,
            isGuest: !userId,
          });
        } else {
          console.error(
            "Stripe webhook: unable to resolve buyer email for wallpaper purchase notification.",
            session.id
          );
        }
      } catch (notificationError) {
        console.error(
          "Stripe webhook: failed to send wallpaper purchase notification:",
          notificationError instanceof Error
            ? notificationError.message
            : String(notificationError)
        );
      }
    }

    return NextResponse.json({ received: true });
  }

  // Ignore other event types.
  return NextResponse.json({ received: true });
}
