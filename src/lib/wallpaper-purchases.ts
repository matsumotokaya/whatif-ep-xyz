import "server-only";

import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { sendWallpaperPurchaseNotifications } from "@/lib/email-notifications";

// One paid row in public.wallpaper_purchases.
interface WallpaperPurchaseRow {
  id: string;
  user_id: string | null;
  wallpaper_id: string;
  status: string;
  download_token: string;
}

export interface RecordWallpaperPurchaseInput {
  // Null for guest checkout (no account) — the row is keyed by buyer email +
  // download token instead of a profile.
  userId: string | null;
  buyerEmail: string | null;
  wallpaperId: string;
  seriesSlug: string | null;
  displayCode: string | null;
  variantNumber: number | null;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  amount: number | null; // integer cents
  currency: string | null;
}

export interface RecordWallpaperPurchaseResult {
  ok: boolean;
  alreadyExisted: boolean;
  // Per-purchase download token (newly generated, or the existing row's token
  // when the session was already recorded). Null only on failure.
  downloadToken: string | null;
  notificationStatus: "pending" | "sent" | "failed";
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

// Token-based entitlement for guest (and emailed) download links. The token
// authorizes exactly one wallpaper: the row must match both the token and the
// wallpaper id, and be paid. Uses the service-role client because guest rows
// have user_id = null and are invisible under RLS.
export async function isValidWallpaperDownloadToken(
  token: string,
  wallpaperId: string
): Promise<boolean> {
  if (!token || token.length < 16) return false;

  const supabase = createAdminClient();
  if (!supabase) {
    console.error(
      "isValidWallpaperDownloadToken: admin client unavailable (missing service role key)."
    );
    return false;
  }

  const { data, error } = await (
    supabase.from("wallpaper_purchases") as unknown as {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string
        ) => {
          eq: (
            column: string,
            value: string
          ) => {
            eq: (
              column: string,
              value: string
            ) => {
              maybeSingle: () => Promise<{
                data: { id: string } | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
      };
    }
  )
    .select("id")
    .eq("download_token", token)
    .eq("wallpaper_id", wallpaperId)
    .eq("status", "paid")
    .maybeSingle();

  if (error) {
    console.error("isValidWallpaperDownloadToken query failed:", error.message);
    return false;
  }

  return Boolean(data?.id);
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
// user session and RLS would otherwise block the write. Every row gets an
// unguessable download token so the buyer can download via the emailed link
// without logging in.
export async function recordWallpaperPurchase(
  input: RecordWallpaperPurchaseInput
): Promise<RecordWallpaperPurchaseResult> {
  const supabase = createAdminClient();
  if (!supabase) {
    console.error(
      "recordWallpaperPurchase: admin client unavailable (missing service role key)."
    );
    return {
      ok: false,
      alreadyExisted: false,
      downloadToken: null,
      notificationStatus: "failed",
    };
  }

  const nowIso = new Date().toISOString();
  const downloadToken = randomBytes(32).toString("hex");

  const row = {
    user_id: input.userId,
    buyer_email: input.buyerEmail,
    download_token: downloadToken,
    wallpaper_id: input.wallpaperId,
    series_slug: input.seriesSlug,
    display_code: input.displayCode,
    variant_number: input.variantNumber,
    stripe_checkout_session_id: input.stripeCheckoutSessionId,
    stripe_payment_intent_id: input.stripePaymentIntentId,
    amount: input.amount,
    currency: input.currency,
    status: "paid",
    notification_status: "pending",
    purchased_at: nowIso,
    updated_at: nowIso,
  };

  // Insert exactly once by Checkout Session. ignoreDuplicates prevents the
  // webhook and success-page fallback from overwriting each other's token.
  const { data: inserted, error } = await (
    supabase.from("wallpaper_purchases") as unknown as {
      upsert: (
        values: typeof row,
        options: { onConflict: string; ignoreDuplicates: boolean }
      ) => {
        select: (columns: string) => {
          maybeSingle: () => Promise<{
            data: {
              id: string;
              download_token: string | null;
              notification_status: "pending" | "sent" | "failed";
            } | null;
            error: { message: string } | null;
          }>;
        };
      };
    }
  )
    .upsert(row, {
      onConflict: "stripe_checkout_session_id",
      ignoreDuplicates: true,
    })
    .select("id, download_token, notification_status")
    .maybeSingle();

  if (error) {
    console.error("recordWallpaperPurchase upsert failed:", error.message);
    return {
      ok: false,
      alreadyExisted: false,
      downloadToken: null,
      notificationStatus: "failed",
    };
  }

  if (inserted?.id) {
    return {
      ok: true,
      alreadyExisted: false,
      downloadToken: inserted.download_token ?? downloadToken,
      notificationStatus: inserted.notification_status,
    };
  }

  const { data: existingPurchase, error: existingPurchaseError } = await (
    supabase.from("wallpaper_purchases") as unknown as {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{
            data: {
              id: string;
              download_token: string | null;
              notification_status: "pending" | "sent" | "failed";
            } | null;
            error: { message: string } | null;
          }>;
        };
      };
    }
  )
    .select("id, download_token, notification_status")
    .eq("stripe_checkout_session_id", input.stripeCheckoutSessionId)
    .maybeSingle();

  if (existingPurchaseError || !existingPurchase?.id) {
    console.error(
      "recordWallpaperPurchase idempotent lookup failed:",
      existingPurchaseError?.message ?? "row missing after conflict"
    );
    return {
      ok: false,
      alreadyExisted: false,
      downloadToken: null,
      notificationStatus: "failed",
    };
  }

  return {
    ok: true,
    alreadyExisted: true,
    downloadToken: existingPurchase.download_token ?? null,
    notificationStatus: existingPurchase.notification_status,
  };
}

export async function markWallpaperPurchaseNotification(params: {
  stripeCheckoutSessionId: string;
  status: "sent" | "failed";
  error?: string | null;
}): Promise<boolean> {
  const supabase = createAdminClient();
  if (!supabase) return false;

  const now = new Date().toISOString();
  const { error } = await (
    supabase.from("wallpaper_purchases") as unknown as {
      update: (values: {
        notification_status: "sent" | "failed";
        notification_error: string | null;
        notification_sent_at: string | null;
        updated_at: string;
      }) => {
        eq: (column: string, value: string) => Promise<{
          error: { message: string } | null;
        }>;
      };
    }
  )
    .update({
      notification_status: params.status,
      notification_error: params.error ?? null,
      notification_sent_at: params.status === "sent" ? now : null,
      updated_at: now,
    })
    .eq("stripe_checkout_session_id", params.stripeCheckoutSessionId);

  if (error) {
    console.error("markWallpaperPurchaseNotification failed:", error.message);
    return false;
  }
  return true;
}

export interface VerifyCheckoutSessionResult {
  ok: boolean;
  // Download token for this purchase (available whenever ok is true).
  downloadToken: string | null;
}

// Success-page fallback: retrieve the session directly from Stripe and record
// the purchase if it is paid. Idempotent via recordWallpaperPurchase. This lets
// the buyer see the download immediately even before the webhook arrives. When
// this call is the one that records the purchase (webhook not yet delivered),
// it also sends the confirmation email so guests always receive their download
// link exactly once.
export async function verifyAndRecordCheckoutSession(
  sessionId: string
): Promise<VerifyCheckoutSessionResult> {
  let session;
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId);
  } catch (error) {
    console.error(
      "verifyAndRecordCheckoutSession retrieve failed:",
      error instanceof Error ? error.message : String(error)
    );
    return { ok: false, downloadToken: null };
  }

  if (session.payment_status !== "paid") {
    return { ok: false, downloadToken: null };
  }

  const metadata = session.metadata ?? {};
  // user_id is absent for guest checkout — only the wallpaper id is required.
  const userId = metadata.user_id || null;
  const wallpaperId = metadata.wallpaper_id;
  if (!wallpaperId) {
    console.error(
      "verifyAndRecordCheckoutSession: session missing wallpaper_id metadata."
    );
    return { ok: false, downloadToken: null };
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

  const result = await recordWallpaperPurchase({
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

  // If this fallback created the row (buyer landed before the webhook), send
  // the confirmation/download-link email here; the webhook will then see
  // alreadyExisted and skip its own send.
  if (result.ok && result.notificationStatus !== "sent" && buyerEmail) {
    try {
      await sendWallpaperPurchaseNotifications({
        notificationId: session.id,
        buyerEmail,
        buyerName: session.customer_details?.name ?? null,
        seriesSlug: metadata.series_slug ?? null,
        displayCode: metadata.display_code ?? null,
        variantNumber: resolvedVariant,
        amount: session.amount_total,
        currency: session.currency,
        downloadToken: result.downloadToken,
        isGuest: !userId,
      });
      await markWallpaperPurchaseNotification({
        stripeCheckoutSessionId: session.id,
        status: "sent",
      });
    } catch (notificationError) {
      await markWallpaperPurchaseNotification({
        stripeCheckoutSessionId: session.id,
        status: "failed",
        error:
          notificationError instanceof Error
            ? notificationError.message
            : String(notificationError),
      });
      console.error(
        "verifyAndRecordCheckoutSession: failed to send purchase notification:",
        notificationError instanceof Error
          ? notificationError.message
          : String(notificationError)
      );
    }
  }

  return { ok: result.ok, downloadToken: result.downloadToken };
}
