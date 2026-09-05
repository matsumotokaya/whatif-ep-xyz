import "server-only";

import { createAnonClient } from "@/lib/supabase/anon";
import { resolveAsset } from "@/lib/asset";
import {
  mapRowToRefDesignLayers,
  type RefDesignLayers,
} from "./designs";
import {
  clampLimit,
  clampOffset,
  formatAspectRatio,
  getSiteUrl,
  isUuid,
  normalizeId,
  normalizeMinWidth,
  orderByRequestedIds as orderRecordsByRequestedIds,
  projectRefRecord,
  resolveRefFields,
  selectLookupIds,
  toFiniteNumber,
} from "./common";

// Ref Library, third kind: the site's DESIGN TEMPLATES (public.templates) — the
// curated starting points a user opens to create their own design. Saved
// designs are ./designs.ts and the official asset library is ./assets.ts.
//
// 🔴 THIS KIND HAS NO FLATTENED FULL-SIZE IMAGE, AND CANNOT HAVE ONE TODAY.
// `public.templates` records a `thumbnail_key` and nothing else: there is no
// `fullres_key` column, and no template has ever been rendered at full size.
// The gallery's "wallpaper download" button does NOT fetch a stored file — it
// mounts a hidden canvas, draws the elements in the browser and exports a data
// URL (see components/editor/components/TemplateWallpaperExporter.tsx), so the
// full-size image exists only for the moment of that download, in that one
// browser, and has no URL anyone could reference.
//
// So this module deliberately EXPOSES NO `url` FIELD AT ALL, rather than a
// `url` that is always null. The value of a template here is its LAYERS: the
// elements, in draw order, with geometry — which is exactly what an external
// renderer (Remotion, a video pipeline) needs to animate a design's parts. A
// template's `elements` column is NOT NULL and every row has at least one, so
// this needs no rendering step to work.
//
// Presenting the thumbnail as `url` would be the same mistake the design side
// already made once and undid: a consumer that believes it holds a full-size
// image feeds a ~400px preview to a video API that bills per generation and
// only finds out afterwards. `thumbnailUrl` is therefore named for what it is,
// and its pixel size is not recorded and is not claimed.
//
// CREDENTIAL: the anon client, like assets.ts. RLS on public.templates already
// grants SELECT to everyone, so nothing here needs it bypassed, and a future
// RLS restriction stays binding on this module instead of being silently
// stepped over by a service-role read.
//
// 🔴 SCOPE: FULLY PUBLIC, ON PURPOSE AND FOR NOW. Every template is listed and
// resolvable, including the 70 rows with `is_public = false` and every
// `plan_type = 'premium'` row. That is a deliberate, TEMPORARY decision taken
// on 2026-09-05: the Ref Library is not announced yet, so opening it wide costs
// nothing today and lets the shape of real usage inform where the line belongs.
// Note that the UI's premium gate is a gate on INSTANTIATING a template into
// your own designs, not on reading it — and the table's RLS already lets anyone
// read every row's `elements`, so this exposes nothing the database was
// withholding. Revisit before announcing: see docs/REF_LIBRARY.md.

const TEMPLATE_THUMBNAIL_BUCKET = "default-images";

// PostgREST's 416 for a range that starts past the last row.
const RANGE_NOT_SATISFIABLE = "PGRST103";

export interface RefTemplate {
  id: string;
  name: string;
  /**
   * The template document's own canvas size, from its `width`/`height` columns.
   * Not the size of any image — this kind has none. Named plainly rather than
   * `docWidth`/`docHeight` because there is no rendered size to tell it apart
   * from.
   */
  width: number | null;
  height: number | null;
  /** Reduced ratio of the canvas, e.g. "4:5", "9:16". */
  aspect: string | null;
  /** "free" | "premium" — the tier required to open it in the editor. */
  planType: string | null;
  /** Whether the gallery treats it as published. Does not gate this API today. */
  isPublic: boolean;
  /** The canvas colour behind the layers. */
  backgroundColor: string;
  /**
   * Small preview image. Its pixel size is not recorded and is NOT reported.
   * This is the only image a template has; never treat it as a full-size
   * source. See the header note.
   */
  thumbnailUrl: string | null;
  /**
   * Where the layers live: https://whatif-ep.xyz/api/ref/templates/{id}/layers.
   * A pure function of `id`, so listings leave it out by default.
   */
  layersUrl: string;
  /** How many times the template has been opened into a design. */
  openCount: number | null;
  likeCount: number | null;
  updatedAt: string;
}

/**
 * The layer payload is the same shape as a design's, because it answers the
 * same question and is produced by the same pure mapper — a consumer that can
 * render one can render the other with no branching.
 */
export type RefTemplateLayers = RefDesignLayers;

// Canonical field order, used for `fields=all` and to keep projected records in
// a stable key order. templates.test.ts asserts it covers RefTemplate exactly.
export const REF_TEMPLATE_FIELDS = [
  "id",
  "name",
  "width",
  "height",
  "aspect",
  "planType",
  "isPublic",
  "backgroundColor",
  "thumbnailUrl",
  "layersUrl",
  "openCount",
  "likeCount",
  "updatedAt",
] as const satisfies readonly (keyof RefTemplate)[];

export type RefTemplateField = (typeof REF_TEMPLATE_FIELDS)[number];

// Default shape of a LIST record: what it takes to pick a template (identity,
// shape, tier, and something to look at). `layersUrl` is a pure function of
// `id` and `backgroundColor` only matters once you are actually rendering, so
// both are opt-in — same reasoning as the other two kinds.
export const REF_TEMPLATE_LIST_FIELDS = [
  "id",
  "name",
  "width",
  "height",
  "aspect",
  "planType",
  "thumbnailUrl",
] as const satisfies readonly RefTemplateField[];

export type ProjectedRefTemplate = Partial<RefTemplate>;

// Pure. Resolves a caller's `fields` request into the field list to project:
// absent -> the compact list shape, "all" -> every field, otherwise EXACTLY the
// recognised names asked for, plus `id`.
export function resolveRefTemplateFields(
  raw: string | readonly string[] | null | undefined,
  defaultFields: readonly RefTemplateField[] = REF_TEMPLATE_LIST_FIELDS
): readonly RefTemplateField[] {
  return resolveRefFields(raw, REF_TEMPLATE_FIELDS, defaultFields);
}

export function projectRefTemplate(
  template: RefTemplate,
  fields: readonly RefTemplateField[]
): ProjectedRefTemplate {
  return projectRefRecord(template, fields);
}

export function projectRefTemplates(
  templates: readonly RefTemplate[],
  fields: readonly RefTemplateField[]
): ProjectedRefTemplate[] {
  return templates.map((template) => projectRefTemplate(template, fields));
}

// Shape of the columns this module selects from public.templates. `elements` is
// deliberately absent: it is by far the largest column and only the layers
// lookup needs it, exactly as REF_DESIGN_COLUMNS excludes it on the design side.
export interface RefTemplateRow {
  id: string;
  name: string | null;
  canvas_color: string | null;
  thumbnail_url: string | null;
  thumbnail_key: string | null;
  plan_type: string | null;
  is_public: boolean | null;
  display_order: number | null;
  width: number | null;
  height: number | null;
  like_count: number | null;
  open_count: number | null;
  updated_at: string;
}

const REF_TEMPLATE_COLUMNS =
  "id, name, canvas_color, thumbnail_url, thumbnail_key, plan_type, is_public, display_order, width, height, like_count, open_count, updated_at";

// The editor's own default when a document carries no canvas colour. Mirrors
// designs.ts; every row currently has one, so this is a guard, not a code path.
const DEFAULT_CANVAS_COLOR = "#ffffff";

// Prefer the key column (the R2 target), fall back to the legacy full-URL
// column. Byte for byte the resolution templateStorage.ts uses in the editor,
// so a ref thumbnail and the gallery thumbnail are the same cached object.
const resolveTemplateThumbnail = (row: RefTemplateRow): string | null => {
  const value = row.thumbnail_key || row.thumbnail_url;
  if (!value) return null;
  return (
    resolveAsset(value, {
      version: row.updated_at,
      legacyBucket: TEMPLATE_THUMBNAIL_BUCKET,
    }) || null
  );
};

// Pure row -> RefTemplate mapping, kept free of Supabase so it can be unit
// tested directly (same factoring as the other two kinds).
export function mapRowToRefTemplate(row: RefTemplateRow): RefTemplate {
  const siteUrl = getSiteUrl();
  const width = toFiniteNumber(row.width);
  const height = toFiniteNumber(row.height);

  return {
    id: row.id,
    name: row.name ?? "",
    // Unconditional, unlike the design side's `width`/`height`: these measure
    // the document, not an image that may not exist, so nothing here is a
    // claim about a file the caller might go and fetch.
    width,
    height,
    aspect: formatAspectRatio(width, height),
    planType: row.plan_type,
    isPublic: row.is_public ?? false,
    backgroundColor: row.canvas_color ?? DEFAULT_CANVAS_COLOR,
    thumbnailUrl: resolveTemplateThumbnail(row),
    layersUrl: `${siteUrl}/api/ref/templates/${row.id}/layers`,
    openCount: toFiniteNumber(row.open_count),
    likeCount: toFiniteNumber(row.like_count),
    updatedAt: row.updated_at,
  };
}

const mapRows = (data: unknown[] | null): RefTemplate[] =>
  (data ?? []).map((row) => mapRowToRefTemplate(row as RefTemplateRow));

export interface ListRefTemplatesOptions {
  /** Case-insensitive substring match on the template name. */
  search?: string;
  /** "free" or "premium". */
  planType?: string;
  limit?: number;
  offset?: number;
  /** Only templates whose canvas is at least this many pixels wide. */
  minWidth?: number;
}

export interface ListRefTemplatesResult {
  /** The requested window. */
  templates: RefTemplate[];
  /** Templates matching the filters, ignoring limit/offset. */
  total: number;
}

export interface RefTemplatesByIdsResult {
  templates: RefTemplate[];
  missing: string[];
}

/**
 * PUBLIC, unscoped — see the scope note in this module's header.
 *
 * Ordered the way the gallery orders them (curated `display_order` first, then
 * most recently updated), because "the templates" means that sequence to
 * anyone who has seen the site. `id` breaks ties so offset paging cannot drop
 * or repeat a row across pages.
 */
export async function listRefTemplates(
  options: ListRefTemplatesOptions = {}
): Promise<ListRefTemplatesResult> {
  const supabase = createAnonClient();
  const limit = clampLimit(options.limit);
  const offset = clampOffset(options.offset);
  const minWidth = normalizeMinWidth(options.minWidth);

  // Every filter is decided in Postgres. minWidth included: `width` is a real
  // integer column on this table, so `gte` compares numbers — unlike the design
  // side, where the dimension lives inside a jsonb blob that PostgREST would
  // compare as TEXT ("900" >= "2000") and quietly return the wrong rows.
  const buildQuery = (selectOptions?: { count?: "exact"; head?: boolean }) => {
    let query = supabase
      .from("templates")
      .select(REF_TEMPLATE_COLUMNS, selectOptions);

    if (options.search) query = query.ilike("name", `%${options.search}%`);
    if (options.planType) query = query.eq("plan_type", options.planType);
    if (minWidth !== null) query = query.gte("width", minWidth);

    return query
      .order("display_order", { ascending: true, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false });
  };

  const { data, error, count } = await buildQuery({ count: "exact" }).range(
    offset,
    offset + limit - 1
  );

  if (error) {
    // PostgREST answers 416 when the window starts past the last row. That is
    // an empty page, not a failure — a caller paging on a `total` that has
    // since shrunk must not get a 500.
    if (error.code === RANGE_NOT_SATISFIABLE) {
      const { count: totalCount, error: countError } = await buildQuery({
        count: "exact",
        head: true,
      });
      if (countError) {
        throw new Error(`Failed to list ref templates: ${countError.message}`);
      }
      return { templates: [], total: totalCount ?? 0 };
    }

    throw new Error(`Failed to list ref templates: ${error.message}`);
  }

  const templates = mapRows(data);
  return { templates, total: count ?? templates.length };
}

// Pure. Names the shared ordering helper's result after this kind: templates
// come back in the caller's requested order, and every distinct requested id
// that did not resolve lands in `missing`.
export function orderTemplatesByRequestedIds(
  templates: RefTemplate[],
  requestedIds: string[]
): RefTemplatesByIdsResult {
  const { items, missing } = orderRecordsByRequestedIds(
    templates,
    requestedIds
  );
  return { templates: items, missing };
}

/** PUBLIC, unscoped. Resolves templates by exact id, in the requested order. */
export async function getRefTemplatesByIds(
  ids: string[]
): Promise<RefTemplatesByIdsResult> {
  const lookupIds = selectLookupIds(ids);
  if (lookupIds.length === 0) {
    return orderTemplatesByRequestedIds([], ids);
  }

  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from("templates")
    .select(REF_TEMPLATE_COLUMNS)
    .in("id", lookupIds)
    .limit(lookupIds.length);

  if (error) {
    throw new Error(`Failed to load ref templates by id: ${error.message}`);
  }

  return orderTemplatesByRequestedIds(mapRows(data), ids);
}

export async function getRefTemplate(id: string): Promise<RefTemplate | null> {
  const { templates } = await getRefTemplatesByIds([id]);
  return templates[0] ?? null;
}

// Columns the layers path selects. A SEPARATE query from REF_TEMPLATE_COLUMNS
// for the same reason the design side keeps one: `elements` is the largest
// column on the table and a listing returns up to 200 rows, so carrying it
// there to serve one lookup would make every listing pay for it.
const REF_TEMPLATE_LAYER_COLUMNS =
  "id, name, canvas_color, width, height, elements";

export interface RefTemplateLayersRow {
  id: string;
  name: string | null;
  canvas_color: string | null;
  width: number | null;
  height: number | null;
  elements: unknown[] | null;
}

/**
 * Pure row -> RefTemplateLayers mapping.
 *
 * Reuses the design side's mapper rather than restating it, so the two kinds
 * cannot drift on the things that are genuinely hard here — the `visible:
 * false` filter, the index renumbering, the per-layer `exact` flags and the
 * `fidelity` block. The only real difference between the two tables is where
 * the canvas size is kept: a design carries it inside its `template` jsonb,
 * a template has real `width`/`height` columns. Adapting that one shape is
 * cheaper and safer than a second copy of the element logic.
 */
export function mapRowToRefTemplateLayers(
  row: RefTemplateLayersRow
): RefTemplateLayers {
  return mapRowToRefDesignLayers({
    id: row.id,
    name: row.name,
    template: { width: row.width, height: row.height },
    canvas_color: row.canvas_color,
    elements: row.elements,
  });
}

/**
 * PUBLIC, unscoped. Returns null for an unknown id and for anything that is not
 * a uuid (which can never match a row id and must not reach the query), so one
 * 404 answers both.
 */
export async function getRefTemplateLayers(
  id: string
): Promise<RefTemplateLayers | null> {
  const lookupId = normalizeId(id);
  if (!isUuid(lookupId)) return null;

  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from("templates")
    .select(REF_TEMPLATE_LAYER_COLUMNS)
    .eq("id", lookupId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load ref template layers: ${error.message}`);
  }
  if (!data) return null;

  return mapRowToRefTemplateLayers(data as unknown as RefTemplateLayersRow);
}
