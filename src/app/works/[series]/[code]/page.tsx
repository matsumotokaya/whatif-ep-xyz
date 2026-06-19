import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminAccess } from "@/lib/admin/access";
import { EpisodeDetailImage } from "@/components/EpisodeDetailImage";
import { EpisodeDownloadButton } from "@/components/EpisodeDownloadButton";
import { GallerySeriesSelect } from "@/components/GallerySeriesSelect";
import { WorkMobileInfo } from "@/components/WorkMobileInfo";
import { getVariantDisplayImageCandidates } from "@/lib/work-images";
import { getPublishedWallpaperPack } from "@/lib/wallpaper";
import { getAdjacentWorks, getGallerySeries, getWorkBySeriesAndCode } from "@/lib/works";

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

export async function generateMetadata({
  params,
}: WorkDetailPageProps): Promise<Metadata> {
  const { series, code } = await params;
  const work = await getWorkBySeriesAndCode(series, code);
  if (!work) return { title: "Not Found" };

  return {
    title: `${work.seriesName} ${work.displayCode}`,
    description: `${work.title} - ${work.themeCategory}`,
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

  const [seriesOptions, adjacent, adminAccess, wallpaperPack] = await Promise.all([
    getGallerySeries(),
    getAdjacentWorks(series, work.id),
    getAdminAccess(),
    getPublishedWallpaperPack(
      work.seriesSlug,
      work.displayCode,
      currentVariant.variantNumber
    ),
  ]);

  const imageCandidates = getVariantDisplayImageCandidates(currentVariant);
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

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-1">
        <div className="relative min-h-0 bg-surface/30">
          <EpisodeDetailImage candidates={imageCandidates} alt={work.title} />

          {/* Top navigation bar overlaid on the image (desktop + mobile) */}
          <div className="absolute inset-x-0 top-0 z-10">
            <div className="flex items-center justify-between gap-2 bg-gradient-to-b from-background/80 via-background/40 to-transparent px-3 py-2.5 sm:px-4 sm:py-3">
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

          <div className="absolute inset-x-0 bottom-0 lg:hidden">
            <div className="mx-3 mb-3 rounded-2xl border border-border bg-background/90 shadow-lg backdrop-blur-lg">
              <div className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] text-muted">
                      #{work.displayCode}
                      {work.variants.length > 1 ? ` / ${currentVariant.variantNumber}` : ""}
                    </p>
                    <p className="truncate text-sm font-semibold text-foreground">{work.title}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <EpisodeDownloadButton
                      url={downloadUrl}
                      filename={downloadFilename}
                      className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-3 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-surface-hover"
                    >
                      Download
                    </EpisodeDownloadButton>
                    <WorkMobileInfo
                      work={work}
                      variant={currentVariant}
                      dates={dates}
                      isAdmin={adminAccess.isAdmin}
                      downloadUrl={downloadUrl}
                      downloadFilename={downloadFilename}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="hidden flex-col border-t border-border bg-background/95 backdrop-blur-sm lg:flex lg:border-l lg:border-t-0">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-5">
            <div className="flex items-center justify-between gap-3">
              <GallerySeriesSelect series={seriesOptions} selectedSlug={work.seriesSlug} />
            </div>

            <div className="mt-5">
              <p className="font-mono text-lg text-muted">#{work.displayCode}</p>
              <h1 className="mt-1 text-xl font-bold sm:text-2xl">{work.title}</h1>
              {work.themeCategory && (
                <p className="mt-2 text-sm text-muted">{work.themeCategory}</p>
              )}

              {work.variants.length > 1 && (
                <div className="mt-5">
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

            <div className="mt-5 flex flex-col gap-2">
              {adminAccess.isAdmin && work.legacyEpisodeId && (
                <Link
                  href={`/episodes/${work.displayCode}/edit`}
                  className="btn-press inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
                >
                  Edit
                </Link>
              )}

              <EpisodeDownloadButton
                url={downloadUrl}
                filename={downloadFilename}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80"
              >
                Download
              </EpisodeDownloadButton>

              {resolveOfferUrl(imagineOffer?.targetUrl) ? (
                <a
                  href={resolveOfferUrl(imagineOffer?.targetUrl)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-press inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
                >
                  Edit in IMAGINE
                </a>
              ) : (
                <span className="inline-flex items-center justify-center rounded-lg border border-dashed border-border px-4 py-2 text-sm text-muted">
                  IMAGINE: Preparing
                </span>
              )}

              {resolveOfferUrl(storeOffer?.targetUrl) && (
                <a
                  href={resolveOfferUrl(storeOffer?.targetUrl)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-press inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
                >
                  Store Item
                </a>
              )}
            </div>

            {wallpaperPack?.cover && (
              <div className="mt-5 border-t border-border pt-5">
                <p className="text-xs font-medium text-foreground">
                  ノンクレジット版壁紙ダウンロードはこちらから
                </p>
                <Link
                  href={wallpaperHref}
                  className="mt-3 flex items-center gap-3 transition-opacity hover:opacity-90"
                >
                  <span className="block shrink-0 overflow-hidden rounded-lg border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={wallpaperPack.cover.publicUrl}
                      alt={`${work.title} wallpaper`}
                      className="h-20 w-20 object-cover"
                    />
                  </span>
                  <dl className="min-w-0 flex-1 space-y-1.5">
                    <div>
                      <dt className="text-[10px] uppercase tracking-[0.18em] text-muted">Mobile</dt>
                      <dd className="text-[11px] text-muted">FULL HD · QHD（1080–1440px幅）</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-[0.18em] text-muted">Desktop</dt>
                      <dd className="text-[11px] text-muted">FULL HD · QHD（1920–2560px幅）</dd>
                    </div>
                  </dl>
                </Link>
              </div>
            )}
          </div>

        </aside>
      </div>
    </div>
  );
}
