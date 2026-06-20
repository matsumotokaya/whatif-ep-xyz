import "server-only";

import Stripe from "stripe";

// Lazy singleton. The secret key is not available at build time, so we must
// never read it at module import time and never throw until actually called.
let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeClient) return stripeClient;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Configure it in the environment to use Stripe."
    );
  }

  // Use the SDK's pinned default apiVersion (no override).
  stripeClient = new Stripe(secretKey);
  return stripeClient;
}

// One-time wallpaper purchase price ID (mode=payment line item).
export function getWallpaperPriceId(): string | undefined {
  return process.env.STRIPE_WALLPAPER_PRICE_ID;
}
