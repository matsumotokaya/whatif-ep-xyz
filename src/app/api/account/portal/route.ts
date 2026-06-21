import { NextRequest, NextResponse } from "next/server";
import { getAccountData } from "@/lib/account/membership";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Creates a Stripe Billing (Customer) Portal session and returns its URL. The
// client redirects the browser to it so the member can manage / cancel their
// subscription and update the payment method. Only members with a stored
// stripe_customer_id are eligible; legacy and /IMAGINE premium have no Stripe
// customer and must not reach this route.
export async function POST(request: NextRequest) {
  const account = await getAccountData();

  if (!account) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const customerId = account.profile?.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json(
      { error: "no_stripe_customer" },
      { status: 400 }
    );
  }

  const requestOrigin = new URL(request.url).origin;
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || requestOrigin;

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/account`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error(
      "Stripe billing portal session create failed:",
      error instanceof Error ? error.message : String(error)
    );
    return NextResponse.json(
      { error: "portal_failed" },
      { status: 500 }
    );
  }
}
