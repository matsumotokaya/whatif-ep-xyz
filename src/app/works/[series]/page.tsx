import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getAdminAccess } from "@/lib/admin/access";
import {
  getGallerySeries,
  getSeriesDisplayName,
  getWorkCountBySeries,
  getWorkCardsBySeries,
} from "@/lib/works";
import { getPurchasedDisplayCodes } from "@/lib/wallpaper-purchases";
import { getSavedWorkIds } from "@/lib/work-saves";
import { WorksPageClient } from "./WorksPageClient";
import Link from "next/link";

interface WorksSeriesPageProps {
  params: Promise<{ series: string }>;
}

// Streams the admin-only "Add episode" button without blocking the catalog.
// getAdminAccess() makes a Supabase auth round-trip; isolating it here keeps the
// cached gallery in the static shell so it paints immediately.
async function AddEpisodeButton({ series }: { series: string }) {
  if (series !== "episode") return null;
  const adminAccess = await getAdminAccess();
  if (!adminAccess.isAdmin) return null;
  return (
    <Link
      href="/episodes/new"
      className="btn-press inline-flex items-center rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
    >
      Add episode
    </Link>
  );
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

export default async function WorksSeriesPage({ params }: WorksSeriesPageProps) {
  const { series } = await params;

  // Catalog data (cached via unstable_cache) — fast, forms the static shell.
  const [seriesOptions, works, total] = await Promise.all([
    getGallerySeries(),
    getWorkCardsBySeries(series, "newest"),
    getWorkCountBySeries(series),
  ]);

  const selectedSeries = seriesOptions.find((item) => item.slug === series);
  if (!selectedSeries) notFound();

  // User-specific data makes Supabase auth round-trips. Start the work here but
  // do NOT await: the promises are streamed into the client tree so the gallery
  // paints immediately and the saved/purchased state fills in when it resolves.
  const purchasedCodesPromise = getPurchasedDisplayCodes(series);
  const savedWorkIdsPromise = getSavedWorkIds(series);

  return (
    <div className="w-full px-3 py-6 sm:px-5 sm:py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Gallery
          </h1>
          <h2 className="sr-only">{selectedSeries.name}</h2>
          <p className="mt-1 text-sm text-muted">
            {selectedSeries.name} / {total} works
          </p>
        </div>

        <Suspense fallback={null}>
          <AddEpisodeButton series={series} />
        </Suspense>
      </div>

      <WorksPageClient
        series={seriesOptions}
        selectedSeriesSlug={series}
        works={works}
        total={total}
        purchasedCodesPromise={purchasedCodesPromise}
        savedWorkIdsPromise={savedWorkIdsPromise}
      />
    </div>
  );
}
