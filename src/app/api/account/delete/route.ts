import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { hasBillableSubscription } from "@/lib/subscription-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// User-owned rows to purge before deleting the auth identity. Most child tables
// already cascade on account deletion (profiles → auth.users, and user_images →
// auth.users, banners/template_likes/wallpaper_purchases → profiles are all
// ON DELETE CASCADE). work_saves, however, has NO foreign key to the user, so it
// must be cleared explicitly. The other tables are listed defensively — deleting
// them up front is harmless (cascades make repeats no-ops) and keeps intent clear.
//
// NOTE: wallpaper_purchases is intentionally NOT in this list. Its user_id →
// profiles(id) FK is ON DELETE SET NULL (see migration 20260621), so those
// financial records survive account deletion with user_id nulled out and are
// retained for accounting.
const USER_OWNED_TABLES = [
  "work_saves",
  "template_likes",
  "user_images",
  "banners",
] as const;

// Permanently deletes the signed-in user's account: personal data, profile row,
// and the Supabase Auth user. Requires the service-role admin client; the user
// session only authorizes the request, it cannot delete the auth user itself.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    console.error(
      "Account deletion failed: admin client unavailable (missing service role key)."
    );
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  // Deleting the account does not touch Stripe. Removing the profile while a
  // subscription is still live would keep billing the card with no owner left
  // to cancel it, so refuse and send the member to the Customer Portal first.
  // Stripe is queried directly rather than trusting profiles.subscription_tier,
  // which can be stale.
  const { data: billingProfile } = await admin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();
  const customerId =
    (billingProfile as { stripe_customer_id: string | null } | null)
      ?.stripe_customer_id ?? null;

  if (customerId) {
    try {
      const subscriptions = await getStripe().subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 100,
      });
      if (hasBillableSubscription(subscriptions.data)) {
        return NextResponse.json(
          { error: "active_subscription" },
          { status: 409 }
        );
      }
    } catch (error) {
      // Never delete an account whose billing state could not be verified.
      console.error(
        "Account deletion: Stripe subscription check failed:",
        error instanceof Error ? error.message : String(error)
      );
      return NextResponse.json(
        { error: "subscription_check_failed" },
        { status: 503 }
      );
    }
  }

  // Purge personal rows first so no orphaned data remains after the auth user
  // is removed. Errors are logged but do not abort the auth-user deletion: the
  // primary goal is to remove the identity; residual rows can be reconciled.
  for (const table of USER_OWNED_TABLES) {
    const { error } = await admin.from(table).delete().eq("user_id", user.id);
    if (error) {
      console.error(
        `Account deletion: failed to clear ${table}:`,
        error.message
      );
    }
  }

  // Remove the profile row explicitly. It would also cascade when the auth user
  // is deleted below (profiles.id → auth.users ON DELETE CASCADE), but doing it
  // here keeps the teardown order deterministic.
  const { error: profileError } = await admin
    .from("profiles")
    .delete()
    .eq("id", user.id);
  if (profileError) {
    console.error(
      "Account deletion: failed to delete profile:",
      profileError.message
    );
  }

  // Finally delete the auth identity. If this fails the account still exists, so
  // surface a 500 and let the user retry.
  const { error: authError } = await admin.auth.admin.deleteUser(user.id);
  if (authError) {
    console.error(
      "Account deletion: failed to delete auth user:",
      authError.message
    );
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  // Invalidate the local session cookies for this browser.
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
