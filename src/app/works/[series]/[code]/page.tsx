import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminAccess } from "@/lib/admin/access";
import { EpisodeDetailImage } from "@/components/EpisodeDetailImage";
import { WorkDetailActions } from "@/components/WorkDetailActions";
import { GallerySeriesSelect } from "@/components/GallerySeriesSelect";
import {
  getVariantDetailImageCandidates,
  getVariantDisplayImageCandidates,
} from "@/lib/work-images";
import { getPublishedWallpaperPack } from "@/lib/wallpaper";
import { getClubAccess } from "@/lib/club/access";
import { hasPurchasedWallpaper } from "@/lib/wallpaper-purchases";
import { getSavedWorkIds } from "@/lib/work-saves";
import { SavedWorksProvider } from "@/context/SavedWorksContext";
import { SaveButton } from "@/components/SaveButton";
import { OtherWallpapers } from "@/components/OtherWallpapers";
import {
  getAdjacentWorks,
  getGallerySeries,
  getNearbyWallpapers,
  getWorkBySeriesAndCode,
} from "@/lib/works";

interface WorkDetailPageProps {
  params: Promise<{ series: string; code: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function resolveDownloadExtension(storageKey: string | null): "png" | "jpg" | "webp" {
  const lower = (storageKey ?? "").toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "jpg";
  if (lower.endsWith(".webp")) return "webp";
  return "png";
}

function resolveOfferUrl(targetUrl: string | null | undefined) {
  return targetUrl && targetUrl.trim().length > 0 ? targetUrl : null;
}

// An offer is "ready" only when its status is ready AND it has a usable URL.
function resolveReadyOfferUrl(
  status: string | null | undefined,
  targetUrl: string | null | undefined
) {
  return status === "ready" ? resolveOfferUrl(targetUrl) : null;
}

export async function generateMetadata({
  params,
}: WorkDetailPageProps): Promise<Metadata> {
  const { series, code } = await params;
  const work = await getWorkBySeriesAndCode(series, code);
  if (!work) return { title: "Not Found" };

  const canonical = `/works/${work.seriesSlug}/${work.displayCode}`;
  const descriptionParts = [
    work.title,
    work.themeCategory,
    work.summary,
  ].filter((part): part is string => Boolean(part && part.trim().length > 0));
  const description =
    descriptionParts.join(" - ") || `WHATIF ${work.seriesName} ${work.displayCode}`;

  const ogImage = work.primaryVariant
    ? getVariantDisplayImageCandidates(work.primaryVariant)[0]
    : undefined;
  const images = ogImage ? [ogImage] : undefined;

  return {
    title: `${work.seriesName} ${work.displayCode}`,
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      title: `${work.seriesName} ${work.displayCode} - ${work.title}`,
      description,
      url: canonical,
      ...(images ? { images } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: `${work.seriesName} ${work.displayCode} - ${work.title}`,
      description,
      ...(images ? { images } : {}),
    },
  };
}

export default async function WorkDetailPage({
  params,
  searchParams,
}: WorkDetailPageProps) {
  const emptySearchParams: Record<string, string | string[] | undefined> = {};
  const [{ series, code }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(emptySearchParams),
  ]);

  const work = await getWorkBySeriesAndCode(series, code);
  if (!work) notFound();

  const variantParam = resolvedSearchParams.variant;
  const variantValue = Array.isArray(variantParam) ? variantParam[0] : variantParam;
  const variantNumber = Number.parseInt(variantValue ?? "", 10);
  const currentVariant =
    work.variants.find((variant) => variant.variantNumber === variantNumber) ??
    work.primaryVariant;

  if (!currentVariant || !currentVariant.originalStorageKey) notFound();

  // Catalog data (cached) — fast, forms the static shell.
  const [seriesOptions, adjacent, wallpaperPack, nearbyWallpapers] = await Promise.all([
    getGallerySeries(),
    getAdjacentWorks(series, work.sequenceNumber),
    getPublishedWallpaperPack(
      work.seriesSlug,
      work.displayCode,
      currentVariant.variantNumber
    ),
    getNearbyWallpapers(work.seriesSlug, work.id, work.sequenceNumber, 9),
  ]);

  // User-specific data makes Supabase auth round-trips. Start the work but do
  // NOT await: stream the resulting flags into the client tree so the page
  // (image, nav, title, CTAs) paints immediately.
  const isAdminPromise = getAdminAccess().then((access) => access.isAdmin);

  // Saved-state for this single work, streamed as a list the provider merges in.
  const initialSavedIdsPromise = getSavedWorkIds(work.seriesSlug).then((ids) =>
    ids.includes(work.id) ? [work.id] : []
  );

  // Flag the current variant's wallpaper as purchased for non-premium buyers.
  // Premium users get access via subscription (shown via the crown), so they
  // are intentionally excluded from the "purchased" badge.
  const wallpaperPurchasedPromise: Promise<boolean> = wallpaperPack
    ? getClubAccess().then(async (access) => {
        if (access.user && access.status !== "premium") {
          return hasPurchasedWallpaper(access.user.id, wallpaperPack.projectId);
        }
        return false;
      })
    : Promise.resolve(false);

  const imageCandidates = getVariantDetailImageCandidates(currentVariant);
  const releasedOn = formatDate(work.releasedOn ?? work.createdAt);
  const updatedOn = formatDate(work.updatedAt);
  const publishedOn = formatDate(work.publishedAt);
  const downloadFilename = `whatif-${work.displayCode}-${currentVariant.variantNumber}.${resolveDownloadExtension(
    currentVariant.originalStorageKey
  )}`;
  const downloadUrl = `/api/works/${work.seriesSlug}/${work.displayCode}/download?variant=${currentVariant.variantNumber}&filename=${encodeURIComponent(downloadFilename)}`;
  const wallpaperHref = `/works/${work.seriesSlug}/${work.displayCode}/wallpaper${
    currentVariant.variantNumber > 1 ? `?variant=${currentVariant.variantNumber}` : ""
  }`;

  const dates = [
    releasedOn && { label: "Released", value: releasedOn },
    updatedOn && { label: "Updated", value: updatedOn },
    publishedOn && { label: "Published", value: publishedOn },
  ].filter(Boolean) as { label: string; value: string }[];

  const imagineOffer =
    currentVariant.offers.find((offer) => offer.offerType === "imagine_starter") ??
    work.offers.find((offer) => offer.offerType === "imagine_starter") ??
    null;
  const storeOffer =
    currentVariant.offers.find((offer) => offer.offerType === "store_product") ??
    work.offers.find((offer) => offer.offerType === "store_product") ??
    null;

  // Shared IMAGINE destination: drives both the violet CTA and the clickable
  // artwork shortcut. Null when no ready starter offer exists.
  const imagineUrl = resolveReadyOfferUrl(
    imagineOffer?.status,
    imagineOffer?.targetUrl
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: work.title,
    headline: `${work.seriesName} ${work.displayCode}`,
    ...(work.themeCategory ? { genre: work.themeCategory } : {}),
    ...(imageCandidates.length > 0 ? { image: imageCandidates } : {}),
    ...(work.publishedAt ? { datePublished: work.publishedAt } : {}),
    ...(work.updatedAt ? { dateModified: work.updatedAt } : {}),
  };

  return (
    <SavedWorksProvider initialSavedIdsPromise={initialSavedIdsPromise}>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background lg:overflow-hidden">
      <div className="flex flex-col lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="relative h-[58vh] shrink-0 bg-surface/30 lg:h-auto lg:min-h-0">
          <EpisodeDetailImage
            candidates={imageCandidates}
            alt={work.title}
            imagineUrl={imagineUrl}
          />

          {/* Save button overlaid at the top-right of the image */}
          <div className="absolute right-3 top-14 z-20 sm:right-4">
            <SaveButton workId={work.id} size="detail" />
          </div>

          {/* Top navigation bar overlaid on the image (desktop + mobile) */}
          <div className="absolute inset-x-0 top-0 z-10">
            <div className="flex items-center justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
              {adjacent.prev ? (
                <Link
                  href={`/works/${work.seriesSlug}/${adjacent.prev.displayCode}`}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-surface-hover"
                >
                  <svg
                    className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  #{adjacent.prev.displayCode}
                </Link>
              ) : (
                <span className="inline-flex items-center rounded-full border border-border/40 px-3 py-1.5 text-xs text-muted/40">
                  Prev
                </span>
              )}

              <Link
                href={`/works/${work.seriesSlug}`}
                className="btn-press inline-flex items-center justify-center rounded-full border border-border bg-background/70 px-4 py-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-foreground backdrop-blur-sm transition-colors hover:bg-surface-hover"
              >
                Gallery
              </Link>

              {adjacent.next ? (
                <Link
                  href={`/works/${work.seriesSlug}/${adjacent.next.displayCode}`}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-surface-hover"
                >
                  #{adjacent.next.displayCode}
                  <svg
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ) : (
                <span className="inline-flex items-center rounded-full border border-border/40 px-3 py-1.5 text-xs text-muted/40">
                  Next
                </span>
              )}
            </div>
          </div>

        </div>

        <aside className="flex flex-col border-t border-border bg-background/95 backdrop-blur-sm lg:border-l lg:border-t-0">
          <div className="flex min-h-0 flex-1 flex-col px-6 py-5 lg:overflow-y-auto">
            <div className="flex items-center justify-between gap-3">
              <GallerySeriesSelect series={seriesOptions} selectedSlug={work.seriesSlug} />
            </div>

            <div className="mt-5">
              <p className="font-mono text-lg text-muted">#{work.displayCode}</p>
              <h1 className="mt-1 text-xl font-bold sm:text-2xl">{work.title}</h1>
              {work.tags.length > 0 && (
                <div className="mt-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted">
                    Work Tags
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {work.tags.map((tag) => (
                      <Link
                        key={tag.id}
                        href={`/works/${work.seriesSlug}?tag=${encodeURIComponent(tag.slug)}`}
                        className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted"
                      >
                        {tag.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {work.summary && (
                <div className="mt-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted">
                    Summary
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {work.summary}
                  </p>
                </div>
              )}

              {work.variants.length > 1 && (
                <div className="mt-6">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted">Variants</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {work.variants
                      .filter((variant) => variant.status !== "hidden")
                      .map((variant) => {
                        const active = variant.id === currentVariant.id;
                        return (
                          <Link
                            key={variant.id}
                            href={`/works/${work.seriesSlug}/${work.displayCode}?variant=${variant.variantNumber}`}
                            className={`btn-press inline-flex min-w-9 items-center justify-center rounded-full border px-3 py-1 text-xs transition-colors ${
                              active
                                ? "border-foreground bg-foreground text-background"
                                : "border-border text-foreground hover:bg-surface-hover"
                            }`}
                          >
                            {variant.variantNumber}
                          </Link>
                        );
                      })}
                  </div>
                </div>
              )}

              <dl className="mt-4 space-y-1.5 text-xs">
                {dates.map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between gap-3">
                    <dt className="text-[10px] uppercase tracking-[0.18em] text-muted">{label}</dt>
                    <dd className="font-mono text-foreground">{value}</dd>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[10px] uppercase tracking-[0.18em] text-muted">Status</dt>
                  <dd>
                    <span
                      className={`inline-flex items-center gap-1.5 ${work.status === "published" ? "text-foreground" : "text-muted"}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${work.status === "published" ? "bg-foreground" : "bg-muted/50"}`}
                      />
                      {work.status === "published" ? "Published" : "Draft"}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>

            <WorkDetailActions
              isAdminPromise={isAdminPromise}
              editHref={
                work.legacyEpisodeId
                  ? `/episodes/${work.displayCode}/edit`
                  : null
              }
              imagineUrl={imagineUrl}
              downloadUrl={downloadUrl}
              downloadFilename={downloadFilename}
              storeUrl={resolveOfferUrl(storeOffer?.targetUrl)}
              wallpaperHref={wallpaperHref}
              wallpaperCoverUrl={wallpaperPack?.cover?.publicUrl ?? null}
              wallpaperPurchasedPromise={wallpaperPurchasedPromise}
              workTitle={work.title}
            />

            <OtherWallpapers items={nearbyWallpapers} />
          </div>

        </aside>
      </div>
    </div>
    </SavedWorksProvider>
  );
}
