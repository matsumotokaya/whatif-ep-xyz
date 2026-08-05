import { NextRequest, NextResponse } from "next/server";
import { canAccessClub, getClubAccess } from "@/lib/club/access";
import { getPublishedWallpaperPack } from "@/lib/wallpaper";
import { hasPurchasedWallpaper } from "@/lib/wallpaper-purchases";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseVariant(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ series: string; code: string }> }
) {
  const { series, code } = await params;
  const requestOrigin = new URL(request.url).origin;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // Empty / invalid body is fine; variant defaults to 1.
  }
  const variant = parseVariant(body.variant);
  const attemptId =
    typeof body.attemptId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(body.attemptId)
      ? body.attemptId
      : null;

  // Guest checkout is allowed: anonymous visitors go straight to Stripe,
  // which collects their email. Signed-in users keep the existing flow
  // (entitlement short-circuit + prefilled email).
  const access = await getClubAccess();

  const pack = await getPublishedWallpaperPack(series, code, variant);
  if (!pack) {
    return NextResponse.json(
      { error: "Wallpaper pack not found." },
      { status: 404 }
    );
  }

  const wallpaperId = pack.projectId;
  const downloadUrl = `/api/works/${series}/${code}/wallpaper/download?variant=${variant}`;

  // Premium members and prior buyers are already entitled — skip checkout.
  if (
    access.user &&
    (canAccessClub(access) ||
      (await hasPurchasedWallpaper(access.user.id, wallpaperId)))
  ) {
    return NextResponse.json({ alreadyEntitled: true, downloadUrl });
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ||
    (requestOrigin === "http://localhost:3710" ||
    requestOrigin === "http://127.0.0.1:3710"
      ? requestOrigin
      : "https://whatif-ep.xyz");

  // user_id is only present for signed-in buyers; its absence marks a guest
  // purchase for the webhook / success fallback.
  const metadata: Record<string, string> = {
    wallpaper_id: wallpaperId,
    series_slug: series,
    display_code: code,
    variant_number: String(variant),
  };
  if (access.user) {
    metadata.user_id = access.user.id;
  }

  try {
    const priceId = process.env.STRIPE_WALLPAPER_PRICE_ID;
    if (!priceId) {
      throw new Error("STRIPE_WALLPAPER_PRICE_ID is not configured.");
    }
    const session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        // Keep fulfillment synchronous until async-payment event delivery is
        // explicitly enabled and tested in production.
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        client_reference_id: access.user?.id,
        // Signed-in buyers get their email prefilled; guests type theirs in
        // Checkout (Stripe always collects it), and we reuse it for the
        // download-link email.
        customer_email: access.user?.email ?? undefined,
        metadata,
        payment_intent_data: { metadata },
        success_url: `${origin}/works/${series}/${code}/wallpaper?variant=${variant}&purchased=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/works/${series}/${code}/wallpaper?variant=${variant}`,
      },
      attemptId ? { idempotencyKey: `wallpaper-checkout:${attemptId}` } : undefined
    );

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error(
      "Stripe checkout session create failed:",
      error instanceof Error ? error.message : String(error)
    );
    return NextResponse.json(
      { error: "Failed to start checkout." },
      { status: 500 }
    );
  }
}
