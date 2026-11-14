import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildProductionOutputPublicUrl,
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
  WorkTagRow,
  WorkRow,
  WorkSeriesRow,
  WorkVariant,
  WorkVariantRow,
} from "./types";
import {
  getGalleryListThumbnailUrl,
  getVariantThumbnailCandidates,
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
  "video_storage_key",
  "video_preview_storage_key",
  "video_has_audio",
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
export const WORKS_MAX_PAGE_SIZE = 50;

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
    videoUrl: row.video_storage_key ?? null,
    videoPreviewUrl: row.video_preview_storage_key ?? row.video_storage_key ?? null,
    videoHasAudio: row.video_has_audio === true,
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

// ─── Recommend (curated) ─────────────────────────────────────────────────────
// A virtual gallery mode, listed first and used as the default landing page.
// Its works are the ones saved by one curator account — the admin's way of
// pushing hand-picked works to the front. The curator is configured in
// public.site_settings (key 'recommend_curator_user_id', value = auth user id
// as a JSON string); change it with SQL, there is no UI. See docs/RECOMMEND.md.
export const RECOMMEND_SLUG = "recommend";
const RECOMMEND_NAME = "Recommend";

type RecommendedWorkRef = { id: string; seriesSlug: string };

const _cachedRecommendedWorkRefs = unstable_cache(
  async (): Promise<RecommendedWorkRef[]> => {
    const supabase = createAdminClient();
    if (!supabase) return [];

    const { data: setting, error: settingError } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "recommend_curator_user_id")
      .maybeSingle();
    if (settingError) {
      console.error(`Failed to read recommend curator: ${settingError.message}`);
      return [];
    }
    const value = (setting as { value: unknown } | null)?.value;
    const curatorId = typeof value === "string" ? value : null;
    if (!curatorId) return [];

    // Newest save first. Only published works in public series are shown.
    const { data, error } = await supabase
      .from("work_saves")
      .select("work_id, created_at, works!inner(status, work_series!inner(slug, is_public))")
      .eq("user_id", curatorId)
      .eq("works.status", "published")
      .eq("works.work_series.is_public", true)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(`Failed to load recommended works: ${error.message}`);
      return [];
    }

    type Row = {
      work_id: string;
      works: { work_series: { slug: string } | { slug: string }[] } | { work_series: { slug: string } }[];
    };
    const refs: RecommendedWorkRef[] = [];
    for (const row of (data ?? []) as unknown as Row[]) {
      const work = Array.isArray(row.works) ? row.works[0] : row.works;
      const series = Array.isArray(work?.work_series) ? work.work_series[0] : work?.work_series;
      if (series?.slug) refs.push({ id: row.work_id, seriesSlug: series.slug });
    }
    return refs;
  },
  ["works:recommended-refs:v1"],
  // Saves are written from the browser (no server hook to revalidate), so keep
  // this short: a curator's new save shows up within 2 minutes.
  { tags: ["works", "recommend"], revalidate: 120 }
);

/** Gallery mode selector entries: Recommend first, then the public series. */
export async function getGalleryNavSeries(): Promise<GallerySeries[]> {
  const [series, refs] = await Promise.all([getGallerySeries(), _cachedRecommendedWorkRefs()]);
  return [
    {
      id: RECOMMEND_SLUG,
      slug: RECOMMEND_SLUG,
      name: RECOMMEND_NAME,
      routeBase: `/works/${RECOMMEND_SLUG}`,
      numberPadding: 4,
      sortOrder: 0,
      isPublic: true,
      workCount: refs.length,
    },
    ...series,
  ];
}

async function loadRecommendedCardsPage(
  options: NormalizedWorkCardsPageOptions
): Promise<WorkListPage> {
  let refs = await _cachedRecommendedWorkRefs();
  if (options.sort === "oldest") refs = [...refs].reverse();
  if (options.ids !== null) {
    const allowed = new Set(options.ids);
    refs = refs.filter((ref) => allowed.has(ref.id));
  }

  // Cursor = offset into the curated list (series cursors are sequence numbers).
  const offset = Math.max(0, options.cursor ?? 0);
  const pageRefs = refs.slice(offset, offset + options.limit);

  const idsBySeries = new Map<string, string[]>();
  for (const ref of pageRefs) {
    const bucket = idsBySeries.get(ref.seriesSlug) ?? [];
    bucket.push(ref.id);
    idsBySeries.set(ref.seriesSlug, bucket);
  }

  // Reuse the per-series card RPC (≤ limit ids per call) and the same per-card
  // extras, then restore the curated order.
  const itemsById = new Map<string, WorkListItem>();
  await Promise.all(
    [...idsBySeries].map(async ([seriesSlug, ids]) => {
      const rows = await callGalleryRpc<GalleryWorkCardRow[]>("get_gallery_work_cards_page", {
        p_series_slug: seriesSlug,
        p_sort: "newest",
        p_limit: ids.length,
        p_cursor_sequence: null,
        p_range_start: null,
        p_range_end: null,
        p_tag_slug: null,
        p_wallpaper_only: false,
        p_ids: ids,
      });
      const items = rows.map(mapGalleryWorkCardRow);
      await attachCardVariantExtras(seriesSlug, items);
      for (const item of items) itemsById.set(item.id, item);
    })
  );

  const items = pageRefs
    .map((ref) => itemsById.get(ref.id))
    .filter((item): item is WorkListItem => Boolean(item));
  const hasMore = offset + options.limit < refs.length;
  return {
    items,
    total: refs.length,
    limit: options.limit,
    hasMore,
    nextCursor: hasMore ? offset + options.limit : null,
  };
}

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
  if (seriesSlug === RECOMMEND_SLUG) return RECOMMEND_NAME;
  const series = await getSeriesBySlug(seriesSlug);
  return series?.name ?? seriesSlug;
}

interface GalleryWorkCardRow {
  work_id: string;
  series_slug: string;
  display_code: string;
  title: string;
  theme_category: string;
  sequence_number: number;
  variant_id: string | null;
  variant_number: number | null;
  thumbnail_storage_key: string | null;
  original_storage_key: string | null;
  variant_updated_at: string | null;
  feed_storage_provider: string | null;
  feed_storage_bucket: string | null;
  feed_storage_path: string | null;
  feed_thumb_storage_provider: string | null;
  feed_thumb_storage_bucket: string | null;
  feed_thumb_storage_path: string | null;
  tags: WorkTag[] | null;
  has_wallpaper_offer: boolean;
  has_starter_offer: boolean;
  total_count: number;
}

function resolveProductionImage(
  provider: string | null,
  bucket: string | null,
  storagePath: string | null
): string | null {
  if (!bucket || !storagePath) return null;
  return buildProductionOutputPublicUrl(provider, bucket, storagePath);
}

function mapGalleryWorkCardRow(row: GalleryWorkCardRow): WorkListItem {
  const feedImageUrl = resolveProductionImage(
    row.feed_storage_provider,
    row.feed_storage_bucket,
    row.feed_storage_path
  );
  const feedThumbUrl = resolveProductionImage(
    row.feed_thumb_storage_provider,
    row.feed_thumb_storage_bucket,
    row.feed_thumb_storage_path
  );
  const fallbackCandidates = row.variant_id
    ? getVariantThumbnailCandidates({
        thumbnailStorageKey: row.thumbnail_storage_key,
        originalStorageKey: row.original_storage_key,
        updatedAt: row.variant_updated_at ?? "",
      })
    : [];
  const imageCandidates = [...new Set([
    getGalleryListThumbnailUrl(row.series_slug, row.display_code),
    ...(feedImageUrl ? [feedImageUrl] : []),
    ...fallbackCandidates,
  ])];

  return {
    id: row.work_id,
    seriesSlug: row.series_slug,
    displayCode: row.display_code,
    title: row.title,
    themeCategory: row.theme_category,
    tags: Array.isArray(row.tags) ? row.tags : [],
    sequenceNumber: row.sequence_number,
    feedThumbUrl,
    imageCandidates,
    hasWallpaperOffer: row.has_wallpaper_offer,
    hasStarterOffer: row.has_starter_offer,
    aspectRatio: DEFAULT_CARD_ASPECT_RATIO,
  };
}

// Legacy list thumbnails (gallery-thumbs) and Content Factory feed images are
// both 4:5, so that is the right card shape when a variant has no dimensions.
const DEFAULT_CARD_ASPECT_RATIO = 4 / 5;

function cardAspectRatio(width: number | null, height: number | null): number {
  if (!width || !height || width <= 0 || height <= 0) return DEFAULT_CARD_ASPECT_RATIO;
  // Keep extreme panoramas/strips from producing unusable cards.
  return Math.min(2.5, Math.max(0.4, width / height));
}

type GalleryRpcName =
  | "get_gallery_work_cards_page"
  | "get_gallery_work_filter_meta";

async function callGalleryRpc<TResult>(
  functionName: GalleryRpcName,
  params: Record<string, unknown>
): Promise<TResult> {
  const supabase = createAdminClient();
  if (!supabase) {
    throw new Error("Supabase service role is required for Gallery reads.");
  }

  // These functions are introduced by the accompanying migration. The local
  // Supabase client has no generated Database type, so its default RPC function
  // map is empty until types are regenerated.
  const { data, error } = await supabase.rpc(functionName as never, params as never);
  if (error) {
    throw new Error(`Failed to call ${functionName}: ${error.message}`);
  }
  return data as TResult;
}

const _cachedWorkFilterMetaBySeries = unstable_cache(
  async (seriesSlug: string): Promise<WorkFilterMeta> => {
    const meta = await callGalleryRpc<WorkFilterMeta | null>(
      "get_gallery_work_filter_meta",
      { p_series_slug: seriesSlug }
    );
    return {
      total: Number(meta?.total ?? 0),
      maxSequence: Number(meta?.maxSequence ?? 0),
      tagFilters: Array.isArray(meta?.tagFilters) ? meta.tagFilters : [],
    };
  },
  ["works:gallery-filter-meta"],
  { tags: ["works", "work_tags"], revalidate: 3600 }
);

export async function getWorkFilterMetaBySeries(
  seriesSlug: string
): Promise<WorkFilterMeta> {
  if (seriesSlug === RECOMMEND_SLUG) {
    // Cross-series: number ranges and series tags do not apply.
    const refs = await _cachedRecommendedWorkRefs();
    return { total: refs.length, maxSequence: 0, tagFilters: [] };
  }
  return _cachedWorkFilterMetaBySeries(seriesSlug);
}

interface WorkCardsPageOptions {
  sort?: "newest" | "oldest";
  cursor?: number | null;
  limit?: number;
  rangeStart?: number;
  rangeEnd?: number;
  tagSlug?: string | null;
  wallpaperOnly?: boolean;
  ids?: string[];
}

interface NormalizedWorkCardsPageOptions {
  sort: "newest" | "oldest";
  cursor: number | null;
  limit: number;
  rangeStart: number | null;
  rangeEnd: number | null;
  tagSlug: string | null;
  wallpaperOnly: boolean;
  ids: string[] | null;
}

function normalizeWorkCardsPageOptions(
  options: WorkCardsPageOptions
): NormalizedWorkCardsPageOptions {
  const {
    sort = "newest",
    cursor = null,
    limit = WORKS_PAGE_SIZE,
    rangeStart,
    rangeEnd,
    tagSlug,
    wallpaperOnly,
    ids,
  } = options;

  return {
    sort,
    cursor,
    limit: Math.min(Math.max(limit, 1), WORKS_MAX_PAGE_SIZE),
    rangeStart: rangeStart ?? null,
    rangeEnd: rangeEnd ?? null,
    tagSlug: tagSlug ?? null,
    wallpaperOnly: wallpaperOnly ?? false,
    ids: ids === undefined ? null : ids,
  };
}

// Per-card extras from work_variants, in one small query per page:
// - Motion works: the primary variant's silent preview video.
// - Multi-variant works: one carousel slide per ready variant (plus the
//   already-cached series feed maps when a page needs them).
async function attachCardVariantExtras(seriesSlug: string, items: WorkListItem[]) {
  if (items.length === 0) return;
  const supabase = createAdminClient();
  if (!supabase) return;

  const { data, error } = await supabase
    .from("work_variants")
    .select("work_id, variant_number, thumbnail_storage_key, original_storage_key, updated_at, video_storage_key, video_preview_storage_key, width, height")
    .in("work_id", items.map((item) => item.id))
    .eq("status", "ready")
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("variant_number", { ascending: true });

  if (error) {
    // Carousels are an enhancement; the primary image still renders.
    console.error(`Failed to load card variants: ${error.message}`);
    return;
  }

  type SlideVariantRow = {
    work_id: string;
    variant_number: number;
    thumbnail_storage_key: string | null;
    original_storage_key: string | null;
    updated_at: string;
    video_storage_key: string | null;
    video_preview_storage_key: string | null;
    width: number | null;
    height: number | null;
  };
  const variantsByWorkId = new Map<string, SlideVariantRow[]>();
  for (const row of (data ?? []) as SlideVariantRow[]) {
    const bucket = variantsByWorkId.get(row.work_id) ?? [];
    bucket.push(row);
    variantsByWorkId.set(row.work_id, bucket);
  }

  for (const item of items) {
    const primary = variantsByWorkId.get(item.id)?.[0];
    if (primary) item.aspectRatio = cardAspectRatio(primary.width, primary.height);
    const previewUrl = primary?.video_preview_storage_key ?? primary?.video_storage_key ?? null;
    if (!primary || !previewUrl) continue;
    const posterUrl = primary.thumbnail_storage_key ?? primary.original_storage_key ?? null;
    item.video = { previewUrl, posterUrl };
    // The poster is the real list image; skip the gallery-thumbs fallback
    // (never generated for Motion) so cards do not request a missing file.
    if (posterUrl) item.feedThumbUrl = posterUrl;
  }

  const multiVariantItems = items.filter(
    (item) => (variantsByWorkId.get(item.id)?.length ?? 0) > 1
  );
  if (multiVariantItems.length === 0) return;

  const [feedThumbMap, feedImageMap] = await Promise.all([
    getSeriesFeedThumbMap(seriesSlug),
    getSeriesFeedImageMap(seriesSlug),
  ]);

  for (const item of multiVariantItems) {
    const variants = variantsByWorkId.get(item.id) ?? [];
    item.slides = variants.map((variant, index) => {
      if (index === 0) {
        // Keep the card's existing primary chain (gallery thumb first).
        return {
          variantNumber: variant.variant_number,
          candidates: [
            ...(item.feedThumbUrl ? [item.feedThumbUrl] : []),
            ...item.imageCandidates,
          ],
        };
      }
      const key = `${item.displayCode}:${variant.variant_number}`;
      const candidates = [
        feedThumbMap.get(key) ?? null,
        feedImageMap.get(key) ?? null,
        ...getVariantThumbnailCandidates({
          thumbnailStorageKey: variant.thumbnail_storage_key,
          originalStorageKey: variant.original_storage_key,
          updatedAt: variant.updated_at,
        }),
      ].filter((url): url is string => Boolean(url));
      return { variantNumber: variant.variant_number, candidates: [...new Set(candidates)] };
    }).filter((slide) => slide.candidates.length > 0);
    if (item.slides.length < 2) delete item.slides;
  }
}

async function loadWorkCardsPageBySeries(
  seriesSlug: string,
  options: NormalizedWorkCardsPageOptions
): Promise<WorkListPage> {
  const {
    sort,
    cursor,
    limit,
    rangeStart,
    rangeEnd,
    tagSlug,
    wallpaperOnly,
    ids,
  } = options;

  const rows = await callGalleryRpc<GalleryWorkCardRow[]>(
    "get_gallery_work_cards_page",
    {
      p_series_slug: seriesSlug,
      p_sort: sort,
      p_limit: limit,
      p_cursor_sequence: cursor,
      p_range_start: rangeStart,
      p_range_end: rangeEnd,
      p_tag_slug: tagSlug,
      p_wallpaper_only: wallpaperOnly,
      p_ids: ids,
    }
  );
  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);
  const items = pageRows.map(mapGalleryWorkCardRow);
  await attachCardVariantExtras(seriesSlug, items);
  const lastItem = items.at(-1);

  return {
    items,
    total: Number(pageRows[0]?.total_count ?? 0),
    limit,
    hasMore,
    nextCursor: hasMore ? lastItem?.sequenceNumber ?? null : null,
  };
}

const _cachedWorkCardsPageBySeries = unstable_cache(
  loadWorkCardsPageBySeries,
  ["works:gallery-card-page:v4"],
  {
    tags: ["works", "work_tags", "production"],
    revalidate: 300,
  }
);

export async function getWorkCardsPageBySeries(
  seriesSlug: string,
  options: WorkCardsPageOptions = {}
): Promise<WorkListPage> {
  const normalizedOptions = normalizeWorkCardsPageOptions(options);

  if (seriesSlug === RECOMMEND_SLUG) {
    // The curated id list is cached; card rows reuse the cached series RPC path.
    return loadRecommendedCardsPage(normalizedOptions);
  }

  // Saved-work IDs are user-specific and must never enter the shared cache.
  if (normalizedOptions.ids !== null) {
    return loadWorkCardsPageBySeries(seriesSlug, normalizedOptions);
  }
  return _cachedWorkCardsPageBySeries(seriesSlug, normalizedOptions);
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
