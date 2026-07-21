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
  WorkFilterMeta,
  WallpaperCoverItem,
  Work,
  WorkListPage,
  WorkListItem,
  WorkOffer,
  WorkOfferRow,
  WorkTag,
  WorkTagFilter,
  WorkTagRow,
  WorkRow,
  WorkSeriesRow,
  WorkVariant,
  WorkVariantRow,
} from "./types";
import {
  getGalleryListThumbnailUrl,
  getWorkPrimaryImageCandidates,
} from "./work-images";

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
export const WORKS_PAGE_SIZE = 20;

function isMissingTableError(error: { message?: string } | null | undefined): boolean {
  const message = error?.message ?? "";
  return (
    message.includes("Could not find the table 'public.work_tag_map'") ||
    message.includes("Could not find the table 'public.work_tags'")
  );
}

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

function mapTag(row: WorkTagRow): WorkTag {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    tagType: row.tag_type,
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
  offers: WorkOffer[],
  tags: WorkTag[]
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
    tags,
    primaryVariant,
  };
}

async function enrichWorks(
  supabase: ReturnType<typeof createAnonClient>,
  series: WorkSeriesRow,
  workRows: WorkRow[]
): Promise<Work[]> {
  if (workRows.length === 0) return [];

  const workIds = workRows.map((row) => row.id);
  const workIdChunks = chunkArray(workIds, CHUNK_SIZE);

  const [variantChunks, offerChunks, tagMapChunks, tagRows, feedImageMap, feedThumbMap] =
    await Promise.all([
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
      Promise.all(
        workIdChunks.map(async (chunk) => {
          const { data, error } = await supabase
            .from("work_tag_map")
            .select("work_id, tag_id")
            .in("work_id", chunk);

          if (error) {
            if (isMissingTableError(error)) {
              return [];
            }
            throw new Error(`Failed to load work tag map: ${error.message}`);
          }

          return (data ?? []) as { work_id: string; tag_id: string }[];
        })
      ),
      (async () => {
        const { data, error } = await supabase
          .from("work_tags")
          .select("id, slug, label, tag_type")
          .order("label", { ascending: true });

        if (error) {
          if (isMissingTableError(error)) {
            return [];
          }
          throw new Error(`Failed to load work tags: ${error.message}`);
        }

        return (data ?? []) as unknown as WorkTagRow[];
      })(),
      getSeriesFeedImageMap(series.slug),
      getSeriesFeedThumbMap(series.slug),
    ]);

  const variantRows = variantChunks.flat();
  const offerRows = offerChunks.flat();
  const tagMapRows = tagMapChunks.flat();
  const offersByVariantId = new Map<string, WorkOffer[]>();
  const offersByWorkId = new Map<string, WorkOffer[]>();
  const tagsById = new Map(tagRows.map((row) => [row.id, mapTag(row)]));
  const tagsByWorkId = new Map<string, WorkTag[]>();

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

  for (const row of tagMapRows) {
    const tag = tagsById.get(row.tag_id);
    if (!tag) continue;
    const bucket = tagsByWorkId.get(row.work_id) ?? [];
    bucket.push(tag);
    tagsByWorkId.set(row.work_id, bucket);
  }

  return workRows.map((row) => {
    const work = mapWork(
      row,
      series,
      variantsByWorkId.get(row.id) ?? [],
      offersByWorkId.get(row.id) ?? [],
      tagsByWorkId.get(row.id) ?? []
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
    return enrichWorks(supabase, series, workRows);
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

const _cachedLoadVisibleWorkBySeriesAndCode = unstable_cache(
  async (seriesSlug: string, code: string): Promise<Work | null> => {
    const supabase = createAnonClient();

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
    if (!series) return null;

    const { data: workData, error: workError } = await supabase
      .from("works")
      .select(WORK_COLUMNS)
      .eq("series_id", series.id)
      .eq("display_code", code)
      .eq("status", "published")
      .maybeSingle();

    if (workError) {
      throw new Error(`Failed to load work: ${workError.message}`);
    }

    const workRow = workData as unknown as WorkRow | null;
    if (!workRow) return null;

    const works = await enrichWorks(supabase, series, [workRow]);
    return works[0] ?? null;
  },
  ["works:visible-by-series-and-code"],
  { tags: ["works"], revalidate: 3600 }
);

const getVisibleWorkBySeriesAndCode = cache(
  async (seriesSlug: string, code: string): Promise<Work | null> => {
    return _cachedLoadVisibleWorkBySeriesAndCode(seriesSlug, code);
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

const _cachedWorkCountBySeries = unstable_cache(
  async (seriesSlug: string): Promise<number> => {
    const supabase = createAnonClient();

    const { data: seriesData, error: seriesError } = await supabase
      .from("work_series")
      .select("id")
      .eq("slug", seriesSlug)
      .eq("is_public", true)
      .maybeSingle();

    if (seriesError) {
      throw new Error(`Failed to load series: ${seriesError.message}`);
    }

    const series = seriesData as { id: string } | null;
    if (!series) return 0;

    const { count, error } = await supabase
      .from("works")
      .select("id", { count: "exact", head: true })
      .eq("series_id", series.id)
      .eq("status", "published");

    if (error) {
      throw new Error(`Failed to count works: ${error.message}`);
    }

    return count ?? 0;
  },
  ["works:count-by-series"],
  { tags: ["works"], revalidate: 3600 }
);

const getCachedWorkCountBySeries = cache(
  async (seriesSlug: string): Promise<number> => {
    return _cachedWorkCountBySeries(seriesSlug);
  }
);

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
  const work = await getVisibleWorkBySeriesAndCode(seriesSlug, code);
  return work ?? undefined;
}

const _loadAdjacentWorks = async (
  seriesSlug: string,
  sequenceNumber: number
): Promise<{
  prev: { id: string; displayCode: string } | undefined;
  next: { id: string; displayCode: string } | undefined;
}> => {
  const supabase = createAnonClient();
  const series = await getSeriesBySlug(seriesSlug);
  if (!series) {
    return { prev: undefined, next: undefined };
  }

  const [prevResult, nextResult] = await Promise.all([
    supabase
      .from("works")
      .select("id, display_code")
      .eq("series_id", series.id)
      .eq("status", "published")
      .lt("sequence_number", sequenceNumber)
      .order("sequence_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("works")
      .select("id, display_code")
      .eq("series_id", series.id)
      .eq("status", "published")
      .gt("sequence_number", sequenceNumber)
      .order("sequence_number", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (prevResult.error) {
    throw new Error(`Failed to load previous work: ${prevResult.error.message}`);
  }
  if (nextResult.error) {
    throw new Error(`Failed to load next work: ${nextResult.error.message}`);
  }

  return {
    prev: prevResult.data
      ? {
          id: prevResult.data.id as string,
          displayCode: prevResult.data.display_code as string,
        }
      : undefined,
    next: nextResult.data
      ? {
          id: nextResult.data.id as string,
          displayCode: nextResult.data.display_code as string,
        }
      : undefined,
  };
};

const _cachedAdjacentWorks = unstable_cache(
  _loadAdjacentWorks,
  ["works:adjacent"],
  { tags: ["works"], revalidate: 3600 }
);

export async function getAdjacentWorks(
  seriesSlug: string,
  sequenceNumber: number
): Promise<{
  prev: { id: string; displayCode: string } | undefined;
  next: { id: string; displayCode: string } | undefined;
}> {
  return _cachedAdjacentWorks(seriesSlug, sequenceNumber);
}

export async function getWorkCountBySeries(seriesSlug: string): Promise<number> {
  return getCachedWorkCountBySeries(seriesSlug);
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
  const normalizedListThumbnail = getGalleryListThumbnailUrl(
    work.seriesSlug,
    work.displayCode
  );
  const imageCandidates = [
    normalizedListThumbnail,
    ...(work.feedImageUrl ? [work.feedImageUrl] : []),
    ...fallbackCandidates,
  ];

  const primaryOffers = work.primaryVariant?.offers ?? [];
  const hasWallpaperOffer = primaryOffers.some((o) => o.offerType === "wallpaper");
  const hasStarterOffer = primaryOffers.some((o) => o.offerType === "imagine_starter");

  return {
    id: work.id,
    seriesSlug: work.seriesSlug,
    displayCode: work.displayCode,
    title: work.title,
    themeCategory: work.themeCategory,
    tags: work.tags,
    sequenceNumber: work.sequenceNumber,
    feedThumbUrl: work.feedThumbUrl ?? null,
    imageCandidates,
    hasWallpaperOffer,
    hasStarterOffer,
  };
}

function applyWorkCardFilters(
  works: WorkListItem[],
  {
    rangeStart,
    rangeEnd,
    tagSlug,
    wallpaperOnly,
    ids,
  }: {
    rangeStart?: number;
    rangeEnd?: number;
    tagSlug?: string | null;
    wallpaperOnly?: boolean;
    ids?: string[];
  }
): WorkListItem[] {
  const idSet = ids && ids.length > 0 ? new Set(ids) : null;

  return works.filter((work) => {
    if (idSet && !idSet.has(work.id)) return false;
    if (typeof rangeStart === "number" && work.sequenceNumber < rangeStart) return false;
    if (typeof rangeEnd === "number" && work.sequenceNumber > rangeEnd) return false;
    if (wallpaperOnly && !work.hasWallpaperOffer) return false;
    if (tagSlug && !work.tags.some((tag) => tag.slug === tagSlug)) return false;
    return true;
  });
}

function buildWorkFilterMeta(works: WorkListItem[]): WorkFilterMeta {
  let maxSequence = 0;
  const tags = new Map<string, WorkTagFilter>();

  for (const work of works) {
    if (work.sequenceNumber > maxSequence) {
      maxSequence = work.sequenceNumber;
    }

    for (const tag of work.tags) {
      const existing = tags.get(tag.slug);
      if (existing) {
        existing.count += 1;
      } else {
        tags.set(tag.slug, {
          id: tag.slug,
          label: tag.label,
          count: 1,
        });
      }
    }
  }

  return {
    total: works.length,
    maxSequence,
    tagFilters: [...tags.values()].sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    }),
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

export async function getWorkFilterMetaBySeries(
  seriesSlug: string
): Promise<WorkFilterMeta> {
  const works = await getWorkCardsBySeries(seriesSlug, "newest");
  return buildWorkFilterMeta(works);
}

export async function getWorkCardsPageBySeries(
  seriesSlug: string,
  options: {
    sort?: "newest" | "oldest";
    offset?: number;
    limit?: number;
    rangeStart?: number;
    rangeEnd?: number;
    tagSlug?: string | null;
    wallpaperOnly?: boolean;
    ids?: string[];
  } = {}
): Promise<WorkListPage> {
  const {
    sort = "newest",
    offset = 0,
    limit = WORKS_PAGE_SIZE,
    rangeStart,
    rangeEnd,
    tagSlug,
    wallpaperOnly,
    ids,
  } = options;

  const works = await getWorkCardsBySeries(seriesSlug, sort);
  const filtered = applyWorkCardFilters(works, {
    rangeStart,
    rangeEnd,
    tagSlug,
    wallpaperOnly,
    ids,
  });
  const items = filtered.slice(offset, offset + limit);

  return {
    items,
    total: filtered.length,
    offset,
    limit,
    hasMore: offset + items.length < filtered.length,
  };
}

// ─── Nearby wallpapers (detail-page "other wallpapers" strip) ─────────────────
// Returns up to `count` published wallpaper packs near the given work in the
// series order, excluding the work itself. Only works whose primary variant has
// a published pack (with a package_cover) qualify, so each tile shows the actual
// wallpaper cover and links to that pack's sales page. Candidates are picked by
// proximity to the current work, then restored to series order for display.
// Until categories/tags exist, "nearby in the series" is the relatedness rule.
const _loadNearbyWallpapers = async (
  seriesSlug: string,
  workId: string,
  sequenceNumber: number,
  count = 9
): Promise<WallpaperCoverItem[]> => {
  const supabase = createAnonClient();
  const series = await getSeriesBySlug(seriesSlug);
  if (!series) return [];

  const windowRadius = Math.max(count * 4, 24);
  const [worksResult, coverMap] = await Promise.all([
    supabase
      .from("works")
      .select("id, display_code, title, sequence_number")
      .eq("series_id", series.id)
      .eq("status", "published")
      .gte("sequence_number", Math.max(1, sequenceNumber - windowRadius))
      .lte("sequence_number", sequenceNumber + windowRadius)
      .order("sequence_number", { ascending: true }),
    getSeriesWallpaperCoverMap(seriesSlug),
  ]);

  if (worksResult.error) {
    throw new Error(`Failed to load nearby works: ${worksResult.error.message}`);
  }

  const nearbyWorks = (worksResult.data ?? []) as Array<{
    id: string;
    display_code: string;
    title: string;
    sequence_number: number;
  }>;
  const workIds = nearbyWorks.map((work) => work.id);
  if (workIds.length === 0) return [];

  const { data: variantData, error: variantError } = await supabase
    .from("work_variants")
    .select("work_id, variant_number, is_primary")
    .in("work_id", workIds)
    .eq("status", "ready")
    .order("variant_number", { ascending: true });

  if (variantError) {
    throw new Error(`Failed to load nearby variants: ${variantError.message}`);
  }

  const primaryVariantByWorkId = new Map<string, number>();
  for (const row of (variantData ?? []) as Array<{
    work_id: string;
    variant_number: number;
    is_primary: boolean;
  }>) {
    if (row.is_primary || !primaryVariantByWorkId.has(row.work_id)) {
      primaryVariantByWorkId.set(row.work_id, row.variant_number);
    }
  }

  const candidates = nearbyWorks
    .map((work) => {
      if (work.id === workId) return null;
      const variantNumber = primaryVariantByWorkId.get(work.id) ?? 1;
      const coverUrl = coverMap.get(`${work.display_code}:${variantNumber}`);
      if (!coverUrl) return null;
      return { work, coverUrl, variantNumber };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return candidates
    .sort(
      (a, b) =>
        Math.abs(a.work.sequence_number - sequenceNumber) -
        Math.abs(b.work.sequence_number - sequenceNumber)
    )
    .slice(0, count)
    .sort((a, b) => a.work.sequence_number - b.work.sequence_number)
    .map(({ work, coverUrl, variantNumber }) => ({
      id: work.id,
      seriesSlug,
      displayCode: work.display_code,
      title: work.title,
      variantNumber,
      coverUrl,
    }));
};

const _cachedNearbyWallpapers = unstable_cache(
  _loadNearbyWallpapers,
  ["works:nearby-wallpapers"],
  { tags: ["works", "production"], revalidate: 3600 }
);

export async function getNearbyWallpapers(
  seriesSlug: string,
  workId: string,
  sequenceNumber: number,
  count = 9
): Promise<WallpaperCoverItem[]> {
  return _cachedNearbyWallpapers(seriesSlug, workId, sequenceNumber, count);
}
