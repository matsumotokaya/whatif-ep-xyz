import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getGallerySeries,
  getSeriesDisplayName,
  getWorkCardsPageBySeries,
  getWorkFilterMetaBySeries,
} from "@/lib/works";
import { getPurchasedDisplayCodes } from "@/lib/wallpaper-purchases";
import { getSavedWorkIds } from "@/lib/work-saves";
import { WorksPageClient } from "./WorksPageClient";

interface WorksSeriesPageProps {
  params: Promise<{ series: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
  params,
}: WorksSeriesPageProps): Promise<Metadata> {
  const { series } = await params;
  const name = await getSeriesDisplayName(series);
  return {
    title: `${name} Gallery`,
    description: `Browse WHATIF ${name.toLowerCase()} works`,
    alternates: { canonical: `/works/${series}` },
  };
}

export default async function WorksSeriesPage({
  params,
  searchParams,
}: WorksSeriesPageProps) {
  const emptySearchParams: Record<string, string | string[] | undefined> = {};
  const [{ series }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(emptySearchParams),
  ]);
  const tagParam = resolvedSearchParams.tag;
  const initialSelectedTagId = Array.isArray(tagParam) ? tagParam[0] : tagParam;

  // Catalog data (cached via unstable_cache) — fast, forms the static shell.
  const [seriesOptions, initialPage, filterMeta] = await Promise.all([
    getGallerySeries(),
    getWorkCardsPageBySeries(series),
    getWorkFilterMetaBySeries(series),
  ]);

  const selectedSeries = seriesOptions.find((item) => item.slug === series);
  if (!selectedSeries) notFound();

  // User-specific data makes Supabase auth round-trips. Start the work here but
  // do NOT await: the promises are streamed into the client tree so the gallery
  // paints immediately and the saved/purchased state fills in when it resolves.
  const purchasedCodesPromise = getPurchasedDisplayCodes(series);
  const savedWorkIdsPromise = getSavedWorkIds();

  return (
    <div className="w-full px-3 py-6 sm:px-5 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Gallery
        </h1>
        <h2 className="sr-only">{selectedSeries.name}</h2>
        <p className="mt-1 text-sm text-muted">
          {selectedSeries.name} / {filterMeta.total} works
        </p>
      </div>

      <WorksPageClient
        series={seriesOptions}
        selectedSeriesSlug={series}
        initialPage={initialPage}
        filterMeta={filterMeta}
        purchasedCodesPromise={purchasedCodesPromise}
        savedWorkIdsPromise={savedWorkIdsPromise}
        initialSelectedTagId={initialSelectedTagId ?? null}
      />
    </div>
  );
}
