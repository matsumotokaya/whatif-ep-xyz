import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function stripeMode(value: string | undefined): "test" | "live" | "unknown" | "missing" {
  if (!value) return "missing";
  if (value.startsWith("sk_test_") || value.startsWith("rk_test_")) return "test";
  if (value.startsWith("sk_live_") || value.startsWith("rk_live_")) return "live";
  return "unknown";
}

function errorSummary(reason: unknown) {
  if (reason && typeof reason === "object") {
    const error = reason as { type?: unknown; code?: unknown; message?: unknown };
    return {
      type: typeof error.type === "string" ? error.type : null,
      code: typeof error.code === "string" ? error.code : null,
      message: typeof error.message === "string" ? error.message : String(reason),
    };
  }
  return { type: null, code: null, message: String(reason) };
}

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return new NextResponse(null, { status: 404 });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const subscriptionPriceId = process.env.STRIPE_SUBSCRIPTION_PRICE_ID;
  const result: Record<string, unknown> = {
    secretKey: {
      configured: Boolean(secretKey),
      mode: stripeMode(secretKey),
    },
    subscriptionPrice: {
      configured: Boolean(subscriptionPriceId),
    },
  };

  if (!secretKey || !subscriptionPriceId) {
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const stripe = getStripe();
  const [price, subscriptions] = await Promise.allSettled([
    stripe.prices.retrieve(subscriptionPriceId),
    stripe.subscriptions.list({ limit: 1 }),
  ]);

  result.subscriptionPrice =
    price.status === "fulfilled"
      ? {
          configured: true,
          readable: true,
          active: price.value.active,
          livemode: price.value.livemode,
          recurring: Boolean(price.value.recurring),
        }
      : {
          configured: true,
          readable: false,
          error: errorSummary(price.reason),
        };
  result.subscriptionsRead =
    subscriptions.status === "fulfilled"
      ? { allowed: true }
      : { allowed: false, error: errorSummary(subscriptions.reason) };

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
