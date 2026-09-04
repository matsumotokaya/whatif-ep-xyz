import "server-only";

import { createAnonClient } from "@/lib/supabase/anon";
import { asAssetKey, resolveAsset } from "@/lib/asset";
import {
  clampLimit,
  clampOffset,
  formatAspectRatio,
  getSiteUrl,
  normalizeMinWidth,
  orderByRequestedIds as orderRecordsByRequestedIds,
  projectRefRecord,
  resolveRefFields,
  selectLookupIds,
  stripImageExtension,
  toFiniteNumber,
} from "./common";

// Ref Library, second kind: exposes the site's OFFICIAL, CURATED IMAGE LIBRARY
// (public.default_images — character cutouts and general art) as public image
// references, so the same external tools that reference a saved design by URL
// (MCP clients, curl/CLI, Remotion, video-generation APIs) can reference a
// library asset the same way. Saved designs are ./designs.ts.
//
// NO OWNER SCOPING HERE — NEITHER FOR LISTING NOR FOR ID LOOKUP, and that is
// the point of difference from designs. `banners` is every user's private work,
// so enumerating it would hand out the very ids that act as access
// capabilities, which is why its listing is restricted to the ref owners.
// `default_images` is a curated library published by the site itself: it is
// meant to be browsed, and a listing of it cannot leak anyone's private work
// because there is no "anyone" in it — no per-row owner, nothing unpublished.
// So there is no owner filter to add, and adding one later would only hide the
// library from the tools it exists to serve.
//
// CREDENTIAL: the anon client, not the service-role one. RLS on this table
// already grants SELECT to anon and authenticated, so nothing here needs RLS
// bypassed; the weakest credential that can do the job is the right one, and it
// keeps a future RLS restriction (say, an unpublished flag) automatically
// binding on this module instead of silently bypassed.
//
// DIMENSIONS ARE TRUSTWORTHY HERE. Every row records `width`/`height` for the
// file at `storage_path`, so `width`/`height` describe the image at `url`
// exactly — the same strict rule designs.ts had to fight for, satisfiable here
// with no caveat. `thumbnailUrl` is a small preview whose pixel size is not
// recorded and is therefore not reported, exactly as on the design side. Never
// let `url` point at the thumbnail.

const DEFAULT_IMAGES_BUCKET = "default-images";

// PostgREST's 416 for a range that starts past the last row.
const RANGE_NOT_SATISFIABLE = "PGRST103";

// `/ref/asset/{id}.jpg` behaves like `/ref/asset/{id}`; shared with the design
// alias and re-exported so the route imports it from the kind it serves.
export { stripImageExtension };

export interface RefAsset {
  id: string;
  name: string;
  /** `asset_role`: "character_cutout" | "general" (free text in the DB). */
  role: string;
  tags: string[];
  workNumber: number | null;
  seriesSlug: string | null;
  variantNumber: number | null;
  /**
   * Reduced ratio of the recorded dimensions. Library assets are cropped by
   * hand, so most reduce to something like "1223:2063" rather than a tidy
   * "4:5" — useful for sorting by shape, not for equality filtering.
   */
  aspect: string | null;
  // Exact pixel dimensions of the image at `url`, as recorded on the row.
  width: number | null;
  height: number | null;
  /** Full-size image, public R2. */
  url: string | null;
  /** Small preview. Its pixel size is not recorded, so it is not claimed. */
  thumbnailUrl: string | null;
  refUrl: string;
  fileSize: number | null;
  createdAt: string;
}

// Canonical field order, used for `fields=all` and to keep projected records in
// a stable key order. assets.test.ts asserts it covers RefAsset exactly.
export const REF_ASSET_FIELDS = [
  "id",
  "name",
  "role",
  "tags",
  "workNumber",
  "seriesSlug",
  "variantNumber",
  "aspect",
  "width",
  "height",
  "url",
  "thumbnailUrl",
  "refUrl",
  "fileSize",
  "createdAt",
] as const satisfies readonly (keyof RefAsset)[];

export type RefAssetField = (typeof REF_ASSET_FIELDS)[number];

// Default shape of a LIST record: what it takes to pick an asset (identity,
// what it is, and a usable image URL with its true size). The rest is opt-in
// via `fields`, for the same reason as designs — a listing is the expensive
// response and `refUrl` is a pure function of `id`.
//
// Declared in REF_ASSET_FIELDS order (it is a subsequence of it, asserted in
// assets.test.ts) so that projected records key the same way whether or not
// `fields` was used. Only the set matters, not this order.
export const REF_ASSET_LIST_FIELDS = [
  "id",
  "name",
  "role",
  "tags",
  "workNumber",
  "aspect",
  "width",
  "height",
  "url",
] as const satisfies readonly RefAssetField[];

export type ProjectedRefAsset = Partial<RefAsset>;

// Pure. Resolves a caller's `fields` request into the field list to project:
// absent -> the compact list shape, "all" -> every field, otherwise the list
// shape plus any recognised names. Unknown names are ignored, not rejected.
export function resolveRefAssetFields(
  raw: string | null | undefined
): readonly RefAssetField[] {
  return resolveRefFields(raw, REF_ASSET_FIELDS, REF_ASSET_LIST_FIELDS);
}

// Pure. Narrows one asset down to the requested fields, in canonical order.
export function projectRefAsset(
  asset: RefAsset,
  fields: readonly RefAssetField[]
): ProjectedRefAsset {
  return projectRefRecord(asset, fields);
}

export function projectRefAssets(
  assets: readonly RefAsset[],
  fields: readonly RefAssetField[]
): ProjectedRefAsset[] {
  return assets.map((asset) => projectRefAsset(asset, fields));
}

// Shape of the columns this module selects from public.default_images.
export interface RefAssetRow {
  id: string;
  name: string | null;
  storage_path: string | null;
  thumbnail_path: string | null;
  width: number | null;
  height: number | null;
  file_size: number | null;
  tags: string[] | null;
  asset_role: string | null;
  work_series_slug: string | null;
  work_number: number | null;
  variant_number: number | null;
  created_at: string;
}

const REF_ASSET_COLUMNS =
  "id, name, storage_path, thumbnail_path, width, height, file_size, tags, asset_role, work_series_slug, work_number, variant_number, created_at";

// Library paths are stored without a logical bucket prefix
// ("official/episode/..."), so the legacy bucket hint is what puts them under
// default-images/ on the assets origin — the same resolution /api/lab/assets
// uses. No `version` param: these objects are immutable once uploaded.
const resolveLibraryAsset = (path: string | null): string | null => {
  if (!path) return null;
  return (
    resolveAsset(asAssetKey(path), { legacyBucket: DEFAULT_IMAGES_BUCKET }) ||
    null
  );
};

// Pure row -> RefAsset mapping, kept free of Supabase and env lookups beyond
// the site origin so it can be unit tested directly.
export function mapRowToRefAsset(row: RefAssetRow): RefAsset {
  const siteUrl = getSiteUrl();
  const url = resolveLibraryAsset(row.storage_path);
  const thumbnailUrl = resolveLibraryAsset(row.thumbnail_path);

  // Recorded per row for the file at storage_path, so these describe `url`
  // itself. `aspect` still comes from the recorded pair even when the image is
  // missing, since the ratio is a property of the asset, not of the URL; but
  // `width`/`height` are reported only alongside the image they measure — no
  // image, no claim about its size.
  const width = toFiniteNumber(row.width);
  const height = toFiniteNumber(row.height);

  return {
    id: row.id,
    name: row.name ?? "",
    role: row.asset_role ?? "",
    tags: row.tags ?? [],
    workNumber: toFiniteNumber(row.work_number),
    seriesSlug: row.work_series_slug,
    variantNumber: toFiniteNumber(row.variant_number),
    aspect: formatAspectRatio(width, height),
    width: url ? width : null,
    height: url ? height : null,
    url,
    thumbnailUrl,
    refUrl: `${siteUrl}/ref/asset/${row.id}`,
    fileSize: toFiniteNumber(row.file_size),
    createdAt: row.created_at,
  };
}

const mapRows = (data: unknown[] | null): RefAsset[] =>
  (data ?? []).map((row) => mapRowToRefAsset(row as RefAssetRow));

export interface ListRefAssetsOptions {
  /** Case-insensitive substring match on the asset name. */
  search?: string;
  /** `asset_role`, e.g. "character_cutout" or "general". */
  role?: string;
  /** One tag; matches assets whose `tags` array contains it. */
  tag?: string;
  /** `work_number`, the episode number a cutout belongs to. */
  work?: number;
  limit?: number;
  offset?: number;
  /** Only assets at least this many pixels wide. */
  minWidth?: number;
}

export interface ListRefAssetsResult {
  /** The requested window. */
  assets: RefAsset[];
  /** Assets matching the filters, ignoring limit/offset. */
  total: number;
}

export interface RefAssetsByIdsResult {
  assets: RefAsset[];
  missing: string[];
}

/**
 * PUBLIC, unscoped. Browse and search the whole official library.
 *
 * `total` is the size of the whole match set, so a caller can tell "there are
 * exactly this many" from "your limit truncated the result" — which
 * `assets.length` alone never could.
 */
export async function listRefAssets(
  options: ListRefAssetsOptions = {}
): Promise<ListRefAssetsResult> {
  const supabase = createAnonClient();
  const limit = clampLimit(options.limit);
  const offset = clampOffset(options.offset);
  const minWidth = normalizeMinWidth(options.minWidth);

  // Every filter is decided in Postgres. minWidth included: `width` is a real
  // integer column here, so `gte` compares numbers and belongs in the query —
  // unlike the design side, where the dimension lives inside a jsonb blob that
  // PostgREST would compare as TEXT ("900" >= "2000") and quietly return the
  // wrong rows. `created_at` has ties, so id breaks them: without a total
  // order, offset paging would drop and repeat rows across pages.
  const buildQuery = (selectOptions?: { count?: "exact"; head?: boolean }) => {
    let query = supabase
      .from("default_images")
      .select(REF_ASSET_COLUMNS, selectOptions);

    if (options.search) query = query.ilike("name", `%${options.search}%`);
    if (options.role) query = query.eq("asset_role", options.role);
    if (options.tag) query = query.contains("tags", [options.tag]);
    if (typeof options.work === "number" && Number.isFinite(options.work)) {
      query = query.eq("work_number", Math.trunc(options.work));
    }
    if (minWidth !== null) query = query.gte("width", minWidth);

    return query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
  };

  const { data, error, count } = await buildQuery({ count: "exact" }).range(
    offset,
    offset + limit - 1
  );

  if (error) {
    // PostgREST answers 416 when the window starts past the last row. That is
    // an empty page, not a failure — a caller paging on a `total` that has
    // since shrunk must not get a 500. postgrest-js only reads the row count
    // off a successful response, so it takes a second, rows-free query to
    // report `total` here; this path is rare enough to pay for it.
    if (error.code === RANGE_NOT_SATISFIABLE) {
      const { count: totalCount, error: countError } = await buildQuery({
        count: "exact",
        head: true,
      });
      if (countError) {
        throw new Error(`Failed to list ref assets: ${countError.message}`);
      }
      return { assets: [], total: totalCount ?? 0 };
    }

    throw new Error(`Failed to list ref assets: ${error.message}`);
  }

  const assets = mapRows(data);
  return { assets, total: count ?? assets.length };
}

// Pure. Names the shared ordering helper's result after this kind: assets come
// back in the caller's requested order, and every distinct requested id that
// did not resolve — unknown, not a uuid, or past the per-request cap — lands in
// `missing`, so `assets.length + missing.length` accounts for each one exactly
// once.
export function orderAssetsByRequestedIds(
  assets: RefAsset[],
  requestedIds: string[]
): RefAssetsByIdsResult {
  const { items, missing } = orderRecordsByRequestedIds(assets, requestedIds);
  return { assets: items, missing };
}

/**
 * PUBLIC, unscoped — like every other read in this module. Resolves library
 * assets by exact id, in the caller's requested order; unresolved ids come back
 * in `missing`.
 */
export async function getRefAssetsByIds(
  ids: string[]
): Promise<RefAssetsByIdsResult> {
  const lookupIds = selectLookupIds(ids);
  if (lookupIds.length === 0) {
    return orderAssetsByRequestedIds([], ids);
  }

  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from("default_images")
    .select(REF_ASSET_COLUMNS)
    .in("id", lookupIds)
    .limit(lookupIds.length);

  if (error) {
    throw new Error(`Failed to load ref assets by id: ${error.message}`);
  }

  return orderAssetsByRequestedIds(mapRows(data), ids);
}

export async function getRefAsset(id: string): Promise<RefAsset | null> {
  const { assets } = await getRefAssetsByIds([id]);
  return assets[0] ?? null;
}
