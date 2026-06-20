import type { Metadata } from "next";
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

export async function generateMetadata({
  params,
}: WorksSeriesPageProps): Promise<Metadata> {
  const { series } = await params;
  const name = await getSeriesDisplayName(series);
  return {
    title: `${name} Gallery`,
    description: `Browse WHATIF ${name.toLowerCase()} works`,
  };
}

export default async function WorksSeriesPage({ params }: WorksSeriesPageProps) {
  const { series } = await params;
  const [seriesOptions, works, total, adminAccess, purchasedCodes, savedWorkIds] =
    await Promise.all([
      getGallerySeries(),
      getWorkCardsBySeries(series, "newest"),
      getWorkCountBySeries(series),
      getAdminAccess(),
      getPurchasedDisplayCodes(series),
      getSavedWorkIds(series),
    ]);

  const selectedSeries = seriesOptions.find((item) => item.slug === series);
  if (!selectedSeries) notFound();

  return (
    <div className="w-full px-3 py-6 sm:px-5 sm:py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Gallery
          </h1>
          <p className="mt-1 text-sm text-muted">
            {selectedSeries.name} / {total} works
          </p>
        </div>

        {adminAccess.isAdmin && series === "episode" && (
          <Link
            href="/episodes/new"
            className="btn-press inline-flex items-center rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
          >
            Add episode
          </Link>
        )}
      </div>

      <WorksPageClient
        series={seriesOptions}
        selectedSeriesSlug={series}
        works={works}
        total={total}
        purchasedCodes={purchasedCodes}
        savedWorkIds={savedWorkIds}
      />
    </div>
  );
}
