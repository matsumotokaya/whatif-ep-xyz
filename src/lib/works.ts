import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";
import {
  getSeriesFeedImageMap,
  getSeriesFeedThumbMap,
  getSeriesWallpaperCoverMap,
} from "@/lib/wallpaper";
import type {
  GallerySeries,
  WallpaperCoverItem,
  Work,
  WorkListItem,
  WorkOffer,
  WorkOfferRow,
  WorkRow,
  WorkSeriesRow,
  WorkVariant,
  WorkVariantRow,
} from "./types";
import { getWorkPrimaryImageCandidates } from "./work-images";

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

function mapVariant(
  row: WorkVariantRow,
  offers: WorkOffer[]
): WorkVariant {
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
    feedImageUrl: null,
    feedThumbUrl: null,
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

// ─── Cached: public series list ──────────────────────────────────────────────
// Tags: ['works', 'work_series']  revalidate: 3600s
const _cachedSeriesRows = unstable_cache(
  async (): Promise<WorkSeriesRow[]> => {
    const supabase = createAnonClient();
    const { data, error } = await supabase
      .from("work_series")
      .select(SERIES_COLUMNS)
      .eq("is_public", true)
      .order("sort_order", { ascending: true })
      .order("slug", { ascending: true });

    if (error) {
      throw new Error(`Failed to load work series: ${error.message}`);
    }

    return (data ?? []) as unknown as WorkSeriesRow[];
  },
  ["works:series-rows"],
  { tags: ["works", "work_series"], revalidate: 3600 }
);

// Per-request memoization on top of the persistent cache.
const getSeriesRows = cache(_cachedSeriesRows);

async function getSeriesBySlug(slug: string): Promise<WorkSeriesRow | undefined> {
  const rows = await getSeriesRows();
  return rows.find((row) => row.slug === slug);
}

// ─── Cached: published works for a series ────────────────────────────────────
// Tags: ['works', 'works:<seriesSlug>']  revalidate: 3600s
//
// The anon client is created INSIDE the callback (unstable_cache requirement).
// Only published works and ready/preparing variants are returned; the anon RLS
// already enforces this, but we also add explicit status filters for safety.
const _cachedLoadVisibleWorksBySeries = unstable_cache(
  async (seriesSlug: string): Promise<Work[]> => {
    const supabase = createAnonClient();

    // Re-fetch series row inside cache callback — no cookie client allowed here.
    const { data: seriesData, error: seriesError } = await supabase
      .from("work_series")
      .select(SERIES_COLUMNS)
      .eq("slug", seriesSlug)
      .eq("is_public", true)
      .maybeSingle();

    if (seriesError) {
      throw new Error(`Failed to load series: ${seriesError.message}`);
    }

    const series = seriesData as unknown as WorkSeriesRow | null;
    if (!series) return [];

    const { data: worksData, error: worksError } = await supabase
      .from("works")
      .select(WORK_COLUMNS)
      .eq("series_id", series.id)
      .eq("status", "published")
      .order("sequence_number", { ascending: true });

    if (worksError) {
      throw new Error(`Failed to load works: ${worksError.message}`);
    }

    const workRows = (worksData ?? []) as unknown as WorkRow[];
    if (workRows.length === 0) return [];

    const workIds = workRows.map((row) => row.id);
    const workIdChunks = chunkArray(workIds, CHUNK_SIZE);

    const [variantChunks, offerChunks, feedImageMap, feedThumbMap] = await Promise.all([
      Promise.all(
        workIdChunks.map(async (chunk) => {
          const { data, error } = await supabase
            .from("work_variants")
            .select(VARIANT_COLUMNS)
            .in("work_id", chunk)
            .in("status", ["ready", "preparing"])
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
      getSeriesFeedImageMap(seriesSlug),
      getSeriesFeedThumbMap(seriesSlug),
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

    return workRows.map((row) => {
      const work = mapWork(
        row,
        series,
        variantsByWorkId.get(row.id) ?? [],
        offersByWorkId.get(row.id) ?? []
      );
      work.variants.forEach((variant) => {
        const key = `${work.displayCode}:${variant.variantNumber}`;
        variant.feedImageUrl = feedImageMap.get(key) ?? null;
        variant.feedThumbUrl = feedThumbMap.get(key) ?? null;
      });
      work.feedImageUrl = work.primaryVariant?.feedImageUrl ?? null;
      work.feedThumbUrl = work.primaryVariant?.feedThumbUrl ?? null;
      return work;
    });
  },
  // keyParts prefix — actual cache key includes the seriesSlug argument
  ["works:visible-by-series"],
  { tags: ["works"], revalidate: 3600 }
);

// Per-request memoization on top of the persistent cache.
const getVisibleWorksBySeries = cache(
  async (seriesSlug: string): Promise<Work[]> => {
    return _cachedLoadVisibleWorksBySeries(seriesSlug);
  }
);

// ─── Cached: gallery series list (with work counts) ──────────────────────────
// Tags: ['works', 'work_series']  revalidate: 3600s
const _cachedGallerySeries = unstable_cache(
  async (): Promise<GallerySeries[]> => {
    const supabase = createAnonClient();

    const [seriesResult, worksResult] = await Promise.all([
      supabase
        .from("work_series")
        .select(SERIES_COLUMNS)
        .eq("is_public", true)
        .order("sort_order", { ascending: true })
        .order("slug", { ascending: true }),
      supabase
        .from("works")
        .select("series_id")
        .eq("status", "published"),
    ]);

    if (seriesResult.error) {
      throw new Error(`Failed to load work series: ${seriesResult.error.message}`);
    }
    if (worksResult.error) {
      throw new Error(`Failed to count works: ${worksResult.error.message}`);
    }

    const seriesRows = (seriesResult.data ?? []) as unknown as WorkSeriesRow[];
    const worksRows = (worksResult.data ?? []) as unknown as { series_id: string }[];

    const counts = new Map<string, number>();
    for (const row of worksRows) {
      counts.set(row.series_id, (counts.get(row.series_id) ?? 0) + 1);
    }

    return seriesRows.map((row) => mapSeries(row, counts.get(row.id) ?? 0));
  },
  ["works:gallery-series"],
  { tags: ["works", "work_series"], revalidate: 3600 }
);

export const getGallerySeries = cache(_cachedGallerySeries);

// ─── Public API ───────────────────────────────────────────────────────────────

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

// Collapse a full Work into the lightweight card DTO (image candidates +
// boolean offer flags). Shared by the gallery list and the "other wallpapers"
// strip on the detail page.
function toWorkListItem(work: Work): WorkListItem {
  const fallbackCandidates = getWorkPrimaryImageCandidates(work);
  const imageCandidates = work.feedImageUrl
    ? [work.feedImageUrl, ...fallbackCandidates]
    : fallbackCandidates;

  const primaryOffers = work.primaryVariant?.offers ?? [];
  const hasWallpaperOffer = primaryOffers.some((o) => o.offerType === "wallpaper");
  const hasStarterOffer = primaryOffers.some((o) => o.offerType === "imagine_starter");

  return {
    id: work.id,
    seriesSlug: work.seriesSlug,
    displayCode: work.displayCode,
    title: work.title,
    themeCategory: work.themeCategory,
    sequenceNumber: work.sequenceNumber,
    feedThumbUrl: work.feedThumbUrl ?? null,
    imageCandidates,
    hasWallpaperOffer,
    hasStarterOffer,
  };
}

// ─── Lightweight card DTO list ────────────────────────────────────────────────
// Returns one ordered list of WorkListItem (newest-first by default).
// Payload is ~85 % smaller than the full Work per item because variants/offers
// are collapsed to two booleans and a pre-built image-candidate array.
export async function getWorkCardsBySeries(
  seriesSlug: string,
  sort: "newest" | "oldest" = "newest"
): Promise<WorkListItem[]> {
  const works = await getVisibleWorksBySeries(seriesSlug);
  const ordered = sort === "newest" ? [...works].reverse() : works;
  return ordered.map(toWorkListItem);
}

// ─── Nearby wallpapers (detail-page "other wallpapers" strip) ─────────────────
// Returns up to `count` published wallpaper packs near the given work in the
// series order, excluding the work itself. Only works whose primary variant has
// a published pack (with a package_cover) qualify, so each tile shows the actual
// wallpaper cover and links to that pack's sales page. Candidates are picked by
// proximity to the current work, then restored to series order for display.
// Until categories/tags exist, "nearby in the series" is the relatedness rule.
export async function getNearbyWallpapers(
  seriesSlug: string,
  workId: string,
  count = 9
): Promise<WallpaperCoverItem[]> {
  const [works, coverMap] = await Promise.all([
    getVisibleWorksBySeries(seriesSlug),
    getSeriesWallpaperCoverMap(seriesSlug),
  ]);

  const index = works.findIndex((work) => work.id === workId);
  if (index === -1) return [];

  const candidates = works
    .map((work, position) => {
      if (work.id === workId) return null;
      const variantNumber = work.primaryVariant?.variantNumber ?? 1;
      const coverUrl = coverMap.get(`${work.displayCode}:${variantNumber}`);
      if (!coverUrl) return null;
      return { work, position, variantNumber, coverUrl };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return candidates
    .sort((a, b) => Math.abs(a.position - index) - Math.abs(b.position - index))
    .slice(0, count)
    .sort((a, b) => a.position - b.position)
    .map(({ work, variantNumber, coverUrl }) => ({
      id: work.id,
      seriesSlug: work.seriesSlug,
      displayCode: work.displayCode,
      title: work.title,
      variantNumber,
      coverUrl,
    }));
}
