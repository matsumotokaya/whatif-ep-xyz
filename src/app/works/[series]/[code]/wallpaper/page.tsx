import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { canAccessClub, getClubAccess } from "@/lib/club/access";
import { getPublishedWallpaperPack } from "@/lib/wallpaper";
import {
  hasPurchasedWallpaper,
  isValidWallpaperDownloadToken,
  verifyAndRecordCheckoutSession,
} from "@/lib/wallpaper-purchases";
import { getWorkBySeriesAndCode } from "@/lib/works";
import WallpaperPageContent from "./WallpaperPageContent";

const IMAGINE_PLANS_BASE_URL = "/plans";

interface WallpaperPageProps {
  params: Promise<{ series: string; code: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function resolveVariantNumber(
  searchParams: Record<string, string | string[] | undefined>
): number {
  const raw = searchParams.variant;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export async function generateMetadata({
  params,
  searchParams,
}: WallpaperPageProps): Promise<Metadata> {
  const emptySearchParams: Record<string, string | string[] | undefined> = {};
  const [{ series, code }] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(emptySearchParams),
  ]);

  const work = await getWorkBySeriesAndCode(series, code);
  if (!work) return { title: "Not Found" };

  return {
    title: `${work.seriesName} ${work.displayCode} Wallpaper`,
    description: `${work.title} wallpaper pack`,
  };
}

export default async function WallpaperPage({
  params,
  searchParams,
}: WallpaperPageProps) {
  const emptySearchParams: Record<string, string | string[] | undefined> = {};
  const [{ series, code }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(emptySearchParams),
  ]);

  const variantNumber = resolveVariantNumber(resolvedSearchParams);

  const [work, pack] = await Promise.all([
    getWorkBySeriesAndCode(series, code),
    getPublishedWallpaperPack(series, code, variantNumber),
  ]);

  if (!work || !pack) notFound();

  const access = await getClubAccess();
  const isPremium = canAccessClub(access);

  const purchasedFlagRaw = resolvedSearchParams.purchased;
  const purchasedValue = Array.isArray(purchasedFlagRaw)
    ? purchasedFlagRaw[0]
    : purchasedFlagRaw;
  const sessionRaw = resolvedSearchParams.session_id;
  const sessionId = Array.isArray(sessionRaw) ? sessionRaw[0] : sessionRaw;
  const tokenRaw = resolvedSearchParams.token;
  const downloadToken = Array.isArray(tokenRaw) ? tokenRaw[0] : tokenRaw;

  // Token entitlement (guest purchase / emailed link): valid for exactly this
  // wallpaper, no login session required.
  let tokenEntitled = false;
  if (downloadToken) {
    tokenEntitled = await isValidWallpaperDownloadToken(
      downloadToken,
      pack.projectId
    );
  }

  // Guest success redirect: an anonymous buyer lands with a session id but no
  // token yet. Verify the session with Stripe (recording the purchase if the
  // webhook has not arrived) and redirect to a stable tokenized URL so the
  // download keeps working across reloads. redirect() throws, so it stays
  // outside the try block.
  if (!access.user && !tokenEntitled && purchasedValue === "1" && sessionId) {
    let guestToken: string | null = null;
    try {
      const result = await verifyAndRecordCheckoutSession(sessionId);
      guestToken = result.downloadToken;
    } catch {
      // Best-effort; the emailed link still works once the webhook lands.
    }
    if (guestToken) {
      redirect(
        `/works/${series}/${code}/wallpaper?variant=${variantNumber}&purchased=1&token=${guestToken}`
      );
    }
  }

  // Non-premium signed-in users may own this specific wallpaper via one-time
  // purchase. Resolve ownership and, on the Stripe success redirect, fall back
  // to verifying the session directly in case the webhook is delayed.
  let hasPurchased = false;
  if (!isPremium && access.user) {
    hasPurchased = await hasPurchasedWallpaper(access.user.id, pack.projectId);

    if (purchasedValue === "1" && sessionId && !hasPurchased) {
      try {
        await verifyAndRecordCheckoutSession(sessionId);
        hasPurchased = await hasPurchasedWallpaper(
          access.user.id,
          pack.projectId
        );
      } catch {
        // Best-effort; webhook will reconcile if this fails.
      }
    }
  }

  const justPurchased = purchasedValue === "1";

  const entitled = isPremium || hasPurchased || tokenEntitled;

  const variantQuery = variantNumber > 1 ? `?variant=${variantNumber}` : "";
  const downloadUrl =
    `/api/works/${series}/${code}/wallpaper/download?variant=${variantNumber}` +
    (tokenEntitled && downloadToken
      ? `&token=${encodeURIComponent(downloadToken)}`
      : "");
  const galleryOrigin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://whatif-ep.xyz";
  const returnTo = `${galleryOrigin}/works/${series}/${code}/wallpaper${variantQuery}`;
  const imaginePlansUrl = `${IMAGINE_PLANS_BASE_URL}?source=gallery&return_to=${encodeURIComponent(returnTo)}`;
  const loginUrl = `/auth/login?next=${encodeURIComponent(`/works/${series}/${code}/wallpaper${variantQuery}`)}`;

  return (
    <WallpaperPageContent
      pack={{ cover: pack.cover, wallpapers: pack.wallpapers }}
      workTitle={work.title}
      workDisplayCode={work.displayCode}
      series={series}
      code={code}
      variantNumber={variantNumber}
      entitled={entitled}
      hasPurchased={hasPurchased || tokenEntitled}
      isPremium={isPremium}
      isLoggedIn={Boolean(access.user)}
      tokenEntitled={tokenEntitled}
      justPurchased={justPurchased}
      downloadUrl={downloadUrl}
      imaginePlansUrl={imaginePlansUrl}
      loginUrl={loginUrl}
      variantQuery={variantQuery}
    />
  );
}
