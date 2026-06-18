import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type {
  GallerySeries,
  Work,
  WorkOffer,
  WorkOfferRow,
  WorkRow,
  WorkSeriesRow,
  WorkVariant,
  WorkVariantRow,
} from "./types";

const SERIES_COLUMNS = [
  "id",
  "slug",
  "name",
  "route_base",
  "number_padding",
  "sort_order",
  "is_public",
].join(", ");

const WORK_COLUMNS = [
  "id",
  "series_id",
  "legacy_episode_id",
  "sequence_number",
  "display_code",
  "slug",
  "title",
  "theme_category",
  "summary",
  "released_on",
  "status",
  "published_at",
  "is_featured",
  "created_at",
  "updated_at",
].join(", ");

const VARIANT_COLUMNS = [
  "id",
  "work_id",
  "variant_number",
  "display_code",
  "title",
  "caption",
  "variant_type",
  "original_storage_key",
  "thumbnail_storage_key",
  "width",
  "height",
  "status",
  "sort_order",
  "is_primary",
  "created_at",
  "updated_at",
].join(", ");

const OFFER_COLUMNS = [
  "id",
  "work_id",
  "variant_id",
  "offer_type",
  "plan_type",
  "status",
  "title",
  "description",
  "target_ref",
  "target_url",
  "sort_order",
  "created_at",
  "updated_at",
].join(", ");

const CHUNK_SIZE = 100;

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function mapSeries(row: WorkSeriesRow, workCount: number): GallerySeries {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    routeBase: row.route_base,
    numberPadding: row.number_padding,
    sortOrder: row.sort_order,
    isPublic: row.is_public,
    workCount,
  };
}

function mapOffer(row: WorkOfferRow): WorkOffer {
  return {
    id: row.id,
    workId: row.work_id,
    variantId: row.variant_id,
    offerType: row.offer_type,
    planType: row.plan_type,
    status: row.status,
    title: row.title,
    description: row.description,
    targetRef: row.target_ref,
    targetUrl: row.target_url,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapVariant(row: WorkVariantRow, offers: WorkOffer[]): WorkVariant {
  return {
    id: row.id,
    workId: row.work_id,
    variantNumber: row.variant_number,
    displayCode: row.display_code,
    title: row.title,
    caption: row.caption,
    variantType: row.variant_type,
    originalStorageKey: row.original_storage_key,
    thumbnailStorageKey: row.thumbnail_storage_key,
    width: row.width,
    height: row.height,
    status: row.status,
    sortOrder: row.sort_order,
    isPrimary: row.is_primary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    offers,
  };
}

function mapWork(
  row: WorkRow,
  series: WorkSeriesRow,
  variants: WorkVariant[],
  offers: WorkOffer[]
): Work {
  const primaryVariant =
    variants.find((variant) => variant.isPrimary) ?? variants[0] ?? null;

  return {
    id: row.id,
    seriesId: row.series_id,
    seriesSlug: series.slug,
    seriesName: series.name,
    legacyEpisodeId: row.legacy_episode_id,
    sequenceNumber: row.sequence_number,
    displayCode: row.display_code,
    slug: row.slug,
    title: row.title,
    themeCategory: row.theme_category,
    summary: row.summary,
    releasedOn: row.released_on,
    status: row.status,
    publishedAt: row.published_at,
    isFeatured: row.is_featured,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    variants,
    offers,
    primaryVariant,
  };
}

const getSeriesRows = cache(async (): Promise<WorkSeriesRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("work_series")
    .select(SERIES_COLUMNS)
    .order("sort_order", { ascending: true })
    .order("slug", { ascending: true });

  if (error) {
    throw new Error(`Failed to load work series: ${error.message}`);
  }

  return (data ?? []) as unknown as WorkSeriesRow[];
});

async function getSeriesBySlug(slug: string): Promise<WorkSeriesRow | undefined> {
  const rows = await getSeriesRows();
  return rows.find((row) => row.slug === slug);
}

async function loadVisibleWorksBySeries(seriesSlug: string): Promise<Work[]> {
  const series = await getSeriesBySlug(seriesSlug);
  if (!series) return [];

  const supabase = await createClient();
  const { data: worksData, error: worksError } = await supabase
    .from("works")
    .select(WORK_COLUMNS)
    .eq("series_id", series.id)
    .order("sequence_number", { ascending: true });

  if (worksError) {
    throw new Error(`Failed to load works: ${worksError.message}`);
  }

  const workRows = (worksData ?? []) as unknown as WorkRow[];
  if (workRows.length === 0) return [];

  const workIds = workRows.map((row) => row.id);
  const workIdChunks = chunkArray(workIds, CHUNK_SIZE);

  const [variantChunks, offerChunks] = await Promise.all([
    Promise.all(
      workIdChunks.map(async (chunk) => {
        const { data, error } = await supabase
          .from("work_variants")
          .select(VARIANT_COLUMNS)
          .in("work_id", chunk)
          .order("sort_order", { ascending: true })
          .order("variant_number", { ascending: true });

        if (error) {
          throw new Error(`Failed to load work variants: ${error.message}`);
        }

        return (data ?? []) as unknown as WorkVariantRow[];
      })
    ),
    Promise.all(
      workIdChunks.map(async (chunk) => {
        const { data, error } = await supabase
          .from("work_offers")
          .select(OFFER_COLUMNS)
          .in("work_id", chunk)
          .order("sort_order", { ascending: true })
          .order("offer_type", { ascending: true });

        if (error) {
          throw new Error(`Failed to load work offers: ${error.message}`);
        }

        return (data ?? []) as unknown as WorkOfferRow[];
      })
    ),
  ]);

  const variantRows = variantChunks.flat();
  const offerRows = offerChunks.flat();
  const offersByVariantId = new Map<string, WorkOffer[]>();
  const offersByWorkId = new Map<string, WorkOffer[]>();

  for (const row of offerRows) {
    const offer = mapOffer(row);
    if (offer.variantId) {
      const bucket = offersByVariantId.get(offer.variantId) ?? [];
      bucket.push(offer);
      offersByVariantId.set(offer.variantId, bucket);
    } else {
      const bucket = offersByWorkId.get(offer.workId) ?? [];
      bucket.push(offer);
      offersByWorkId.set(offer.workId, bucket);
    }
  }

  const variantsByWorkId = new Map<string, WorkVariant[]>();
  for (const row of variantRows) {
    const variant = mapVariant(row, offersByVariantId.get(row.id) ?? []);
    const bucket = variantsByWorkId.get(row.work_id) ?? [];
    bucket.push(variant);
    variantsByWorkId.set(row.work_id, bucket);
  }

  return workRows.map((row) =>
    mapWork(
      row,
      series,
      variantsByWorkId.get(row.id) ?? [],
      offersByWorkId.get(row.id) ?? []
    )
  );
}

const getVisibleWorksBySeries = cache(loadVisibleWorksBySeries);

export const getGallerySeries = cache(async (): Promise<GallerySeries[]> => {
  const [seriesRows, worksRows] = await Promise.all([
    getSeriesRows(),
    (async () => {
      const supabase = await createClient();
      const { data, error } = await supabase.from("works").select("series_id");
      if (error) {
        throw new Error(`Failed to count works: ${error.message}`);
      }
      return (data ?? []) as unknown as { series_id: string }[];
    })(),
  ]);

  const counts = new Map<string, number>();
  for (const row of worksRows) {
    counts.set(row.series_id, (counts.get(row.series_id) ?? 0) + 1);
  }

  return seriesRows.map((row) => mapSeries(row, counts.get(row.id) ?? 0));
});

export async function getWorksBySeries(
  seriesSlug: string,
  sort: "newest" | "oldest" = "newest"
): Promise<Work[]> {
  const works = await getVisibleWorksBySeries(seriesSlug);
  return sort === "newest" ? [...works].reverse() : works;
}

export async function getWorkBySeriesAndCode(
  seriesSlug: string,
  code: string
): Promise<Work | undefined> {
  const works = await getVisibleWorksBySeries(seriesSlug);
  return works.find((work) => work.displayCode === code);
}

export async function getAdjacentWorks(
  seriesSlug: string,
  workId: string
): Promise<{ prev: Work | undefined; next: Work | undefined }> {
  const works = await getVisibleWorksBySeries(seriesSlug);
  const index = works.findIndex((work) => work.id === workId);

  return {
    prev: index > 0 ? works[index - 1] : undefined,
    next: index >= 0 && index < works.length - 1 ? works[index + 1] : undefined,
  };
}

export async function getWorkCountBySeries(seriesSlug: string): Promise<number> {
  const works = await getVisibleWorksBySeries(seriesSlug);
  return works.length;
}

export async function getPrimarySeriesSlug(): Promise<string> {
  const series = await getGallerySeries();
  const firstAvailable = series.find((item) => item.workCount > 0);
  return firstAvailable?.slug ?? "episode";
}

export async function getSeriesDisplayName(seriesSlug: string): Promise<string> {
  const series = await getSeriesBySlug(seriesSlug);
  return series?.name ?? seriesSlug;
}
