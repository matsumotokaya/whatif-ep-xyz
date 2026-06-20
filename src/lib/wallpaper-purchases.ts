import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

// One paid row in public.wallpaper_purchases.
interface WallpaperPurchaseRow {
  id: string;
  user_id: string;
  wallpaper_id: string;
  status: string;
}

export interface RecordWallpaperPurchaseInput {
  userId: string;
  wallpaperId: string;
  seriesSlug: string | null;
  displayCode: string | null;
  variantNumber: number | null;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  amount: number | null; // integer cents
  currency: string | null;
}

// Returns true when the user already owns the wallpaper (status = 'paid').
// Uses the user-scoped client so RLS limits the read to the user's own rows.
export async function hasPurchasedWallpaper(
  userId: string,
  wallpaperId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wallpaper_purchases")
    .select("id")
    .eq("user_id", userId)
    .eq("wallpaper_id", wallpaperId)
    .eq("status", "paid")
    .maybeSingle();

  if (error) {
    console.error("hasPurchasedWallpaper query failed:", error.message);
    return false;
  }

  return Boolean((data as Pick<WallpaperPurchaseRow, "id"> | null)?.id);
}

// Returns the set of display codes the user has purchased (status = 'paid')
// within a series, used to flag "purchased" works in the gallery list. Uses the
// user-scoped client so RLS limits the read to the user's own rows. Premium
// users are intentionally not handled here: their access comes from the
// subscription, not a purchase, so they should not see a "purchased" badge.
export async function getPurchasedDisplayCodes(
  seriesSlug: string
): Promise<string[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("wallpaper_purchases")
    .select("display_code")
    .eq("user_id", user.id)
    .eq("series_slug", seriesSlug)
    .eq("status", "paid");

  if (error) {
    console.error("getPurchasedDisplayCodes query failed:", error.message);
    return [];
  }

  const codes = (data as { display_code: string | null }[] | null) ?? [];
  return [
    ...new Set(
      codes
        .map((row) => row.display_code)
        .filter((code): code is string => Boolean(code))
    ),
  ];
}

// Idempotent upsert keyed on the Stripe Checkout Session id. Uses the
// service-role client because the webhook / success fallback runs without a
// user session and RLS would otherwise block the write.
export async function recordWallpaperPurchase(
  input: RecordWallpaperPurchaseInput
): Promise<boolean> {
  const supabase = createAdminClient();
  if (!supabase) {
    console.error(
      "recordWallpaperPurchase: admin client unavailable (missing service role key)."
    );
    return false;
  }

  const nowIso = new Date().toISOString();

  const row = {
    user_id: input.userId,
    wallpaper_id: input.wallpaperId,
    series_slug: input.seriesSlug,
    display_code: input.displayCode,
    variant_number: input.variantNumber,
    stripe_checkout_session_id: input.stripeCheckoutSessionId,
    stripe_payment_intent_id: input.stripePaymentIntentId,
    amount: input.amount,
    currency: input.currency,
    status: "paid",
    purchased_at: nowIso,
    updated_at: nowIso,
  };

  // The admin client is created without generated DB types, so the typed
  // upsert overloads resolve to `never`. Cast the table builder to bypass the
  // unknown-schema inference (matches the untyped pattern used elsewhere).
  const { error } = await (
    supabase.from("wallpaper_purchases") as unknown as {
      upsert: (
        values: typeof row,
        options: { onConflict: string }
      ) => Promise<{ error: { message: string } | null }>;
    }
  ).upsert(row, { onConflict: "stripe_checkout_session_id" });

  if (error) {
    console.error("recordWallpaperPurchase upsert failed:", error.message);
    return false;
  }

  return true;
}

// Success-page fallback: retrieve the session directly from Stripe and record
// the purchase if it is paid. Idempotent via recordWallpaperPurchase. This lets
// the buyer see the download immediately even before the webhook arrives.
export async function verifyAndRecordCheckoutSession(
  sessionId: string
): Promise<boolean> {
  let session;
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId);
  } catch (error) {
    console.error(
      "verifyAndRecordCheckoutSession retrieve failed:",
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }

  if (session.payment_status !== "paid") {
    return false;
  }

  const metadata = session.metadata ?? {};
  const userId = metadata.user_id;
  const wallpaperId = metadata.wallpaper_id;
  if (!userId || !wallpaperId) {
    console.error(
      "verifyAndRecordCheckoutSession: session missing user_id/wallpaper_id metadata."
    );
    return false;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const variantRaw = metadata.variant_number;
  const variantNumber = variantRaw ? Number.parseInt(variantRaw, 10) : null;

  return recordWallpaperPurchase({
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
}
