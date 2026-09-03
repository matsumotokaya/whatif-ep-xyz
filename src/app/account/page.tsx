import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  getAccountData,
  reconcileAccountSubscription,
} from "@/lib/account/membership";
import { createClient } from "@/lib/supabase/server";
import AccountPageClient, {
  type AccountView,
  type PurchaseView,
} from "./AccountPageClient";

export const metadata: Metadata = {
  title: "My Account",
  description: "WHATIF account settings and membership",
};

// Authenticated users only — render the My Page dashboard. This is a dynamic,
// per-user page (reads the session), so it is never statically cached.
export const dynamic = "force-dynamic";

// Paid wallpaper purchases for the signed-in user, newest first. Read with the
// user-scoped client so RLS limits rows to the user's own purchases.
async function loadPurchases(): Promise<PurchaseView[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("wallpaper_purchases")
    .select(
      "id, series_slug, display_code, variant_number, amount, currency, purchased_at"
    )
    .eq("user_id", user.id)
    .eq("status", "paid")
    .order("purchased_at", { ascending: false });

  if (error) {
    console.error("loadPurchases query failed:", error.message);
    return [];
  }

  const rows =
    (data as Array<{
      id: string;
      series_slug: string | null;
      display_code: string | null;
      variant_number: number | null;
      amount: number | null;
      currency: string | null;
      purchased_at: string | null;
    }> | null) ?? [];

  return rows.map((row) => ({
    id: row.id,
    seriesSlug: row.series_slug,
    displayCode: row.display_code,
    variantNumber: row.variant_number,
    amount: row.amount,
    currency: row.currency,
    purchasedAt: row.purchased_at,
  }));
}

export default async function AccountPage() {
  const account = await getAccountData();

  // Match the existing auth convention used by requireClubAuth.
  if (!account) {
    redirect(`/auth/login?next=${encodeURIComponent("/account")}`);
  }

  const [reconciledAccount, purchases] = await Promise.all([
    reconcileAccountSubscription(account),
    loadPurchases(),
  ]);

  const view: AccountView = {
    email: reconciledAccount.profile?.email ?? reconciledAccount.user.email ?? null,
    displayName: reconciledAccount.displayName,
    avatarUrl: reconciledAccount.profile?.avatar_url ?? null,
    providers: reconciledAccount.providers,
    legacyLoginId: reconciledAccount.profile?.legacy_login_id ?? null,
    createdAt:
      reconciledAccount.profile?.created_at ?? reconciledAccount.user.created_at ?? null,
    membership: reconciledAccount.membership,
    subscriptionStatus: reconciledAccount.profile?.subscription_status ?? null,
    subscriptionExpiresAt:
      reconciledAccount.profile?.subscription_expires_at ?? null,
    hasStripeCustomer: reconciledAccount.hasStripeCustomer,
    purchases,
  };

  return <AccountPageClient view={view} />;
}
