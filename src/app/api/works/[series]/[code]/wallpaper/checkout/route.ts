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

  const access = await getClubAccess();

  const loginUrl = `/auth/login?next=${encodeURIComponent(
    `/works/${series}/${code}/wallpaper?variant=${variant}`
  )}`;

  if (access.status === "anonymous" || !access.user) {
    return NextResponse.json(
      { error: "auth_required", loginUrl },
      { status: 401 }
    );
  }

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
    canAccessClub(access) ||
    (await hasPurchasedWallpaper(access.user.id, wallpaperId))
  ) {
    return NextResponse.json({ alreadyEntitled: true, downloadUrl });
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || requestOrigin;

  const metadata = {
    wallpaper_id: wallpaperId,
    user_id: access.user.id,
    series_slug: series,
    display_code: code,
    variant_number: String(variant),
  };

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [
        { price: process.env.STRIPE_WALLPAPER_PRICE_ID, quantity: 1 },
      ],
      client_reference_id: access.user.id,
      customer_email: access.user.email ?? undefined,
      metadata,
      payment_intent_data: { metadata },
      success_url: `${origin}/works/${series}/${code}/wallpaper?variant=${variant}&purchased=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/works/${series}/${code}/wallpaper?variant=${variant}`,
    });

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
